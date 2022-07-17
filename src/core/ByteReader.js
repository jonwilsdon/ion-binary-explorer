'use strict';

/**
 * "Abstract" or "Pure virtual" class that provides a consistent interface for reading bytes.
 * nextByte, skipBytes, setPosition, atEnd, size, readVarUInt, readUInt, readVarInt, readInt
 */
class ByteReader {
  
  /**
   * no parameters required
   */
  constructor() {}

  /**
   * Returns the next byte.
   * 
   * @returns {null} if the next byte is beyond the current set of bytes available
   */
  nextByte() {
    return null;
  }

  /**
   * Moves the reader by the specified number of bytes.
   * 
   * @param {Number} numBytesToSkip The number of bytes to skip.
   * - accepts positive numbers to skip forwards
   * - accepts negative numbers to skip backwards
   * @returns {null}
   * null if numBytesToSkip is beyond the current set of bytes available
   */
  skipBytes(numBytesToSkip) {
    return null;
  }

  /**
   * Sets the reader position to the specified offset
   * 
   * @param {Number} positionToSet
   * @returns {null} 
   * null if positionToSet is beyond the current set of bytes available
   */
  setPosition(positionToSet) {
    return null;
  }

  /**
   * Returns whether the reader is at the end of the stream at the specified position
   * 
   * @param {Number} position
   * @returns {Boolean}
   * - true if the reader is at the end of the stream
   * - false otherwise
   */
  atEnd(position) {}

  /**
   * Returns the size (number of bytes) of the reader.
   */
  size() {}

  /**
   * @example
   *                 7  6                   0       n+7 n+6                 n
   *               +===+=====================+     +---+---------------------+
   * VarUInt field : 0 :         bits        :  …  | 1 |         bits        |
   *               +===+=====================+     +---+---------------------+
   * 
   * @description
   * VarUInt fields represent self-delimiting, variable-length unsigned integer values.
   * These field formats are always used in a context that does not indicate the number of octets in the field;
   * the last octet (and only the last octet) has its high-order bit set to terminate the field.
   * 
   * @returns {null | Object}
   * The Object returned has the following properties:
   * - numBytesRead
   * - magnitude
   */
  readVarUInt() {
    let totalNumBytesRead = 0;
    let magnitude = 0;
    let byte;

    do {
      byte = this.nextByte();

      // not enough bytes available, reset reader position, propagate null
      if (byte === null) {
        this.skipBytes(-1 * totalNumBytesRead);
        return null;
      }

      totalNumBytesRead++;
      // 28+ bytes (4bytes read * 7bytes)
      if (totalNumBytesRead === 5) {
        magnitude = BigInt(magnitude);
      }
      if (totalNumBytesRead > 4) {
        magnitude = (magnitude << 7n) | BigInt(byte & 0x7F);
      } else {
        magnitude = (magnitude << 7) | (byte & 0x7F);
      }
      // check the high-order bit
    } while (!(byte & 0x80));

    if (totalNumBytesRead > 4) {
      if (magnitude > Number.MAX_SAFE_INTEGER) {
        // TODO: pass the notice to the caller
        let notice = `VarUInt > 4 bytes and magnitude (${magnitude}) > Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large VarUInts.`;
      } else {
        // TODO: pass the notice to the caller
        let notice = `VarUInt > 4 bytes and magnitude (${magnitude}) <= Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large VarUInts.`;
        magnitude = Number(magnitude);
      }
    }

    return { numBytesRead: totalNumBytesRead, magnitude: magnitude };
  };

  /**
   * @example
   *             7                       0
   *            +-------------------------+
   * UInt field |          bits           |
   *            +-------------------------+
   *            :          bits           :
   *            +=========================+
   *                        ⋮
   *            +=========================+
   *            :          bits           :
   *            +=========================+
   *             n+7                     n
   * 
   * @description
   * UInt fields represent fixed-length unsigned integer values.
   * These field formats are always used in some context that clearly indicates the number of octets in the field.
   * 
   * UInts are sequences of octets, interpreted as big-endian.
   * 
   * @param {Number} length The length of the UInt to read.
   * @returns {null | Object}
   * The Object returned has the following properties:
   * - numBytesRead
   * - magnitude
   */
  readUInt(length) {
    let totalNumBytesRead = 0;
    let magnitude = 0;
    let byte;

    do {
      byte = this.nextByte();

      // not enough bytes available, reset reader position, propagate null
      if (byte === null) {
        this.skipBytes(-1 * totalNumBytesRead);
        return null;
      }

      totalNumBytesRead++;
      // 24+ bytes (3bytes read * 8bytes)
      if (totalNumBytesRead === 4) {
        magnitude = BigInt(magnitude);
      }
      if (totalNumBytesRead > 3) {
        magnitude = (magnitude << 8n) | BigInt(byte);
      } else {
        magnitude = (magnitude << 8) | byte;
      }
    } while (totalNumBytesRead < length);

    if (totalNumBytesRead > 4) {
      if (magnitude > Number.MAX_SAFE_INTEGER) {
        // TODO: pass the notice to the caller
        let notice = `UInt > 4 bytes and magnitude (${magnitude}) > Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large UInts.`;
      } else {
        // TODO: pass the notice to the caller
        let notice = `UInt > 4 bytes and magnitude (${magnitude}) <= Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large UInts.`;
        magnitude = Number(magnitude);
      }
    }

    return { numBytesRead: totalNumBytesRead, magnitude: magnitude };
  };

  /**
   * @example
   *                7   6  5               0       n+7 n+6                 n
   *              +===+                           +---+
   * VarInt field : 0 :       payload          …  | 1 |       payload
   *              +===+                           +---+
   *                  +---+-----------------+         +=====================+
   *                  |   |   magnitude     |  …      :       magnitude     :
   *                  +---+-----------------+         +=====================+
   *                ^   ^                           ^
   *                |   |                           |
   *                |   +--sign                     +--end flag
   *                +--end flag
   * 
   * @example
   *                             7   6  5           0
   *                           +---+---+-------------+
   * single octet VarInt field | 1 |   |  magnitude  |
   *                           +---+---+-------------+
   *                                 ^
   *                                 |
   *                                 +--sign
   * 
   * @description
   * VarInt fields represent self-delimiting, variable-length signed integer values.
   * These field formats are always used in a context that does not indicate the number of octets in the field;
   * the last octet (and only the last octet) has its high-order bit set to terminate the field.

   * VarInts are sign-and-magnitude integers, like Ints. Their layout is complicated, as there is one special
   * leading bit (the sign) and one special trailing bit (the terminator). In the above diagram, we put the two
   * concepts on different layers.
   * 
   * The high-order bit in the top layer is an end-of-sequence marker. It must be set on the last octet in the
   * representation and clear in all other octets. The second-highest order bit (0x40) is a sign flag in the first
   * octet of the representation, but part of the extension bits for all other octets. For single-octet VarInt values,
   * this collapses down to:
   * 
   * @returns {null | Object}
   * The Object returned has the following properties:
   * - numBytesRead
   * - magnitude
   * - isNegative
   */
  readVarInt () {
    let totalNumBytesRead = 0;
    let magnitude = 0;
    let isNegative;
    let byte;

    do {
      byte = this.nextByte();

      // not enough bytes available, reset reader position, propagate null
      if (byte === null) { 
        this.skipBytes(-1 * totalNumBytesRead);
        return null;
      }

      totalNumBytesRead++;
      // 28+ bytes (4bytes read * 7bytes)
      if (totalNumBytesRead === 5) {
        magnitude = BigInt(magnitude);
      }
      if (totalNumBytesRead === 1) {
        isNegative = ((byte & 0x40) === 0) ? false : true;
        magnitude = byte & 0x3F;
      } else if (totalNumBytesRead > 4) {
        magnitude = (magnitude << 7n) | BigInt(byte & 0x7F);
      } else {
        magnitude = (magnitude << 7) | (byte & 0x7F);
      }
      // check the high-order bit
    } while (!(byte & 0x80));

    if (totalNumBytesRead > 4) {
      if (magnitude > Number.MAX_SAFE_INTEGER) {
        // TODO: pass the notice to the caller
        let notice = `VarInt > 4 bytes and magnitude (${magnitude}) > Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large VarInts.`;
      } else {
        // TODO: pass the notice to the caller
        let notice = `VarInt > 4 bytes and magnitude (${magnitude}) <= Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large VarInts.`;
        magnitude = Number(magnitude);
      }
    }

    return { numBytesRead: totalNumBytesRead, magnitude: ((isNegative === true) ? -magnitude : magnitude),
            isNegative: isNegative };
  };
  
  /**
   * @example
   *              7  6                   0
   *            +---+---------------------+
   * Int field  |   |      bits           |
   *            +---+---------------------+
   *              ^
   *              |
   *              +--sign
   *            +=========================+
   *            :          bits           :
   *            +=========================+
   *                        ⋮
   *            +=========================+
   *            :          bits           :
   *            +=========================+
   *             n+7                     n
   * 
   * @description
   * Int fields represent fixed-length signed integer values.
   * These field formats are always used in some context that clearly indicates the number of octets in the field.
   * 
   * Ints are sequences of octets, interpreted as sign-and-magnitude big endian integers (with the sign on the
   * highest-order bit of the first octet). This means that the representations of 123456 and -123456 should only
   * differ in their sign bit.
   * 
   * @param {Number} length The length of the Int to read.
   * @returns {null | Object}
   * The Object returned has the following properties:
   * - numBytesRead
   * - magnitude
   * - isNegative
   */
  readInt (length) {
    let totalNumBytesRead = 0;
    let magnitude = 0;
    let isNegative;
    let byte;

    do {
      byte = this.nextByte();

      // not enough bytes available, reset reader position, propagate null
      if (byte === null) { 
        this.skipBytes(-1 * totalNumBytesRead);
        return null;
      }

      totalNumBytesRead++;
      // 24+ bytes (3bytes read * 8bytes - 1bit)
      if (totalNumBytesRead === 4) {
        magnitude = BigInt(magnitude);
      }
      if (totalNumBytesRead === 1) {
        isNegative = ((byte & 0x80) === 0) ? false : true;
        magnitude = (magnitude << 7) | (byte & 0x7F);
      }
      else if (totalNumBytesRead > 3) {
        magnitude = (magnitude << 8n) | BigInt(byte);
      } else {
        magnitude = (magnitude << 8) | byte;
      }
    } while (totalNumBytesRead < length);

    if (totalNumBytesRead > 4) {
      if (magnitude > Number.MAX_SAFE_INTEGER) {
        // TODO: pass the notice to the caller
        let notice = `Int > 4 bytes and magnitude (${magnitude}) > Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large Ints.`;
      } else {
        // TODO: pass the notice to the caller
        let notice = `Int > 4 bytes and magnitude (${magnitude}) <= Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}); not all readers support large Ints.`;
        magnitude = Number(magnitude);
      }
    }

    return { numBytesRead: totalNumBytesRead, magnitude: ((isNegative === true) ? -magnitude : magnitude),
            isNegative: isNegative };
  };
};

exports.ByteReader = ByteReader;