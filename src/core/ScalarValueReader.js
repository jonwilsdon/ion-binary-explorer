'use strict';

const br = require('./ByteReader');
const { IonElement } = require('./IonElement');
const { IonTypes } = require('./IonTypes');

/**
 * Reads Ion scalar values (beyond the Type Descriptor) from a ByteReader.  
 * The Ion scalar values are Bool, Int, Float, Decimal, Timestamp, Symbol, String, Clob, and Blob.  
 * Bool does not require reading beyond the Type Descriptor.
 */
class ScalarValueReader {
  
  /**
   * Used for reading UTF8.  
   * TextDecoder support is non-existent in IE/Edge.
   */
  #textDecoder;

  /**
   * Used for reading bytes.
   */
  #byteReader;

  /**
   * Reads the representation (magnitude) portion of a positive Int value
   * 
   * @example
   *           7       4 3       0
   *           +---------+---------+
   * Int value |0x2 / 0x3|    L    |
   *           +---------+---------+======+
   *           :     length [VarUInt]     :
   *           +==========================+
   *           :     magnitude [UInt]     :
   *           +==========================+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader 
   * @returns {Number} the magnitude of the positive Int
   */
  #readInt = function (position, length, reader) {
    reader.setPosition(position);

    const value = reader.readUInt(length).magnitude;

    if (((length > 3) && value === 0n) || value === 0) {
      // TODO: Warn that a zero is stored with extra padding
    }

    return value;
  };

  /**
   * Reads the representation (magnitude) portion of a negative Int value
   * 
   * @example
   *           7       4 3       0
   *           +---------+---------+
   * Int value |0x2 / 0x3|    L    |
   *           +---------+---------+======+
   *           :     length [VarUInt]     :
   *           +==========================+
   *           :     magnitude [UInt]     :
   *           +==========================+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader 
   * @returns {Number} the magnitude of the negative Int
   */
  #readNegativeInt = function (position, length, reader) {
    reader.setPosition(position);

    const value = reader.readUInt(length).magnitude;
    
    if (((length > 3) && value === 0n) || value === 0) {
      // TODO: pass the error to the caller
      const err = new Error(`readNegativeInt() zero not a valid negative int value.`);
      throw err;
    }

    return -value;
  };

  /**
   * Reads the IEEE-754 representation of a Float value.
   * Supports 32- and 64-bit floats.
   * 
   * @example
   *               7       4 3       0
   *             +---------+---------+
   * Float value |   0x4   |    L    |
   *             +---------+---------+-----------+
   *             |   representation [IEEE-754]   |
   *             +-------------------------------+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader 
   * @returns 
   * - `null` if not enough bytes available to read the representation
   * - `Object` with exponent and coefficient properties
   */
  #readFloat = function (position, length, reader) {
    if (length !== 4 && length !== 8) {
      // TODO: pass the error to the caller
      const err = new Error(`ScalarValueReader illegal float length ${length}.`);
      throw err;
    }

    const buffer = new Uint8Array(length);
    reader.setPosition(position);
    for (let i = 0; i < length; ++i) {
      buffer[i] = reader.nextByte();

      // not enough bytes available, reset reader position (i), propagate null
      if (buffer[i] === null) {
        reader.skipBytes(-1 * i);
        return null;
      }
    }

    let tempBuf;
    switch (length) {
        case 4:
            tempBuf = new DataView(buffer.buffer);
            return tempBuf.getFloat32(0, false);
        case 8:
            tempBuf = new DataView(buffer.buffer);
            return tempBuf.getFloat64(0, false);
        default:
            // do nothing. Handled at beginning of function.
    }
  };

  /**
   * Reads the representation (exponent and coefficient) of a Decimal value.
   * 
   * @example
   *                7       4 3       0
   *               +---------+---------+
   * Decimal value |   0x5   |    L    |
   *               +---------+---------+======+
   *               :     length [VarUInt]     :
   *               +--------------------------+
   *               |    exponent [VarInt]     |
   *               +--------------------------+
   *               |    coefficient [Int]     |
   *               +--------------------------+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader
   * @returns 
   * - `null` if not enough bytes available to read the representation
   * - `Object` with exponent and coefficient properties
   */
  #readDecimal = function (position, length, reader) {
    reader.setPosition(position);

    const exponent = reader.readVarInt();

    // not enough bytes available, propagate null
    if (exponent === null) {
      return null;
    }

    const coefficientLength = length - exponent.numBytesRead;
    let coefficient;

    if (coefficientLength < 0) {
      // TODO: pass the error to the caller
      const err = new Error(`ScalarValueReader illegal coefficient length.`);
      throw err;
    }

    if (coefficientLength === 0) {
      // coefficient is positive 0
      coefficient = { magnitude: 0, numBytesRead: 0, isNegative: false };
    } else {
      coefficient = reader.readInt(coefficientLength);

      // not enough bytes available, reset reader position (coefficient), propagate null
      if (coefficient === null) {
        reader.skipBytes(-1 * exponent.numBytesRead);
        return null;
      }

      if (coefficient.isNegative === false && (coefficient.magnitude === 0 || coefficient.magnitude === 0n)) {
        // TODO: if coefficient is positive 0, warn (coefficient should have length 0)
      }
    }

    return { exponent: exponent, coefficient: coefficient };
  };

  /**
   * Reads the representation (offset, year, month, day, hour, minute, second, fraction_exponent, fraction_coefficient)
   * portion of a Timestamp value.
   * 
   * @example
   *                  7       4 3       0
   *                 +---------+---------+
   * Timestamp value |   0x6   |    L    |
   *                 +---------+---------+========+
   *                 :      length [VarUInt]      :
   *                 +----------------------------+
   *                 |      offset [VarInt]       |
   *                 +----------------------------+
   *                 |       year [VarUInt]       |
   *                 +----------------------------+
   *                 :       month [VarUInt]      :
   *                 +============================+
   *                 :         day [VarUInt]      :
   *                 +============================+
   *                 :        hour [VarUInt]      :
   *                 +====                    ====+
   *                 :      minute [VarUInt]      :
   *                 +============================+
   *                 :      second [VarUInt]      :
   *                 +============================+
   *                 : fraction_exponent [VarInt] :
   *                 +============================+
   *                 : fraction_coefficient [Int] :
   *                 +============================+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader
   * @returns 
   * - `null` if not enough bytes available to read the representation
   * - `Object` with offset, year, month, day, hour, minute, second, fractionExponent, and fractionCoefficient 
   * properties
   */
  #readTimestamp = function (position, length, reader) {
    reader.setPosition(position);

    let remainingLength = length;
    let offset;
    let year;
    let month;
    let day;
    let hour;
    let minute;
    let second;
    let fractionExponent;
    let fractionCoefficient;

    // two mandatory components: offset and year
    // TODO: warn if offset is less than -720 (-12 hours) or more than 840 (+14 hours)
    //       warn if offset is more than 2 bytes (-8191, 8191) -^
    offset = reader.readVarInt();

    // not enough bytes available, propagate null
    if (offset === null) {
      return null;
    }

    remainingLength -= offset.numBytesRead;

    year = reader.readVarUInt();

    // not enough bytes available, propagate null
    if (year === null) {
      reader.skipBytes(-1 * (length - remainingLength));
      return null;
    }

    remainingLength -= year.numBytesRead;

    if (remainingLength > 0) {
      month = reader.readVarUInt();

      // not enough bytes available, propagate null
      if (month === null) {
        reader.skipBytes(-1 * (length - remainingLength));
        return null;
      }

      remainingLength -= month.numBytesRead;
    }

    // TODO: warn on days that are impossible (>31)
    if (remainingLength > 0) {
      day = reader.readVarUInt();

      // not enough bytes available, propagate null
      if (day === null) {
        reader.skipBytes(-1 * (length - remainingLength));
        return null;
      }

      remainingLength -= day.numBytesRead;
    }

    // hour and minute are considered a single component
    if (remainingLength > 0) {
      // TODO: warn on hours that are impossible (>24)
      hour = reader.readVarUInt();

      // not enough bytes available, propagate null
      if (hour === null) {
        reader.skipBytes(-1 * (length - remainingLength));
        return null;
      }

      remainingLength -= hour.numBytesRead;

      if (remainingLength > 0) {
        // TODO: warn on minutes that are impossible (>60)
        minute = reader.readVarUInt();

        // not enough bytes available, propagate null
        if (minute === null) {
          reader.skipBytes(-1 * (length - remainingLength));
          return null;
        }

        remainingLength -= minute.numBytesRead;
      }
      else {
        // TODO: pass the error to the caller
        const err = new Error(`ScalarValueReader hours present without minutes.`);
        throw err;
      }
    }

    if (remainingLength > 0) {
      // TODO: warn on seconds that are impossible
      second = reader.readVarUInt();

      // not enough bytes available, propagate null
      if (second === null) {
        reader.skipBytes(-1 * (length - remainingLength));
        return null;
      }

      remainingLength -= second.numBytesRead;
    }

    if (remainingLength > 0) {
      fractionExponent = reader.readVarInt();

      // not enough bytes available, propagate null
      if (fractionExponent === null) {
        reader.skipBytes(-1 * (length - remainingLength));
        return null;
      }

      remainingLength -= fractionExponent.numBytesRead;
    }

    if (remainingLength > 0) {
      fractionCoefficient = reader.readInt(remainingLength);

      // not enough bytes available, propagate null
      if (fractionCoefficient=== null) {
        reader.skipBytes(-1 * (length - remainingLength));
        return null;
      }

    // coefficient defaults to 0 if exponent exists and coefficient is not defined
    } else if (fractionExponent !== undefined) {
      fractionCoefficient = { numBytesRead: 0, magnitude: 0, isNegative: false };
    }

    return { offset: offset, year: year, month: month, day: day, hour: hour, minute: minute, second: second,
             fractionExponent: fractionExponent, fractionCoefficient: fractionCoefficient };
  };

  /**
   * Reads the representation (symbol ID) of a Symbol value.
   * 
   * @example
   *               7       4 3       0
   *              +---------+---------+
   * Symbol value |   0x7   |    L    |
   *              +---------+---------+======+
   *              :     length [VarUInt]     :
   *              +--------------------------+
   *              |     symbol ID [UInt]     |
   *              +--------------------------+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader 
   * @returns 
   * - `null` if not enough bytes available to read the representation
   * - `Number` the Symbol ID
   */
  #readSymbol = function (position, length, reader) {
    if (length < 1) {
      return 0;
    }
  
    reader.setPosition(position);

    const symbol = reader.readUInt(length);

    // not enough bytes available, propagate null
    if (symbol === null) {
      return null;
    }

    return symbol.magnitude;
  };

  /**
   * Reads the representation (UTF8) of a String value.
   * 
   * @example
   *               7       4 3       0
   *              +---------+---------+
   * String value |   0x8   |    L    |
   *              +---------+---------+======+
   *              :     length [VarUInt]     :
   *              +==========================+
   *              :  representation [UTF8]   :
   *              +==========================+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader
   * @returns 
   * - `null` if not enough bytes available to read the representation
   * - `String` the UTF8 string
   */
  #readString = function (position, length, reader) {
    const bytes = new Uint8Array(length);
    reader.setPosition(position);
    for (let i = 0; i < length; ++i) {
      bytes[i] = reader.nextByte();

      // not enough bytes available, propagate null
      if (bytes[i] === null) {
        reader.skipBytes(-1 * i);
        return null;
      }
    }

    return this.#textDecoder.decode(bytes);
  };

  /**
   * Reads the representation (data) of a Clob or Blob value.
   * 
   * @example
   *             7       4 3       0
   *            +---------+---------+
   * Clob value |   0x9   |    L    |
   *            +---------+---------+======+
   *            :     length [VarUInt]     :
   *            +==========================+
   *            :       data [Bytes]       :
   *            +==========================+
   * 
   * @example
   *             7       4 3       0
   *            +---------+---------+
   * Blob value |   0xA   |    L    |
   *            +---------+---------+======+
   *            :     length [VarUInt]     :
   *            +==========================+
   *            :       data [Bytes]       :
   *            +==========================+
   * 
   * @param {Number} position 
   * @param {Number} length 
   * @param {ByteReader} reader 
   * @returns 
   * - `null` if not enough bytes available to read the representation
   * - `Uint8Array` buffer of the Clob or Blob bytes
   */
  #readLob = function (position, length, reader) {
    const buffer = new Uint8Array(length);
    reader.setPosition(position);
    for (let i = 0; i < length; ++i) {
      buffer[i] = reader.nextByte();

      // not enough bytes available, propagate null
      if (buffer[i] === null) {
        reader.skipBytes(-1 * i);
        return null;
      }
    }

    return buffer;
  };

  /**
   * Maps IonTypes to scalar value reading functions.
   */
  #readScalarFuncs;

  /**
   * Requires a ByteReader as a parameter
   * 
   * @param {ByteReader} byteReader 
   */
  constructor (byteReader) {
    if (!(byteReader instanceof br.ByteReader)) {
      // TODO: pass the error to the caller
      const err = new Error(`ScalarValueReader expected byteReader to be a ByteReader.`);
      throw err;
    }

    this.#byteReader = byteReader;
    this.#textDecoder = new TextDecoder("utf-8");

    // initialize all functions to log an error
    this.#readScalarFuncs = new Array(IonTypes.numTypes);
    for (let i = 0; i < IonTypes.numTypes; ++i) {
      this.#readScalarFuncs[i] = function (_position, _length) {
        // TODO: pass the error to the caller
        const err = new Error(`ScalarValueReader called on ${IonTypes.nameFromType(i)}, a non-scalar.`);
        throw err;
      };
    }

    // override the scalars with the proper functions
    this.#readScalarFuncs[IonTypes["int+"]] = this.#readInt;
    this.#readScalarFuncs[IonTypes["int-"]] = this.#readNegativeInt;
    this.#readScalarFuncs[IonTypes["float"]] = this.#readFloat;
    this.#readScalarFuncs[IonTypes["decimal"]] = this.#readDecimal;
    this.#readScalarFuncs[IonTypes["timestamp"]] = this.#readTimestamp;
    this.#readScalarFuncs[IonTypes["symbol"]] = this.#readSymbol;
    this.#readScalarFuncs[IonTypes["string"]] = this.#readString;
    this.#readScalarFuncs[IonTypes["clob"]] = this.#readLob;
    this.#readScalarFuncs[IonTypes["blob"]] = this.#readLob;
  }

  /**
   * Reads a specified scalar value type from a specified position in the byte reader that is the specified length.
   * 
   * @param {IonType} type 
   * @param {Number} position 
   * @param {Number} length 
   */
  read(type, position, length) {
    if (this.#readScalarFuncs[type] === undefined) {
      // TODO: pass the error to the caller
      const err = new Error(`ScalarValueReader read() called with non-existent type ${type}.`);
      throw err;
    }

    if (!Number.isInteger(position) || position < 0) {
      // TODO: pass the error to the caller
      const err = new Error(`ScalarValueReader read() called with invalid position ${position}.`);
      throw err;
    }

    if (!Number.isInteger(length) || length <= 0) {
      // TODO: pass the error to the caller
      const err = new Error(`ScalarValueReader read() called with invalid length ${length}.`);
      throw err;
    }
    
    return this.#readScalarFuncs[type].apply(this, [position, length, this.#byteReader]);
  }
}

/**
 * Helper function to read scalar values from an IonElement.  
 * Requires an IonElement as a parameter.  
 * Requires a ScalarValueReader as a parameter.
 * 
 * @param {IonElement} element 
 * @param {ScalarValueReader} scalarReader 
 * @returns 
 */
const readScalarFromElement = (element, scalarReader) => {
  if (element === undefined || scalarReader === null) {
    const err = new Error(`readScalar called with no element`);
    throw err;
  }

  if (scalarReader === undefined || scalarReader === null) {
    const err = new Error(`readScalar called with no scalarReader`);
    throw err;
  }

  return scalarReader.read(
    element.type, element.bytePositionOfRepresentation, (element.lengthWithoutAnnotations - element.varUIntLength)
  );
};

exports.readScalarFromElement = readScalarFromElement;
exports.ScalarValueReader = ScalarValueReader;