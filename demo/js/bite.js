var BITE = (() => {
  var __commonJS = (callback, module) => () => {
    if (!module) {
      module = {exports: {}};
      callback(module.exports, module);
    }
    return module.exports;
  };

  // src/core/ByteReader.js
  var require_ByteReader = __commonJS((exports) => {
    "use strict";
    var ByteReader = class {
      constructor() {
      }
      nextByte() {
        return null;
      }
      skipBytes(numBytesToSkip) {
        return null;
      }
      setPosition(positionToSet) {
        return null;
      }
      atEnd(position) {
      }
      size() {
      }
      readVarUInt(errorHandler2) {
        let totalNumBytesRead = 0;
        let magnitude = 0;
        let byte;
        do {
          byte = this.nextByte();
          if (byte === null) {
            this.skipBytes(-1 * totalNumBytesRead);
            return null;
          }
          totalNumBytesRead++;
          if (totalNumBytesRead === 5) {
            magnitude = BigInt(magnitude);
          }
          if (totalNumBytesRead > 4) {
            magnitude = magnitude << 7n | BigInt(byte & 127);
          } else {
            magnitude = magnitude << 7 | byte & 127;
          }
        } while (!(byte & 128));
        return {numBytesRead: totalNumBytesRead, magnitude};
      }
      readUInt(length, errorHandler2) {
        let totalNumBytesRead = 0;
        let magnitude = 0;
        let byte;
        do {
          byte = this.nextByte();
          if (byte === null) {
            this.skipBytes(-1 * totalNumBytesRead);
            return null;
          }
          totalNumBytesRead++;
          if (totalNumBytesRead === 4) {
            magnitude = BigInt(magnitude);
          }
          if (totalNumBytesRead > 3) {
            magnitude = magnitude << 8n | BigInt(byte);
          } else {
            magnitude = magnitude << 8 | byte;
          }
        } while (totalNumBytesRead < length);
        return {numBytesRead: totalNumBytesRead, magnitude};
      }
      readVarInt(errorHandler2) {
        let totalNumBytesRead = 0;
        let magnitude = 0;
        let isNegative;
        let byte;
        do {
          byte = this.nextByte();
          if (byte === null) {
            this.skipBytes(-1 * totalNumBytesRead);
            return null;
          }
          totalNumBytesRead++;
          if (totalNumBytesRead === 5) {
            magnitude = BigInt(magnitude);
          }
          if (totalNumBytesRead === 1) {
            isNegative = (byte & 64) === 0 ? false : true;
            magnitude = byte & 63;
          } else if (totalNumBytesRead > 4) {
            magnitude = magnitude << 7n | BigInt(byte & 127);
          } else {
            magnitude = magnitude << 7 | byte & 127;
          }
        } while (!(byte & 128));
        return {
          numBytesRead: totalNumBytesRead,
          magnitude: isNegative === true ? -magnitude : magnitude,
          isNegative
        };
      }
      readInt(length, errorHandler2) {
        let totalNumBytesRead = 0;
        let magnitude = 0;
        let isNegative;
        let byte;
        do {
          byte = this.nextByte();
          if (byte === null) {
            this.skipBytes(-1 * totalNumBytesRead);
            return null;
          }
          totalNumBytesRead++;
          if (totalNumBytesRead === 4) {
            magnitude = BigInt(magnitude);
          }
          if (totalNumBytesRead === 1) {
            isNegative = (byte & 128) === 0 ? false : true;
            magnitude = magnitude << 7 | byte & 127;
          } else if (totalNumBytesRead > 3) {
            magnitude = magnitude << 8n | BigInt(byte);
          } else {
            magnitude = magnitude << 8 | byte;
          }
        } while (totalNumBytesRead < length);
        return {
          numBytesRead: totalNumBytesRead,
          magnitude: isNegative === true ? -magnitude : magnitude,
          isNegative
        };
      }
    };
    exports.ByteReader = ByteReader;
  });

  // src/core/ByteBufferReader.js
  var require_ByteBufferReader = __commonJS((exports) => {
    "use strict";
    var br = require_ByteReader();
    var ByteBufferReader = class extends br.ByteReader {
      #sourceBuffer = null;
      #uint8Buffer = null;
      #positionInBuffer = 0;
      constructor() {
        super();
      }
      loadBuffer(buffer) {
        this.#sourceBuffer = buffer;
        if (this.#sourceBuffer === null || this.#sourceBuffer === void 0) {
          throw new Error(`ByteBufferReader loadBuffer() called with a ${this.#sourceBuffer} buffer.`);
        }
        if (this.#sourceBuffer instanceof ArrayBuffer) {
          this.#uint8Buffer = new Uint8Array(this.#sourceBuffer);
        } else if (this.#sourceBuffer instanceof Uint8Array) {
          this.#uint8Buffer = this.#sourceBuffer;
        } else {
          throw new Error(`ByteBufferReader loadBuffer() called with an unsupported buffer type.`);
        }
        return this.#uint8Buffer.length;
      }
      nextByte() {
        if (this.atEnd()) {
          return null;
        }
        if (this.#positionInBuffer + 1 > this.#uint8Buffer.length) {
          return null;
        }
        let byte = this.#uint8Buffer[this.#positionInBuffer];
        this.#positionInBuffer++;
        return byte;
      }
      skipBytes(numBytesToSkip) {
        this.#positionInBuffer += numBytesToSkip;
      }
      setPosition(positionToSet) {
        this.#positionInBuffer = positionToSet;
      }
      atEnd(position) {
        if (position === this.#uint8Buffer.length) {
          return true;
        }
        if (position > this.#uint8Buffer.length) {
          return null;
        }
        return false;
      }
      rawBytes(offset, length) {
        return this.#uint8Buffer.slice(offset, offset + length);
      }
      get positionInBuffer() {
        return this.#positionInBuffer;
      }
      get size() {
        return this.#uint8Buffer.length;
      }
    };
    exports.ByteBufferReader = ByteBufferReader;
  });

  // src/core/IonTypes.js
  var require_IonTypes = __commonJS((exports) => {
    "use strict";
    var IonTypes = {
      null: 0,
      bool: 1,
      "int+": 2,
      "int-": 3,
      float: 4,
      decimal: 5,
      timestamp: 6,
      symbol: 7,
      string: 8,
      clob: 9,
      blob: 10,
      list: 11,
      sexp: 12,
      struct: 13,
      annotation: 14,
      reserved: 15,
      bvm: 16,
      nop: 17,
      numTypes: 18,
      isContainer: function(type) {
        return type === this["list"] || type === this["sexp"] || type === this["struct"] ? true : false;
      },
      isScalar: function(type) {
        return type === this["null"] || type === this["bool"] || type === this["int+"] || type === this["int-"] || type === this["float"] || type === this["decimal"] || type === this["timestamp"] || type === this["symbol"] || type === this["string"] || type === this["clob"] || type === this["blob"] ? true : false;
      },
      nameFromType: function(type) {
        return IonTypesReverse[type];
      }
    };
    var IonTypesReverse = new Array(IonTypes["numTypes"]);
    for (let [key, value] of Object.entries(IonTypes)) {
      if (key === "numTypes") {
        continue;
      }
      IonTypesReverse[value] = key;
    }
    exports.IonTypes = IonTypes;
  });

  // src/core/ReaderUtilities.js
  var require_ReaderUtilities = __commonJS((exports) => {
    "use strict";
    var IonTypes = require_IonTypes().IonTypes;
    var readScalarFromElement = (element, scalarReader) => {
      if (scalarReader === void 0 || scalarReader === null) {
        throw new Error(`readScalar called with no scalarReader`);
      }
      if (!(element.type === IonTypes["int+"] || element.type === IonTypes["int-"] || element.type === IonTypes["float"] || element.type === IonTypes["decimal"] || element.type === IonTypes["timestamp"] || element.type === IonTypes["symbol"] || element.type === IonTypes["string"] || element.type === IonTypes["clob"] || element.type === IonTypes["blob"])) {
        throw new Error(`readScalar called with a non-scalar type ${element.type}`);
      }
      return scalarReader.read(element.type, element.bytePositionOfRepresentation, element.lengthWithoutAnnotations - element.varUIntLength);
    };
    exports.readScalarFromElement = readScalarFromElement;
  });

  // src/core/TypeDescriptorReader.js
  var require_TypeDescriptorReader = __commonJS((exports) => {
    "use strict";
    var br = require_ByteReader();
    var utilities = require_ReaderUtilities();
    var IonTypes = require_IonTypes().IonTypes;
    var TypeDescriptorReader = class {
      #typeDescriptor = [
        () => ({type: IonTypes["nop"], length: 0, isNull: false}),
        () => ({type: IonTypes["nop"], length: 1, isNull: false}),
        () => ({type: IonTypes["nop"], length: 2, isNull: false}),
        () => ({type: IonTypes["nop"], length: 3, isNull: false}),
        () => ({type: IonTypes["nop"], length: 4, isNull: false}),
        () => ({type: IonTypes["nop"], length: 5, isNull: false}),
        () => ({type: IonTypes["nop"], length: 6, isNull: false}),
        () => ({type: IonTypes["nop"], length: 7, isNull: false}),
        () => ({type: IonTypes["nop"], length: 8, isNull: false}),
        () => ({type: IonTypes["nop"], length: 9, isNull: false}),
        () => ({type: IonTypes["nop"], length: 10, isNull: false}),
        () => ({type: IonTypes["nop"], length: 11, isNull: false}),
        () => ({type: IonTypes["nop"], length: 12, isNull: false}),
        () => ({type: IonTypes["nop"], length: 13, isNull: false}),
        () => ({type: IonTypes["nop"], length: 14, isNull: false}),
        () => ({type: IonTypes["null"], length: 0, isNull: true}),
        () => ({type: IonTypes["bool"], length: 0, isNull: false, bool: false}),
        () => ({type: IonTypes["bool"], length: 0, isNull: false, bool: true}),
        () => this.#typeDescriptorError("0x12"),
        () => this.#typeDescriptorError("0x13"),
        () => this.#typeDescriptorError("0x14"),
        () => this.#typeDescriptorError("0x15"),
        () => this.#typeDescriptorError("0x16"),
        () => this.#typeDescriptorError("0x17"),
        () => this.#typeDescriptorError("0x18"),
        () => this.#typeDescriptorError("0x19"),
        () => this.#typeDescriptorError("0x1a"),
        () => this.#typeDescriptorError("0x1b"),
        () => this.#typeDescriptorError("0x1c"),
        () => this.#typeDescriptorError("0x1d"),
        () => this.#typeDescriptorError("0x1e"),
        () => ({type: IonTypes["bool"], length: 0, isNull: true}),
        () => ({type: IonTypes["int+"], length: 0, isNull: false}),
        () => ({type: IonTypes["int+"], length: 1, isNull: false}),
        () => ({type: IonTypes["int+"], length: 2, isNull: false}),
        () => ({type: IonTypes["int+"], length: 3, isNull: false}),
        () => ({type: IonTypes["int+"], length: 4, isNull: false}),
        () => ({type: IonTypes["int+"], length: 5, isNull: false}),
        () => ({type: IonTypes["int+"], length: 6, isNull: false}),
        () => ({type: IonTypes["int+"], length: 7, isNull: false}),
        () => ({type: IonTypes["int+"], length: 8, isNull: false}),
        () => ({type: IonTypes["int+"], length: 9, isNull: false}),
        () => ({type: IonTypes["int+"], length: 10, isNull: false}),
        () => ({type: IonTypes["int+"], length: 11, isNull: false}),
        () => ({type: IonTypes["int+"], length: 12, isNull: false}),
        () => ({type: IonTypes["int+"], length: 13, isNull: false}),
        () => ({type: IonTypes["int+"], length: 14, isNull: false}),
        () => ({type: IonTypes["int+"], length: 0, isNull: true}),
        () => this.#typeDescriptorError("0x30"),
        () => ({type: IonTypes["int-"], length: 1, isNull: false}),
        () => ({type: IonTypes["int-"], length: 2, isNull: false}),
        () => ({type: IonTypes["int-"], length: 3, isNull: false}),
        () => ({type: IonTypes["int-"], length: 4, isNull: false}),
        () => ({type: IonTypes["int-"], length: 5, isNull: false}),
        () => ({type: IonTypes["int-"], length: 6, isNull: false}),
        () => ({type: IonTypes["int-"], length: 7, isNull: false}),
        () => ({type: IonTypes["int-"], length: 8, isNull: false}),
        () => ({type: IonTypes["int-"], length: 9, isNull: false}),
        () => ({type: IonTypes["int-"], length: 10, isNull: false}),
        () => ({type: IonTypes["int-"], length: 11, isNull: false}),
        () => ({type: IonTypes["int-"], length: 12, isNull: false}),
        () => ({type: IonTypes["int-"], length: 13, isNull: false}),
        () => ({type: IonTypes["int-"], length: 14, isNull: false}),
        () => ({type: IonTypes["int-"], length: 0, isNull: true}),
        () => ({type: IonTypes["float"], length: 0, isNull: false}),
        () => this.#typeDescriptorError("0x41"),
        () => this.#typeDescriptorError("0x42"),
        () => this.#typeDescriptorError("0x43"),
        () => ({type: IonTypes["float"], length: 4, isNull: false}),
        () => this.#typeDescriptorError("0x45"),
        () => this.#typeDescriptorError("0x46"),
        () => this.#typeDescriptorError("0x47"),
        () => ({type: IonTypes["float"], length: 8, isNull: false}),
        () => this.#typeDescriptorError("0x49"),
        () => this.#typeDescriptorError("0x4a"),
        () => this.#typeDescriptorError("0x4b"),
        () => this.#typeDescriptorError("0x4c"),
        () => this.#typeDescriptorError("0x4d"),
        () => this.#typeDescriptorError("0x4e"),
        () => ({type: IonTypes["float"], length: 0, isNull: true}),
        () => ({type: IonTypes["decimal"], length: 0, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 1, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 2, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 3, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 4, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 5, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 6, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 7, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 8, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 9, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 10, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 11, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 12, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 13, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 14, isNull: false}),
        () => ({type: IonTypes["decimal"], length: 0, isNull: true}),
        () => this.#typeDescriptorError("0x60"),
        () => this.#typeDescriptorError("0x61"),
        () => ({type: IonTypes["timestamp"], length: 2, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 3, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 4, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 5, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 6, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 7, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 8, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 9, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 10, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 11, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 12, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 13, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 14, isNull: false}),
        () => ({type: IonTypes["timestamp"], length: 0, isNull: true}),
        () => ({type: IonTypes["symbol"], length: 0, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 1, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 2, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 3, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 4, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 5, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 6, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 7, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 8, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 9, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 10, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 11, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 12, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 13, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 14, isNull: false}),
        () => ({type: IonTypes["symbol"], length: 0, isNull: true}),
        () => ({type: IonTypes["string"], length: 0, isNull: false}),
        () => ({type: IonTypes["string"], length: 1, isNull: false}),
        () => ({type: IonTypes["string"], length: 2, isNull: false}),
        () => ({type: IonTypes["string"], length: 3, isNull: false}),
        () => ({type: IonTypes["string"], length: 4, isNull: false}),
        () => ({type: IonTypes["string"], length: 5, isNull: false}),
        () => ({type: IonTypes["string"], length: 6, isNull: false}),
        () => ({type: IonTypes["string"], length: 7, isNull: false}),
        () => ({type: IonTypes["string"], length: 8, isNull: false}),
        () => ({type: IonTypes["string"], length: 9, isNull: false}),
        () => ({type: IonTypes["string"], length: 10, isNull: false}),
        () => ({type: IonTypes["string"], length: 11, isNull: false}),
        () => ({type: IonTypes["string"], length: 12, isNull: false}),
        () => ({type: IonTypes["string"], length: 13, isNull: false}),
        () => ({type: IonTypes["string"], length: 14, isNull: false}),
        () => ({type: IonTypes["string"], length: 0, isNull: true}),
        () => ({type: IonTypes["clob"], length: 0, isNull: false}),
        () => ({type: IonTypes["clob"], length: 1, isNull: false}),
        () => ({type: IonTypes["clob"], length: 2, isNull: false}),
        () => ({type: IonTypes["clob"], length: 3, isNull: false}),
        () => ({type: IonTypes["clob"], length: 4, isNull: false}),
        () => ({type: IonTypes["clob"], length: 5, isNull: false}),
        () => ({type: IonTypes["clob"], length: 6, isNull: false}),
        () => ({type: IonTypes["clob"], length: 7, isNull: false}),
        () => ({type: IonTypes["clob"], length: 8, isNull: false}),
        () => ({type: IonTypes["clob"], length: 9, isNull: false}),
        () => ({type: IonTypes["clob"], length: 10, isNull: false}),
        () => ({type: IonTypes["clob"], length: 11, isNull: false}),
        () => ({type: IonTypes["clob"], length: 12, isNull: false}),
        () => ({type: IonTypes["clob"], length: 13, isNull: false}),
        () => ({type: IonTypes["clob"], length: 14, isNull: false}),
        () => ({type: IonTypes["clob"], length: 0, isNull: true}),
        () => ({type: IonTypes["blob"], length: 0, isNull: false}),
        () => ({type: IonTypes["blob"], length: 1, isNull: false}),
        () => ({type: IonTypes["blob"], length: 2, isNull: false}),
        () => ({type: IonTypes["blob"], length: 3, isNull: false}),
        () => ({type: IonTypes["blob"], length: 4, isNull: false}),
        () => ({type: IonTypes["blob"], length: 5, isNull: false}),
        () => ({type: IonTypes["blob"], length: 6, isNull: false}),
        () => ({type: IonTypes["blob"], length: 7, isNull: false}),
        () => ({type: IonTypes["blob"], length: 8, isNull: false}),
        () => ({type: IonTypes["blob"], length: 9, isNull: false}),
        () => ({type: IonTypes["blob"], length: 10, isNull: false}),
        () => ({type: IonTypes["blob"], length: 11, isNull: false}),
        () => ({type: IonTypes["blob"], length: 12, isNull: false}),
        () => ({type: IonTypes["blob"], length: 13, isNull: false}),
        () => ({type: IonTypes["blob"], length: 14, isNull: false}),
        () => ({type: IonTypes["blob"], length: 0, isNull: true}),
        () => ({type: IonTypes["list"], length: 0, isNull: false}),
        () => ({type: IonTypes["list"], length: 1, isNull: false}),
        () => ({type: IonTypes["list"], length: 2, isNull: false}),
        () => ({type: IonTypes["list"], length: 3, isNull: false}),
        () => ({type: IonTypes["list"], length: 4, isNull: false}),
        () => ({type: IonTypes["list"], length: 5, isNull: false}),
        () => ({type: IonTypes["list"], length: 6, isNull: false}),
        () => ({type: IonTypes["list"], length: 7, isNull: false}),
        () => ({type: IonTypes["list"], length: 8, isNull: false}),
        () => ({type: IonTypes["list"], length: 9, isNull: false}),
        () => ({type: IonTypes["list"], length: 10, isNull: false}),
        () => ({type: IonTypes["list"], length: 11, isNull: false}),
        () => ({type: IonTypes["list"], length: 12, isNull: false}),
        () => ({type: IonTypes["list"], length: 13, isNull: false}),
        () => ({type: IonTypes["list"], length: 14, isNull: false}),
        () => ({type: IonTypes["list"], length: 0, isNull: true}),
        () => ({type: IonTypes["sexp"], length: 0, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 1, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 2, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 3, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 4, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 5, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 6, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 7, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 8, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 9, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 10, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 11, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 12, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 13, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 14, isNull: false}),
        () => ({type: IonTypes["sexp"], length: 0, isNull: true}),
        () => ({type: IonTypes["struct"], length: 0, isNull: false}),
        () => ({type: IonTypes["struct"], length: 14, isNull: false}),
        () => ({type: IonTypes["struct"], length: 2, isNull: false}),
        () => ({type: IonTypes["struct"], length: 3, isNull: false}),
        () => ({type: IonTypes["struct"], length: 4, isNull: false}),
        () => ({type: IonTypes["struct"], length: 5, isNull: false}),
        () => ({type: IonTypes["struct"], length: 6, isNull: false}),
        () => ({type: IonTypes["struct"], length: 7, isNull: false}),
        () => ({type: IonTypes["struct"], length: 8, isNull: false}),
        () => ({type: IonTypes["struct"], length: 9, isNull: false}),
        () => ({type: IonTypes["struct"], length: 10, isNull: false}),
        () => ({type: IonTypes["struct"], length: 11, isNull: false}),
        () => ({type: IonTypes["struct"], length: 12, isNull: false}),
        () => ({type: IonTypes["struct"], length: 13, isNull: false}),
        () => ({type: IonTypes["struct"], length: 14, isNull: false}),
        () => ({type: IonTypes["struct"], length: 0, isNull: true}),
        () => ({type: IonTypes["bvm"], length: 3, isNull: false}),
        () => this.#typeDescriptorError("0xe1"),
        () => this.#typeDescriptorError("0xe2"),
        () => ({type: IonTypes["annotation"], length: 3, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 4, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 5, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 6, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 7, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 8, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 9, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 10, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 11, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 12, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 13, isNull: false}),
        () => ({type: IonTypes["annotation"], length: 14, isNull: false}),
        () => this.#typeDescriptorError("0xef"),
        () => this.#typeDescriptorError("0xf0"),
        () => this.#typeDescriptorError("0xf1"),
        () => this.#typeDescriptorError("0xf2"),
        () => this.#typeDescriptorError("0xf3"),
        () => this.#typeDescriptorError("0xf4"),
        () => this.#typeDescriptorError("0xf5"),
        () => this.#typeDescriptorError("0xf6"),
        () => this.#typeDescriptorError("0xf7"),
        () => this.#typeDescriptorError("0xf8"),
        () => this.#typeDescriptorError("0xf9"),
        () => this.#typeDescriptorError("0xfa"),
        () => this.#typeDescriptorError("0xfb"),
        () => this.#typeDescriptorError("0xfc"),
        () => this.#typeDescriptorError("0xfd"),
        () => this.#typeDescriptorError("0xfe"),
        () => this.#typeDescriptorError("0xff")
      ];
      #byteReader;
      #varUIntLengthByte;
      #defaultErrorHandler = (errorDescription) => {
        throw new Error(errorDescription);
      };
      #errorHandler = this.#defaultErrorHandler;
      #typeDescriptorError = (hexString) => {
        this.#errorHandler(`Invalid Ion T/L pair ${hexString}.`);
      };
      constructor(byteReader) {
        if (!(byteReader instanceof br.ByteReader)) {
          this.#errorHandler("TypeDescriptorReader expected byteReader to be a ByteReader.");
        }
        this.#byteReader = byteReader;
      }
      readTypeAndLength(positionToSet) {
        this.#byteReader.setPosition(positionToSet);
        let typeAndLengthByte = this.#byteReader.nextByte();
        if (typeAndLengthByte === null) {
          return null;
        }
        if (typeAndLengthByte === void 0) {
          this.errorHandler(`typeAndLengthyByte is undefined`);
        }
        let typeAndLength = this.#typeDescriptor[typeAndLengthByte]();
        if (typeAndLength.length === 14) {
          let varUIntInfo = this.#byteReader.readVarUInt(this.#errorHandler);
          if (varUIntInfo === null) {
            this.#byteReader.skipBytes(-1);
            return null;
          }
          typeAndLength.length = varUIntInfo.numBytesRead + varUIntInfo.magnitude;
          typeAndLength.varUIntLength = varUIntInfo.numBytesRead;
          typeAndLength.isVarUInt = true;
          if (typeAndLengthByte === 209) {
            typeAndLength.isSortedStruct = true;
          }
        }
        if (typeAndLength.type === IonTypes.annotation) {
          let varUIntInfo = this.#byteReader.readVarUInt(this.#errorHandler);
          if (varUIntInfo === null) {
            if (typeAndLength.varUIntLength !== void 0) {
              this.#byteReader.skipBytes(-1 * (1 + typeAndLength.varUIntLength));
            } else {
              this.#byteReader.skipBytes(-1);
            }
            return null;
          }
          typeAndLength.annotationsLength = varUIntInfo.magnitude;
          typeAndLength.annotationsVarUIntLength = varUIntInfo.numBytesRead;
        }
        return typeAndLength;
      }
      readFieldName(positionToSet) {
        this.#byteReader.setPosition(positionToSet);
        return this.#byteReader.readVarUInt(this.#errorHandler);
      }
      setPosition(positionToSet) {
        this.#byteReader.setPosition(positionToSet);
      }
      setErrorHandler(errorHandlerFn) {
        if (typeof errorHandler !== "function") {
          this.#errorHandler(`TypeDescriptorReader setErrorHandler passed a ${typeof errorHandlerFn} instead of function.`);
        }
        this.#errorHandler = errorHandlerFn;
      }
    };
    exports.TypeDescriptorReader = TypeDescriptorReader;
  });

  // src/core/ScalarValueReader.js
  var require_ScalarValueReader = __commonJS((exports) => {
    "use strict";
    var br = require_ByteReader();
    var IonTypes = require_IonTypes().IonTypes;
    var utilities = require_ReaderUtilities();
    var ScalarValueReader = class {
      #textDecoder;
      #byteReader;
      #readInt = function(position, length, br2, errorHandler2) {
        br2.setPosition(position);
        let value = br2.readUInt(length, errorHandler2).magnitude;
        if (length > 3 && value === 0n || value === 0) {
        }
        return value;
      };
      #readNegativeInt = function(position, length, br2, errorHandler2) {
        br2.setPosition(position);
        let value = br2.readUInt(length, errorHandler2).magnitude;
        if (length > 3 && value === 0n || value === 0) {
          errorHandler2("readNegativeInt() zero not a valid negative int value.");
        }
        return -value;
      };
      #readFloat = function(position, length, br2, errorHandler2) {
        if (length !== 0 && length !== 4 && length !== 8 && length !== 15) {
          errorHandler2(`ScalarValueReader illegal float length ${length}.`);
        }
        let buffer = new Uint8Array(length);
        br2.setPosition(position);
        for (let i = 0; i < length; ++i) {
          buffer[i] = br2.nextByte();
          if (buffer[i] === null) {
            br2.skipBytes(-1 * i);
            return null;
          }
        }
        let tempBuf;
        switch (length) {
          case 0:
            return 0;
          case 4:
            tempBuf = new DataView(buffer.buffer);
            return tempBuf.getFloat32(0, false);
          case 8:
            tempBuf = new DataView(buffer.buffer);
            return tempBuf.getFloat64(0, false);
          case 15:
            return null;
          default:
        }
      };
      #readDecimal = function(position, length, br2, errorHandler2) {
        br2.setPosition(position);
        let exponent = br2.readVarInt(errorHandler2);
        if (exponent === null) {
          return null;
        }
        let coefficientLength = length - exponent.numBytesRead;
        let coefficient;
        if (coefficientLength < 0) {
          errorHandler2(`ScalarValueReader illegal coefficient length.`);
        }
        if (coefficientLength === 0) {
          coefficient = {magnitude: 0, numBytesRead: 0, isNegative: false};
        } else {
          coefficient = br2.readInt(coefficientLength, errorHandler2);
          if (coefficient === null) {
            br2.skipBytes(-1 * exponent.numBytesRead);
            return null;
          }
          if (coefficient.isNegative === false && (coefficient.magnitude === 0 || coefficient.magnitude === 0n)) {
          }
        }
        return {exponent, coefficient};
      };
      #readTimestamp = function(position, length, br2, errorHandler2) {
        br2.setPosition(position);
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
        offset = br2.readVarInt(errorHandler2);
        if (offset === null) {
          return null;
        }
        remainingLength -= offset.numBytesRead;
        year = br2.readVarUInt(errorHandler2);
        if (year === null) {
          br2.skipBytes(-1 * (length - remainingLength));
          return null;
        }
        remainingLength -= year.numBytesRead;
        if (remainingLength > 0) {
          month = br2.readVarUInt(errorHandler2);
          if (month === null) {
            br2.skipBytes(-1 * (length - remainingLength));
            return null;
          }
          remainingLength -= month.numBytesRead;
        }
        if (remainingLength > 0) {
          day = br2.readVarUInt(errorHandler2);
          if (day === null) {
            br2.skipBytes(-1 * (length - remainingLength));
            return null;
          }
          remainingLength -= day.numBytesRead;
        }
        if (remainingLength > 0) {
          hour = br2.readVarUInt(errorHandler2);
          if (hour === null) {
            br2.skipBytes(-1 * (length - remainingLength));
            return null;
          }
          remainingLength -= hour.numBytesRead;
          if (remainingLength > 0) {
            minute = br2.readVarUInt(errorHandler2);
            if (minute === null) {
              br2.skipBytes(-1 * (length - remainingLength));
              return null;
            }
            remainingLength -= minute.numBytesRead;
          } else {
            errorHandler2(`ScalarValueReader hours present without minutes.`);
          }
        }
        if (remainingLength > 0) {
          second = br2.readVarUInt(errorHandler2);
          if (second === null) {
            br2.skipBytes(-1 * (length - remainingLength));
            return null;
          }
          remainingLength -= second.numBytesRead;
        }
        if (remainingLength > 0) {
          fractionExponent = br2.readVarInt(errorHandler2);
          if (fractionExponent === null) {
            br2.skipBytes(-1 * (length - remainingLength));
            return null;
          }
          remainingLength -= fractionExponent.numBytesRead;
        }
        if (remainingLength > 0) {
          fractionCoefficient = br2.readInt(remainingLength, errorHandler2);
          if (fractionCoefficient === null) {
            br2.skipBytes(-1 * (length - remainingLength));
            return null;
          }
        } else if (fractionExponent !== void 0) {
          fractionCoefficient = {numBytesRead: 0, magnitude: 0, isNegative: false};
        }
        return {
          offset,
          year,
          month,
          day,
          hour,
          minute,
          second,
          fractionExponent,
          fractionCoefficient
        };
      };
      #readSymbol = function(position, length, br2, errorHandler2) {
        if (length < 1) {
          return 0;
        }
        br2.setPosition(position);
        let symbol = br2.readUInt(length, errorHandler2);
        if (symbol === null) {
          return null;
        }
        return symbol.magnitude;
      };
      #readString = function(position, length, br2, errorHandler2) {
        let bytes = new Uint8Array(length);
        br2.setPosition(position);
        for (let i = 0; i < length; ++i) {
          bytes[i] = br2.nextByte();
          if (bytes[i] === null) {
            br2.skipBytes(-1 * i);
            return null;
          }
        }
        return this.#textDecoder.decode(bytes);
      };
      #readClob = function(position, length, br2) {
        let buffer = new Uint8Array(length);
        br2.setPosition(position);
        for (let i = 0; i < length; ++i) {
          buffer[i] = br2.nextByte();
          if (buffer[i] === null) {
            br2.skipBytes(-1 * i);
            return null;
          }
        }
        return buffer;
      };
      #readBlob = function(position, length, br2) {
        let buffer = new Uint8Array(length);
        br2.setPosition(position);
        for (let i = 0; i < length; ++i) {
          buffer[i] = br2.nextByte();
          if (buffer[i] === null) {
            br2.skipBytes(-1 * i);
            return null;
          }
        }
        return buffer;
      };
      #defaultErrorHandler = (errorDescription) => {
        throw new Error(errorDescription);
      };
      #readScalarFuncs;
      #errorHandler = this.#defaultErrorHandler;
      constructor(byteReader) {
        if (!(byteReader instanceof br.ByteReader)) {
          this.#errorHandler("ScalarValueReader expected byteReader to be a ByteReader.");
        }
        this.#byteReader = byteReader;
        this.#textDecoder = new TextDecoder("utf-8");
        let self = this;
        this.#readScalarFuncs = new Array(IonTypes.numTypes);
        for (let i = 0; i < IonTypes.numTypes; ++i) {
          this.#readScalarFuncs[i] = function(position, length) {
            self.#errorHandler(`ScalarValueReader called on ${IonTypes.nameFromType(i)}, a non-scalar.`);
          };
        }
        this.#readScalarFuncs[IonTypes["int+"]] = this.#readInt;
        this.#readScalarFuncs[IonTypes["int-"]] = this.#readNegativeInt;
        this.#readScalarFuncs[IonTypes["float"]] = this.#readFloat;
        this.#readScalarFuncs[IonTypes["decimal"]] = this.#readDecimal;
        this.#readScalarFuncs[IonTypes["timestamp"]] = this.#readTimestamp;
        this.#readScalarFuncs[IonTypes["symbol"]] = this.#readSymbol;
        this.#readScalarFuncs[IonTypes["string"]] = this.#readString;
        this.#readScalarFuncs[IonTypes["clob"]] = this.#readClob;
        this.#readScalarFuncs[IonTypes["blob"]] = this.#readBlob;
      }
      read(type, position, length) {
        if (this.#readScalarFuncs[type] === void 0) {
          this.#errorHandler(`ScalarValueReader read() called with non-existant type ${type}.`);
        }
        if (!Number.isInteger(position) || position < 0) {
          this.#errorHandler(`ScalarValueReader read() called with invalid position ${position}.`);
        }
        if (!Number.isInteger(length) || length <= 0) {
          this.#errorHandler(`ScalarValueReader read() called with invalid length ${length}.`);
        }
        return this.#readScalarFuncs[type].apply(this, [position, length, this.#byteReader, this.#errorHandler]);
      }
      setErrorHandler(errorHandlerFn) {
        if (typeof errorHandler !== "function") {
          this.#errorHandler(`ScalarValueReader setErrorHandler passed a ${typeof errorHandlerFn} instead of function.`);
        }
        this.#errorHandler = errorHandlerFn;
      }
    };
    exports.ScalarValueReader = ScalarValueReader;
  });

  // src/core/IonElement.js
  var require_IonElement = __commonJS((exports) => {
    "use strict";
    var IonTypes = require_IonTypes().IonTypes;
    var IonElement = class {
      #type;
      #isNull;
      #depth;
      #annotations;
      #fieldNameSymbolID;
      #isLocalSymbolTable = false;
      #isSharedSymbolTable = false;
      #length = 0;
      #varUIntLength = 0;
      #lengthWithoutAnnotations = 0;
      #varUIntLengthWithAnnotations = 0;
      #annotationsLength = 0;
      #annotationsVarUIntLength = 0;
      #positionInStream = 0;
      #bytesRemainingAtDepth = 0;
      #fieldNameVarUIntLength = 0;
      #container = null;
      #containerType = null;
      #previous = null;
      #contains = null;
      #next = null;
      #boolRepresentation = null;
      #isSystemElement = false;
      #isSorted = false;
      #firstAnnotation = null;
      #clear = () => {
        this.#type = void 0;
        this.#isNull = void 0;
        this.#depth = void 0;
        this.#annotations = void 0;
        this.#fieldNameSymbolID = void 0;
        this.#isLocalSymbolTable = false;
        this.#isSharedSymbolTable = false;
        this.#length = 0;
        this.#varUIntLength = 0;
        this.#lengthWithoutAnnotations = 0;
        this.#varUIntLengthWithAnnotations = 0;
        this.#annotationsLength = 0;
        this.#annotationsVarUIntLength = 0;
        this.#positionInStream = 0;
        this.#bytesRemainingAtDepth = 0;
        this.#fieldNameVarUIntLength = 0;
        this.#container = null;
        this.#containerType = null;
        this.#previous = null;
        this.#contains = null;
        this.#next = null;
        this.#boolRepresentation = null;
        this.#isSystemElement = false;
        this.#isSorted = false;
      };
      #initialize = (positionInStream, depth, bytesRemainingAtDepth, container, containerType, previous) => {
        if (Number.isInteger(positionInStream) && positionInStream >= 0) {
          this.#positionInStream = positionInStream;
        } else {
          throw new Error(`IonElement initialize passed invalid positionInStream ${positionInStream}.`);
        }
        if (Number.isInteger(depth) && depth >= 0) {
          this.#depth = depth;
        } else {
          throw new Error(`IonElement initialize passed invalid depth ${depth}.`);
        }
        if (Number.isInteger(bytesRemainingAtDepth) && bytesRemainingAtDepth >= 0) {
          this.#bytesRemainingAtDepth = bytesRemainingAtDepth;
        } else {
          throw new Error(`IonElement initialize passed invalid bytesRemainingAtDepth ${bytesRemainingAtDepth}.`);
        }
        if (Number.isInteger(container) && container >= 0) {
          this.#container = container;
        } else if (container === void 0 || container === null) {
          this.#container = null;
        } else {
          throw new Error(`IonElement initialize passed invalid container ${container}.`);
        }
        if (Number.isInteger(containerType) && containerType >= 0) {
          this.#containerType = containerType;
        } else if (containerType === void 0 || containerType === null) {
          this.#containerType = null;
        } else {
          throw new Error(`IonElement initialize passed invalid containerType ${containerType}.`);
        }
        if (Number.isInteger(previous) && previous >= 0) {
          this.#previous = previous;
        } else if (previous === void 0 || previous === null) {
          this.#previous = null;
        } else {
          throw new Error(`IonElement initialize passed invalid previous ${previous}.`);
        }
        this.#annotations = [];
      };
      constructor(positionInStream, depth, bytesRemainingAtDepth, container, containerType, previous) {
        this.#initialize(positionInStream, depth, bytesRemainingAtDepth, container, containerType, previous);
      }
      toString() {
        return `{ #type: ${this.#type}, 
              #isSystemElement: ${this.#isSystemElement},
              #isNull: ${this.#isNull},
              #isLocalSymbolTable: ${this.#isLocalSymbolTable},
              #isSharedSymbolTable: ${this.#isSharedSymbolTable},
              #depth: ${this.#depth},
              #annotations: ${this.#annotations},
              #length: ${this.#length},
              #varUIntLength: ${this.#varUIntLength},
              #fieldNameVarUIntLength: ${this.#fieldNameVarUIntLength},
              #fieldNameSymbolID: ${this.#fieldNameSymbolID},
              #annotationsLength: ${this.#annotationsLength},
              #annotationsVarUIntLength: ${this.#annotationsVarUIntLength},
              #lengthWithoutAnnotations: ${this.#lengthWithoutAnnotations},
              #positionInStream: ${this.#positionInStream},
              #bytesRemainingAtDepth: ${this.#bytesRemainingAtDepth},
              #container: ${this.#container},
              #containerType: ${this.#containerType},
              #contains: ${this.#contains},
              #next: ${this.#next},
              #previous: ${this.#previous},
              bytePositionOfRepresentation: ${this.bytePositionOfRepresentation},
              isContainer: ${this.isContainer},
              positionInStream: ${this.positionInStream} }`;
      }
      repurpose(positionInStream, depth, bytesRemainingAtDepth, container, containerType, previous) {
        this.#clear();
        this.#initialize(positionInStream, depth, bytesRemainingAtDepth, container, containerType, previous);
      }
      readTypeDescriptor(typeReader) {
        if (this.#bytesRemainingAtDepth <= 0) {
          throw new Error(`readTypeDescriptor called with invalid bytesRemainingAtDepth ${this.#bytesRemainingAtDepth}`);
        }
        let position = this.#positionInStream;
        let fieldNameInfo = void 0;
        if (this.#container !== null && this.#containerType === IonTypes["struct"]) {
          fieldNameInfo = typeReader.readFieldName(position);
          if (fieldNameInfo === null) {
            return null;
          }
          position += fieldNameInfo.numBytesRead;
        }
        let currentType = typeReader.readTypeAndLength(position);
        if (currentType === null) {
          typeReader.setPosition(this.#positionInStream);
          return null;
        }
        this.#length = currentType.length || 0;
        let annotationInfo = void 0;
        if (currentType.type === IonTypes["annotation"]) {
          annotationInfo = currentType;
          if (!Number.isInteger(annotationInfo.annotationsVarUIntLength) || !Number.isInteger(annotationInfo.annotationsLength)) {
            throw new Error("Annotation missing 'annot_length' field data.");
          }
          if (annotationInfo.annotationsLength === 0) {
            throw new Error("'annot_length' field must be greater than zero.");
          }
          let annotationsLengthRemaining = annotationInfo.annotationsLength;
          let annotationPosition = position + 1 + (annotationInfo.varUIntLength || 0) + annotationInfo.annotationsVarUIntLength;
          let annotation;
          do {
            annotation = typeReader.readFieldName(annotationPosition);
            if (annotation === null) {
              typeReader.setPosition(this.#positionInStream);
              return null;
            }
            this.#annotations.push(annotation);
            annotationPosition += annotation.numBytesRead;
            annotationsLengthRemaining -= annotation.numBytesRead;
          } while (annotationsLengthRemaining > 0);
          let firstAnnotation = this.#annotations[0];
          let valuePosition = position + 1 + (annotationInfo.varUIntLength || 0) + annotationInfo.annotationsVarUIntLength + annotationInfo.annotationsLength;
          currentType = typeReader.readTypeAndLength(valuePosition);
          if (currentType === null) {
            typeReader.setPosition(this.#positionInStream);
            return null;
          }
          if (currentType.type === IonTypes["annotation"]) {
            throw new Error("Annotations cannot wrap annotations.");
          } else if (currentType.type === IonTypes["nop"]) {
            throw new Error("Annotations cannot wrap nop.");
          }
          if (firstAnnotation.magnitude === 3 || firstAnnotation.magnitude === 9) {
            if (this.#depth > 0) {
              throw new Error("Symbol table annotation is not at depth 0.");
            }
            if (currentType.type !== IonTypes["struct"]) {
              throw new Error("Symbol table annotation is not wrapping struct.");
            }
            if (firstAnnotation.magnitude === 3) {
              this.#isLocalSymbolTable = true;
            } else {
              this.#isSharedSymbolTable = true;
            }
            this.#firstAnnotation = firstAnnotation;
            this.#isSystemElement = true;
          }
          currentType.annotationsVarUIntLength = annotationInfo.annotationsVarUIntLength;
          currentType.annotationsLength = annotationInfo.annotationsLength;
          currentType.varUIntLengthWithAnnotations = annotationInfo.varUIntLength;
        }
        if (currentType.type === IonTypes["bvm"]) {
          if (this.#depth !== 0) {
            throw new Error(`BVM encountered at depth ${this.#depth}`);
          }
          this.#isSystemElement = true;
        }
        if (currentType.type === IonTypes["nop"]) {
          this.#isSystemElement = true;
        }
        if (currentType.type === IonTypes["struct"] && currentType.isSortedStruct) {
          this.#isSorted = true;
          if (currentType.length - currentType.varUIntLength === 0) {
            throw new Error(`Sorted struct with no length.`);
          }
        }
        currentType.lengthWithoutAnnotations = currentType.length;
        this.#type = currentType.type;
        this.#isNull = currentType.isNull;
        this.#varUIntLength = currentType.varUIntLength || 0;
        this.#annotationsLength = currentType.annotationsLength || 0;
        this.#annotationsVarUIntLength = currentType.annotationsVarUIntLength || 0;
        this.#lengthWithoutAnnotations = currentType.lengthWithoutAnnotations || 0;
        this.#varUIntLengthWithAnnotations = currentType.varUIntLengthWithAnnotations || 0;
        if (fieldNameInfo) {
          this.#fieldNameSymbolID = fieldNameInfo.magnitude;
          this.#fieldNameVarUIntLength = fieldNameInfo.numBytesRead;
        }
        if (this.#type === IonTypes["bool"]) {
          this.#boolRepresentation = currentType.bool;
        }
        let totalLength = 1 + this.#length + this.#fieldNameVarUIntLength;
        if (IonTypes.isContainer(this.#type) && this.#lengthWithoutAnnotations !== 0 && this.#isNull === false) {
          this.#contains = [
            this.bytePositionOfRepresentation,
            this.#depth + 1,
            totalLength - (this.bytePositionOfRepresentation - this.#positionInStream),
            this.positionInStream,
            this.#type,
            null
          ];
        }
        let newBytesRemaining = this.#bytesRemainingAtDepth - totalLength;
        if (newBytesRemaining > 0) {
          this.#next = [
            this.#positionInStream + totalLength,
            this.#depth,
            newBytesRemaining,
            this.#container,
            this.#containerType,
            this.positionInStream
          ];
        } else if (newBytesRemaining < 0) {
          typeReader.setPosition(this.#positionInStream);
          return null;
        } else {
        }
        let padding = "";
        for (let i = 0; i < this.#depth; ++i) {
          padding += "  ";
        }
      }
      get bytePositionOfRepresentation() {
        if (this.#type === IonTypes["bvm"] || this.#type === IonTypes["nop"]) {
          return null;
        }
        if (this.#lengthWithoutAnnotations === 0) {
          return null;
        }
        if (this.#isNull) {
          return null;
        }
        return this.#positionInStream + this.#fieldNameVarUIntLength + (this.#annotationsLength > 0 ? 1 + this.#varUIntLengthWithAnnotations + this.#annotationsVarUIntLength + this.#annotationsLength : 0) + 1 + this.#varUIntLength;
      }
      get bytePositionOfAnnotations() {
        if (!(this.#annotationsLength > 0)) {
          return null;
        }
        return this.#positionInStream + (this.#fieldNameVarUIntLength + 1 + this.#varUIntLengthWithAnnotations + this.#annotationsVarUIntLength);
      }
      get isContainer() {
        return IonTypes.isContainer(this.#type);
      }
      get isScalar() {
        return IonTypes.isScalar(this.#type);
      }
      get isNull() {
        return this.#isNull;
      }
      get containsElement() {
        return this.#contains;
      }
      get nextElement() {
        return this.#next;
      }
      get previousElement() {
        return this.#previous;
      }
      get positionInStream() {
        return this.#positionInStream;
      }
      get depth() {
        return this.#depth;
      }
      get container() {
        return this.#container;
      }
      get containerType() {
        return this.#containerType;
      }
      get totalLength() {
        return this.#fieldNameVarUIntLength + 1 + this.#length;
      }
      get length() {
        return this.#length;
      }
      get lengthWithoutAnnotations() {
        return this.#lengthWithoutAnnotations;
      }
      get type() {
        return this.#type;
      }
      get fieldNameSymbolID() {
        return this.#fieldNameSymbolID;
      }
      get annotations() {
        return this.#annotations;
      }
      get annotationsLength() {
        return this.#annotationsLength;
      }
      get annotationsVarUIntLength() {
        return this.#annotationsVarUIntLength;
      }
      get varUIntLengthWithAnnotations() {
        return this.#varUIntLengthWithAnnotations;
      }
      get varUIntLength() {
        return this.#varUIntLength;
      }
      get boolRepresentation() {
        return this.#boolRepresentation;
      }
      get isSystemElement() {
        return this.#isSystemElement;
      }
      get isSorted() {
        return this.#isSorted;
      }
      get isLocalSymbolTable() {
        return this.#isLocalSymbolTable;
      }
      get isSharedSymbolTable() {
        return this.#isSharedSymbolTable;
      }
      get firstAnnotation() {
        return this.#firstAnnotation;
      }
      get bytesRemainingAtDepth() {
        return this.#bytesRemainingAtDepth;
      }
      get fieldNameVarUIntLength() {
        return this.#fieldNameVarUIntLength;
      }
      get nibblePositionStruct() {
        let struct = {};
        let position = 0;
        struct.offset = this.#positionInStream;
        struct.depth = this.depth;
        struct.totalNibbles = this.totalLength * 2;
        if (this.#fieldNameSymbolID === void 0) {
          struct.fieldName = null;
        } else {
          let fieldNameStruct = {};
          fieldNameStruct.symbolMagnitude = this.fieldNameSymbolID;
          fieldNameStruct.nibbles = {};
          fieldNameStruct.nibbles.symbolStart = position;
          fieldNameStruct.nibbles.symbolEnd = position + this.fieldNameVarUIntLength * 2 - 1;
          struct.fieldName = fieldNameStruct;
          position = fieldNameStruct.nibbles.symbolEnd + 1;
        }
        if (this.annotationsLength === 0) {
          struct.annotation = {};
        } else {
          let annotationStruct = {};
          let nibbles2 = {};
          nibbles2.type = position;
          position += 1;
          nibbles2.wrapperLengthStart = position;
          nibbles2.wrapperLengthEnd = position + this.#varUIntLengthWithAnnotations * 2;
          position = nibbles2.wrapperLengthEnd + 1;
          nibbles2.annotationsLengthStart = position;
          nibbles2.annotationsLengthEnd = position + this.#annotationsVarUIntLength * 2 - 1;
          position = nibbles2.annotationsLengthEnd + 1;
          annotationStruct.wrapperLengthValue = this.#length;
          annotationStruct.lengthValue = this.annotationsLength;
          let annotationList = [];
          for (let i = 0; i < this.annotations.length; ++i) {
            let annotation = {};
            annotation.nibbles = {};
            annotation.nibbles.symbolStart = position;
            annotation.nibbles.symbolEnd = position + this.annotations[i].numBytesRead * 2 - 1;
            position = annotation.nibbles.symbolEnd + 1;
            annotation.symbolMagnitude = this.annotations[i].magnitude;
            annotationList.push(annotation);
          }
          annotationStruct.nibbles = nibbles2;
          annotationStruct.annotations = annotationList;
          struct.annotation = annotationStruct;
        }
        let element = {};
        let nibbles = {};
        nibbles.type = position;
        position += 1;
        nibbles.lengthStart = position;
        nibbles.lengthEnd = position + this.varUIntLength * 2;
        position = nibbles.lengthEnd + 1;
        if (position === struct.totalNibbles) {
        } else if (position < struct.totalNibbles) {
          nibbles.representationStart = position;
          nibbles.representationEnd = struct.totalNibbles - 1;
        } else {
          throw new Error(`nibblePositionStruct has invalid position ${postion} out of ${struct.totalNibbles} for representationLength`);
        }
        element.typeValue = this.type;
        element.typeName = IonTypes.nameFromType(this.type);
        element.lengthValue = this.lengthWithoutAnnotations - this.varUIntLength;
        element.nibbles = nibbles;
        struct.element = element;
        return struct;
      }
    };
    exports.IonElement = IonElement;
  });

  // src/core/SymbolTable.js
  var require_SymbolTable = __commonJS((exports) => {
    "use strict";
    var IonTypes = require_IonTypes().IonTypes;
    var SymbolTable = class {
      #symbolStepSize = 1e4;
      #symbolsLeftAtStep = this.#symbolStepSize;
      #nextSymbol = 1;
      #symbols;
      #meta;
      #usage;
      #checkAndGrowArrays = (numberOfSymbolsAdding) => {
        if (this.#nextSymbol + numberOfSymbolsAdding > this.#symbolsLeftAtStep) {
          this.#symbols.push(new Array(this.#symbolStepSize));
          if (this.#meta !== void 0) {
            this.#meta.push(new Array(this.#symbolStepSize));
          }
          if (this.#usage !== void 0) {
            this.#usage.push(new Array(this.#symbolStepSize));
          }
        }
      };
      #calculateArraysFromID = (symbolID) => {
        let internalSymbolID = symbolID - this.#symbolStepSize;
        let count = 1;
        while (internalSymbolID >= this.#symbolStepSize) {
          internalSymbolID -= this.#symbolStepSize;
          count++;
        }
        return {array: count, symbol: internalSymbolID};
      };
      constructor(addSystemSymbols, trackMeta, trackUsage) {
        this.#symbols = [new Array(this.#symbolStepSize)];
        if (trackMeta === true) {
          this.#meta = [new Array(this.#symbolStepSize)];
        }
        if (trackUsage === true) {
          this.#usage = [new Array(this.#symbolStepSize)];
        }
        if (addSystemSymbols === true) {
          this.addSymbol("$ion", 0);
          this.addSymbol("$ion_1_0", 0);
          this.addSymbol("$ion_symbol_table", 0);
          this.addSymbol("name", 0);
          this.addSymbol("version", 0);
          this.addSymbol("imports", 0);
          this.addSymbol("symbols", 0);
          this.addSymbol("max_id", 0);
          this.addSymbol("$ion_shared_symbol_table", 0);
        }
      }
      addSymbol(symbolValue, offset) {
        this.#checkAndGrowArrays(1);
        if (this.#nextSymbol < this.#symbolStepSize) {
          this.#symbols[0][this.#nextSymbol] = symbolValue;
          if (offset !== void 0 && this.#meta !== void 0) {
            this.#meta[0][this.#nextSymbol] = offset;
          }
        } else {
          let arrayIndicies = this.#calculateArraysFromID(this.#nextSymbol);
          this.#symbols[arrayIndicies.array][arrayIndicies.symbol] = symbolValue;
          if (offset !== void 0 && this.#meta !== void 0) {
            this.#meta[arrayIndicies.array][arrayIndicies.symbol] = offset;
          }
        }
        this.#nextSymbol++;
      }
      addUsage(symbolID, offset) {
        if (!this.#usage) {
          throw new Error(`SymbolTable addUsage(${symbolID}, ${offset}) called with no usage enabled.`);
          return;
        }
        if (symbolID < this.#symbolStepSize) {
          if (this.#usage[0][symbolID] === void 0) {
            this.#usage[0][symbolID] = [offset];
          } else {
            this.#usage[0][symbolID].push(offset);
          }
        } else {
          let arrayIndicies = this.#calculateArraysFromID(this.#nextSymbol);
          if (this.#usage[arrayIndicies.array][arrayIndicies.symbol] === void 0) {
            this.#usage[arrayIndicies.array][arrayIndicies.symbol] = [offset];
          } else {
            this.#usage[arrayIndicies.array][arrayIndicies.symbol].push(offset);
          }
        }
      }
      getSymbolValue(symbolID, offset) {
        if (symbolID < this.#symbolStepSize) {
          if (offset !== void 0 && this.#meta[0][symbolID] > offset) {
            throw new Error(`${this.#meta[0][symbolID]} > ${offset}`);
          }
          return this.#symbols[0][symbolID];
        }
        let arrayIndicies = this.#calculateArraysFromID(this.#nextSymbol);
        if (offset !== void 0 && this.#meta[arrayIndicies.array][arrayIndicies.symbol] > offset) {
          throw new Error(`${this.#meta[arrayIndicies.array][arrayIndicies.symbol]} > ${offset}`);
        }
        return this.#symbols[arrayIndicies.array][arrayIndicies.symbol];
      }
      getSymbolUsage(symbolID) {
        if (symbolID < this.#symbolStepSize) {
          return this.#usage[0][symbolID];
        }
        let arrayIndicies = this.#calculateArraysFromID(this.#nextSymbol);
        return this.#usage[arrayIndicies.array][arrayIndicies.symbol];
      }
      getSymbolID(symbolValue) {
        for (let i = 0; i < this.#symbols.length; ++i) {
          for (let j = 0; j < this.#symbols[i].length; ++j) {
            if (symbolValue === this.#symbols[i][j]) {
              return i * this.#symbolStepSize + j;
            }
          }
        }
        return null;
      }
      get symbols() {
        return this.#symbols;
      }
      get meta() {
        return this.#meta;
      }
      get usage() {
        return this.#usage;
      }
    };
    exports.SymbolTable = SymbolTable;
  });

  // src/analyzer/StructuralAnalyzer.js
  var require_StructuralAnalyzer = __commonJS((exports) => {
    "use strict";
    var IonElement = require_IonElement().IonElement;
    var IonTypes = require_IonTypes().IonTypes;
    var StructuralAnalyzer = class {
      #MAX_OFFSET_COUNT = 10;
      #stats = {
        nulls: {
          count: 0
        },
        maxDepth: {
          value: null,
          offset: [],
          count: 0
        },
        maxAnnotations: {
          value: null,
          offset: [],
          count: 0
        },
        symbolTable: {
          shared: {},
          lstAppend: {},
          inline: {}
        },
        templates: {}
      };
      constructor() {
        for (let i = 0; i < IonTypes["numTypes"]; ++i) {
          this.#stats.nulls[IonTypes.nameFromType(i)] = {
            count: 0
          };
          this.#stats[IonTypes.nameFromType(i)] = {
            byteCount: 0,
            maxBytes: {
              value: null,
              offset: [],
              count: 0
            },
            minBytes: {
              value: null,
              offset: [],
              count: 0
            },
            maxDepth: {
              value: null,
              offset: [],
              count: 0
            },
            count: 0
          };
        }
      }
      trackElement(element, offset) {
        let statsObject = this.#stats[IonTypes.nameFromType(element.type)];
        let length = element.lengthWithoutAnnotations;
        let positionInStream = element.positionInStream + (offset === void 0 ? 0 : offset);
        if (statsObject === void 0) {
          console.log(element.toString());
        }
        statsObject.count++;
        statsObject.byteCount += length;
        if (length > statsObject.maxBytes.value || statsObject.maxBytes.value === null) {
          statsObject.maxBytes.value = length;
          statsObject.maxBytes.offset = [positionInStream];
          statsObject.maxBytes.count = 1;
        } else if (length === statsObject.maxBytes.value) {
          if (statsObject.count < this.#MAX_OFFSET_COUNT) {
            statsObject.maxBytes.offset.push(positionInStream);
          }
          statsObject.maxBytes.count++;
        }
        if (length < statsObject.minBytes.value || statsObject.minBytes.value === null) {
          statsObject.minBytes.value = length;
          statsObject.minBytes.offset = [positionInStream];
          statsObject.minBytes.count = 1;
        } else if (length === statsObject.minBytes.value) {
          if (statsObject.count < this.#MAX_OFFSET_COUNT) {
            statsObject.minBytes.offset.push(positionInStream);
          }
          statsObject.minBytes.count++;
        }
        if (element.depth > statsObject.maxDepth.value || statsObject.maxDepth.value === null) {
          statsObject.maxDepth.value = element.depth;
          statsObject.maxDepth.offset = [positionInStream];
          statsObject.maxDepth.count = 1;
        } else if (element.depth === statsObject.maxDepth.value) {
          if (statsObject.count < this.#MAX_OFFSET_COUNT) {
            statsObject.maxDepth.offset.push(positionInStream);
          }
          statsObject.maxDepth.count++;
        }
        if (element.depth > this.#stats.maxDepth.value || this.#stats.maxDepth.value === null) {
          this.#stats.maxDepth.value = element.depth;
          this.#stats.maxDepth.offset = [positionInStream];
          this.#stats.maxDepth.count = 1;
        } else if (element.depth === this.#stats.maxDepth.value) {
          if (this.#stats.maxDepth.offset.length < this.#MAX_OFFSET_COUNT) {
            this.#stats.maxDepth.offset.push(positionInStream);
          }
          this.#stats.maxDepth.count++;
        }
        if (element.annotationsLength > 0) {
          if (element.annotations.length > this.#stats.maxAnnotations.value || this.#stats.maxAnnotations.value === null) {
            this.#stats.maxAnnotations.value = element.annotations.length;
            this.#stats.maxAnnotations.offset = [positionInStream];
            this.#stats.maxAnnotations.count = 1;
          } else if (element.annotations.length === this.#stats.maxAnnotations.value) {
            if (this.#stats.maxAnnotations.offset.length < this.#MAX_OFFSET_COUNT) {
              this.#stats.maxAnnotations.offset.push(positionInStream);
            }
            this.#stats.maxAnnotations.count++;
          }
          this.trackElement({
            depth: element.depth,
            positionInStream,
            lengthWithoutAnnotations: element.annotationsLength,
            type: IonTypes["annotation"],
            isNull: false
          });
        }
        if (element.isNull === true) {
          this.#stats.nulls.count++;
          this.#stats.nulls[IonTypes.nameFromType(element.type)].count++;
        }
      }
      get stats() {
        return this.#stats;
      }
    };
    exports.StructuralAnalyzer = StructuralAnalyzer;
  });

  // src/core/IonElementTextWriter.js
  var require_IonElementTextWriter = __commonJS((exports) => {
    "use strict";
    var IonTypes = require_IonTypes().IonTypes;
    var IonElement = require_IonElement().IonElement;
    var SymbolTable = require_SymbolTable().SymbolTable;
    var svr = require_ScalarValueReader();
    var utilities = require_ReaderUtilities();
    var IonElementTextWriter = class {
      #typeReader;
      #scalarReader;
      #symbolTables;
      #symbolLookup = (symbolID) => {
        let symbolValue = null;
        if (this.#symbolTables.length === 0) {
          return `$${symbolID}`;
        }
        symbolValue = this.#symbolTables[0].getSymbolValue(symbolID);
        if (symbolValue !== void 0) {
          return symbolValue;
        }
        for (let i = 1; i < this.#symbolTables.length; ++i) {
          symbolValue = this.#symbolTables[i].getSymbolValue(symbolID);
          if (symbolValue !== void 0) {
            return symbolValue;
          }
        }
        return void 0;
      };
      #elementStructureToLines = (element) => {
        let elementLines = [];
        if (element.depth > 0) {
          elementLines.push(["Depth", element.depth, element.depth * 2]);
        }
        if (element.fieldNameVarUIntLength > 0) {
          elementLines.push(["Field name", `$${element.fieldNameSymbolID}`, element.fieldNameVarUIntLength * 2]);
        }
        if (element.annotationsLength > 0) {
          elementLines.push(["Type", "Annotation", 1]);
          elementLines.push([
            "Length",
            element.length - element.varUIntLengthWithAnnotations,
            1 + element.varUIntLengthWithAnnotations * 2
          ]);
          elementLines.push([
            "Length of Annotations",
            element.annotationsVarUIntLength,
            element.annotationsVarUIntLength * 2
          ]);
          for (let i = 0; i < element.annotations.length; ++i) {
            elementLines.push([
              "Annotation",
              `$${element.annotations[i].magnitude}`,
              element.annotations[i].numBytesRead * 2
            ]);
          }
        }
        if (IonTypes.nameFromType(element.type) === "bvm") {
          elementLines.push(["Type", IonTypes.nameFromType(element.type), 2]);
          elementLines.push(["Major Version", 1, 2]);
          elementLines.push(["Minor Version", 0, 2]);
          elementLines.push(["BVM", "End", 2]);
          return elementLines;
        }
        elementLines.push(["Type", IonTypes.nameFromType(element.type), 1]);
        elementLines.push([
          "Length",
          element.lengthWithoutAnnotations - element.varUIntLength,
          1 + element.varUIntLength * 2
        ]);
        return elementLines;
      };
      #representationOfElement = (element) => {
        let representation;
        if (element.isNull) {
          representation = `null.${IonTypes.nameFromType(element.type)}`;
          if (element.type === IonTypes["int+"] || element.type === IonTypes["int-"]) {
            representation = `null.int`;
          }
          return representation;
        }
        if (element.isScalar) {
          let scalar = "";
          if (element.bytePositionOfRepresentation === null) {
            scalar = element.varUIntLength;
          } else {
            scalar = utilities.readScalarFromElement(element, this.#scalarReader);
          }
          representation = scalar;
          switch (element.type) {
            case IonTypes["bool"]:
              representation = element.boolRepresentation;
              break;
            case IonTypes["string"]:
              representation = `"${scalar}"`;
              break;
            case IonTypes["symbol"]:
              representation = this.#symbolLookup(scalar);
              if (representation === void 0) {
                representation = `$0`;
              }
              break;
            case IonTypes["decimal"]:
              if (scalar !== 0) {
                representation = `${scalar.coefficient.magnitude}d${scalar.exponent.magnitude}`;
              } else {
                representation = scalar;
              }
              break;
            case IonTypes["timestamp"]:
              representation = `${scalar.year.magnitude}`;
              if (scalar.month !== void 0) {
                representation += `-${scalar.month.magnitude}`;
              }
              if (scalar.day !== void 0) {
                representation += `-${scalar.day.magnitude}T`;
                if (scalar.hour !== void 0) {
                  representation += `${scalar.hour.magnitude}:${scalar.minute.magnitude}`;
                  if (scalar.second !== void 0) {
                    representation += `:${scalar.second.magnitude}`;
                    if (scalar.fractionCoefficient !== void 0) {
                      representation += `.${scalar.fractionCoefficient.magnitude}`;
                    }
                  }
                }
              } else {
                representation += `T`;
              }
              if (scalar.offset.isNegative === false) {
                representation += `+${scalar.offset.magnitude}`;
              } else {
                representation += `-${scalar.offset.magnitude}`;
              }
              break;
          }
        } else if (element.isContainer) {
          switch (element.type) {
            case IonTypes["struct"]:
              representation = "{";
              break;
            case IonTypes["list"]:
              representation = "[";
              break;
            case IonTypes["sexp"]:
              representation = "(";
              break;
          }
        } else {
          representation = `?`;
        }
        return representation;
      };
      #elementValueToLines = (element) => {
        let elementLines = new Array(4);
        elementLines[0] = [null, "", element.depth * 2];
        if (element.fieldNameSymbolID) {
          let fieldName = this.#symbolLookup(element.fieldNameSymbolID);
          elementLines[1] = [null, fieldName, element.fieldNameVarUIntLength * 2];
        }
        elementLines[2] = [];
        for (let i = 0; i < element.annotations.length; ++i) {
          let annotation = this.#symbolLookup(element.annotations[i].magnitude);
          elementLines[2].push([null, annotation, element.annotations[i].numBytesRead * 2]);
        }
        let representationPosition = element.positionInStream + element.totalLength - element.bytePositionOfRepresentation;
        if (element.isScalar) {
          if (element.bytePositionOfRepresentation !== null) {
            elementLines[3] = [
              null,
              this.#representationOfElement(element),
              representationPosition * 2
            ];
          } else {
            elementLines[3] = [
              null,
              this.#representationOfElement(element),
              2
            ];
          }
        } else {
          elementLines[3] = [
            null,
            this.#representationOfElement(element),
            2
          ];
        }
        return elementLines;
      };
      constructor(typeReader, scalarReader, symbolTables) {
        this.#typeReader = typeReader;
        this.#scalarReader = scalarReader;
        if (symbolTables !== void 0) {
          this.#symbolTables = [...symbolTables];
        } else {
          this.#symbolTables = [];
        }
      }
      printElementToString(element, format) {
        let depth = "";
        for (let i = 0; i < element.depth; ++i) {
          depth += "\xB7";
        }
        let fieldName = "";
        if (element.fieldNameSymbolID) {
          fieldName = this.#symbolLookup(element.fieldNameSymbolID) + ": ";
        }
        let annotations = "";
        for (let i = 0; i < element.annotations.length; ++i) {
          annotations += this.#symbolLookup(element.annotations[i].magnitude) + "::";
        }
        let representation = "";
        let type = "";
        let extra = "";
        if (element.isNull) {
          representation = `null.${IonTypes.nameFromType(element.type)}`;
          if (element.type === IonTypes["int+"] || element.type === IonTypes["int-"]) {
            representation = `null.int`;
          }
        } else if (element.isScalar) {
          let scalar = "";
          if (element.bytePositionOfRepresentation === null) {
            scalar = element.varUIntLength;
          } else {
            scalar = utilities.readScalarFromElement(element, this.#scalarReader);
          }
          let display = scalar;
          if (element.type === IonTypes["bool"]) {
            display = `${element.boolRepresentation}`;
          } else if (element.type === IonTypes["string"]) {
            display = `"${scalar}"`;
          } else if (element.type === IonTypes["symbol"]) {
            let symbolValue = this.#symbolLookup(scalar);
            if (symbolValue === void 0) {
              symbolValue = `$0`;
            }
            display = `${symbolValue}`;
            extra = ` <${scalar}>`;
          } else if (element.type === IonTypes["timestamp"]) {
            display = `${scalar.year.magnitude}`;
            if (scalar.month !== void 0) {
              display += `-${scalar.month.magnitude}`;
            }
            if (scalar.day !== void 0) {
              display += `-${scalar.day.magnitude}`;
              if (scalar.hour !== void 0) {
                display += `T${scalar.hour.magnitude}:${scalar.minute.magnitude}`;
                if (scalar.second !== void 0) {
                  display += `:${scalar.second.magnitude}`;
                  if (scalar.fractionCoefficient !== void 0) {
                    display += `.${scalar.fractionCoefficient.magnitude}`;
                  }
                }
              } else {
                display += `T`;
              }
            } else {
              display += `T`;
            }
            if (scalar.offset.isNegative === false) {
              display += `+${scalar.offset.magnitude}`;
            } else {
              display += `-${scalar.offset.magnitude}`;
            }
          } else if (element.type === IonTypes["decimal"] && scalar !== 0) {
            display = `${scalar.coefficient.magnitude}d${scalar.exponent.magnitude}`;
          }
          representation = `${display}`;
          type = ` // scalar(${IonTypes.nameFromType(element.type)})`;
        } else if (element.isContainer) {
          let display = "";
          if (element.type === IonTypes["struct"]) {
            display = "{";
          } else if (element.type === IonTypes["list"]) {
            display = "[";
          } else if (element.type === IonTypes["sexp"]) {
            display = "(";
          }
          representation = `${display}`;
          type = ` // container(${IonTypes.nameFromType(element.type)})`;
        } else {
          representation = `?`;
          type = ` // special(${IonTypes.nameFromType(element.type)})`;
        }
        let comma = "";
        if (element.depth !== 0 && element.isContainer === false) {
          comma = ",";
        }
        let isSystem = `${element.isSystemElement === true ? " [system]" : ""}`;
        return `${depth}${fieldName}${annotations}${representation}${comma}${type}${extra}${isSystem}`;
      }
      printContainerEndToString(element) {
        if (!element.isContainer) {
          throw new Error(`IonElementTextWriter printContainerEndToString(${IonTypes.nameFromType(element.type)})`);
        }
        let depth = "";
        for (let i = 0; i < element.depth; ++i) {
          depth += "\xB7";
        }
        let containerEnd = "";
        if (element.type === IonTypes["struct"]) {
          containerEnd = "}";
        } else if (element.type === IonTypes["list"]) {
          containerEnd = "]";
        } else if (element.type === IonTypes["sexp"]) {
          containerEnd = ")";
        }
        let comma = "";
        if (element.depth !== 0) {
          comma = ",";
        }
        return `${depth}${containerEnd}${comma}`;
      }
      printElementToAnnotatedString(element, rawBytes) {
        let depth = "";
        let byteNibbles = "";
        let bytesUpToRepresentation = element.totalLength;
        let offsetPreamble = `
 ${"".padStart(12, " ")}| `;
        let lastLine = `${offsetPreamble}`;
        let columnFiller = "";
        let structureLines = this.#elementStructureToLines(element);
        let elementLines = "";
        for (let i = 0; i < structureLines.length; ++i) {
          elementLines += `${offsetPreamble}${columnFiller}+-> ${structureLines[i][0]}: ${structureLines[i][1]}`;
          columnFiller += "|".padEnd(structureLines[i][2], " ");
          lastLine += `${"|".padEnd(structureLines[i][2] - 1, "-")}${structureLines[i][2] > 1 ? "\\" : ""}`;
        }
        if (element.isContainer && element.bytePositionOfRepresentation !== null) {
          bytesUpToRepresentation = element.bytePositionOfRepresentation - element.positionInStream;
        }
        if (bytesUpToRepresentation > rawBytes.length) {
          throw new Error("IonElementTextWriter has invalid data.");
        }
        for (let i = 0; i < element.depth; ++i) {
          depth += "\xB7\xB7";
        }
        for (let i = 0; i < bytesUpToRepresentation; ++i) {
          byteNibbles += `${rawBytes[i].toString(16).padStart(2, "0")}`;
        }
        let nibbleLine = `
 ${("" + element.positionInStream).padStart(12, "0")}| ${depth}${byteNibbles}`;
        let valueLines = this.#elementValueToLines(element);
        let elementRepresentationLines = "";
        let firstLine = `${offsetPreamble}`;
        let position = 0;
        let fieldNamePosition = null;
        let annotationStartPosition = null;
        firstLine += "".padEnd(valueLines[0][2], " ");
        if (valueLines[1] !== void 0) {
          firstLine += "".padEnd(valueLines[1][2], "!");
          fieldNamePosition = position;
          position += valueLines[1][2];
        }
        if (valueLines[2].length > 0) {
          let amountToMove2 = (element.bytePositionOfAnnotations - element.positionInStream) * 2 - position;
          firstLine += "".padEnd(amountToMove2, " ");
          position += amountToMove2;
          annotationStartPosition = position;
          for (let i = 0; i < valueLines[2].length; ++i) {
            firstLine += "".padEnd(valueLines[2][i][2], "@");
            position += valueLines[2][i][2];
          }
        }
        let amountToMove = (element.bytePositionOfRepresentation - element.positionInStream) * 2 - position;
        if (element.bytePositionOfRepresentation === null) {
          amountToMove = 0;
        }
        if (element.isContainer || element.isNull) {
          amountToMove = (element.bytePositionOfRepresentation - element.positionInStream - 1 - element.varUIntLength) * 2 - position;
        }
        position += amountToMove;
        firstLine += "".padEnd(amountToMove, " ");
        firstLine += "|";
        firstLine += "".padEnd(valueLines[3][2] - 2, "-");
        if (valueLines[3][2] > 1) {
          firstLine += "/";
        }
        elementRepresentationLines = `${offsetPreamble}${"".padEnd(valueLines[0][2], " ")}`;
        elementRepresentationLines += `${fieldNamePosition !== null ? "|" : ""}`;
        elementRepresentationLines += `${annotationStartPosition !== null ? "".padEnd(annotationStartPosition - (fieldNamePosition !== null ? 1 : 0), " ") + "|" + "".padEnd(position - annotationStartPosition - 1) : "".padEnd(fieldNamePosition !== null ? position - 1 : position, " ")}`;
        elementRepresentationLines += `+-> ${valueLines[3][1]}`;
        let annotationLines = "";
        if (annotationStartPosition !== null) {
          annotationLines += `${offsetPreamble}${"".padEnd(valueLines[0][2], " ")}`;
          annotationLines += `${fieldNamePosition !== null ? "|" : ""}`;
          annotationLines += `${"".padEnd(annotationStartPosition - (fieldNamePosition !== null ? 1 : 0), " ") + "+- " + valueLines[2][0][1] + "::"}`;
        }
        let fieldNameLine = "";
        if (fieldNamePosition !== null) {
          fieldNameLine += `${offsetPreamble}${"".padEnd(valueLines[0][2], " ")}`;
          fieldNameLine += `+- ${valueLines[1][1]}:`;
        }
        return `${elementLines}${lastLine}${nibbleLine}${firstLine}${elementRepresentationLines}${annotationLines}${fieldNameLine}
`;
      }
    };
    exports.IonElementTextWriter = IonElementTextWriter;
  });

  // src/value_stream/ValueStreamReader.js
  var require_ValueStreamReader = __commonJS((exports) => {
    "use strict";
    var tdr = require_TypeDescriptorReader();
    var svr = require_ScalarValueReader();
    var IonElement = require_IonElement().IonElement;
    var SymbolTable = require_SymbolTable().SymbolTable;
    var utilities = require_ReaderUtilities();
    var Analyzer = require_StructuralAnalyzer().StructuralAnalyzer;
    var IonTypes = require_IonTypes().IonTypes;
    var IonElementTextWriter = require_IonElementTextWriter().IonElementTextWriter;
    var ValueStreamReader = class {
      #reader;
      #readerSize = 0;
      #typeReader;
      #scalarReader;
      #stats;
      #symbolTable;
      #textWriter;
      #elementStack;
      #inSymbolTableDefinition;
      #inSymbolList;
      #currentElement = null;
      #resetElementStack = function() {
        this.#elementStack = [];
        this.#inSymbolTableDefinition = false;
        this.#inSymbolList = false;
        for (let i = 0; i < 100; ++i) {
          this.#elementStack.push(new IonElement(0, 0, this.#readerSize, null, null, null));
        }
        this.#currentElement = this.#elementStack[0];
      };
      constructor(reader) {
        if (reader === void 0) {
          throw new Error(`ValueStreamReader passed an undefined reader.`);
        }
        this.#reader = reader;
        this.#readerSize = this.#reader.size;
        this.#typeReader = new tdr.TypeDescriptorReader(this.#reader);
        this.#scalarReader = new svr.ScalarValueReader(this.#reader);
        this.#symbolTable = new SymbolTable(true, true, true);
        this.#stats = new Analyzer();
        this.#textWriter = new IonElementTextWriter(this.#typeReader, this.#scalarReader, [this.#symbolTable]);
        if (this.#reader.atEnd()) {
          throw new Error("TODO: empty file");
        }
        this.#resetElementStack();
      }
      readTopLevelTLPairs(positionToStart, maxPosition) {
        let position = positionToStart;
        let lastTopLevelTL = null;
        let lastTopLevelTLPosition = 0;
        let tlPair = null;
        do {
          tlPair = this.#typeReader.readTypeAndLength(position);
          if (tlPair === null) {
            break;
          }
          lastTopLevelTLPosition = position;
          position = position + 1 + tlPair.length;
        } while (position < maxPosition);
        return lastTopLevelTLPosition;
      }
      readAll() {
        let currentElement = this.#currentElement;
        while (true) {
          this.#currentElement = currentElement;
          try {
            let returnValue = currentElement.readTypeDescriptor(this.#typeReader);
            if (returnValue === null) {
              if (currentElement.length) {
                return currentElement.length;
              } else {
                return 100;
              }
            }
            this.#stats.trackElement(currentElement);
          } catch (error) {
            console.log(`Error! currentElement: ${currentElement.toString()}`);
            throw error;
          }
          if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
            this.#inSymbolTableDefinition = true;
          }
          if (this.#inSymbolTableDefinition === true) {
            if (currentElement.depth === 1 && currentElement.fieldNameSymbolID === 7) {
              this.#inSymbolList = true;
            } else if (currentElement.depth === 2 && this.#inSymbolList === true && currentElement.type === IonTypes["string"]) {
              this.#symbolTable.addSymbol(utilities.readScalarFromElement(currentElement, this.#scalarReader), currentElement.positionInStream);
            }
          }
          if (currentElement.fieldNameSymbolID !== void 0) {
            this.#symbolTable.addUsage(currentElement.fieldNameSymbolID, currentElement.bytePositionOfRepresentation || currentElement.positionInStream);
          }
          if (currentElement.type === IonTypes["symbol"]) {
            let symbolID = currentElement.bytePositionOfRepresentation === null ? currentElement.varUIntLength : utilities.readScalarFromElement(currentElement, this.#scalarReader);
            this.#symbolTable.addUsage(symbolID, currentElement.bytePositionOfRepresentation || currentElement.positionInStream);
          }
          if (currentElement.firstAnnotation !== null) {
            this.#symbolTable.addUsage(currentElement.firstAnnotation.magnitude, currentElement.positionInStream);
          }
          if (currentElement.isScalar && !currentElement.isNull && currentElement.lengthWithoutAnnotations !== 0) {
          }
          if (currentElement.isContainer && !currentElement.isNull && currentElement.length !== 0) {
            let elemDef = currentElement.containsElement;
            currentElement = this.#elementStack[elemDef[1]];
            currentElement.repurpose(elemDef[0], elemDef[1], elemDef[2], elemDef[3], elemDef[4], elemDef[5]);
          } else if (currentElement.nextElement) {
            currentElement.repurpose(currentElement.nextElement[0], currentElement.nextElement[1], currentElement.nextElement[2], currentElement.nextElement[3], currentElement.nextElement[4], currentElement.nextElement[5]);
          } else {
            while (currentElement.depth > 0) {
              currentElement = this.#elementStack[currentElement.depth - 1];
              if (currentElement.nextElement !== null) {
                break;
              }
            }
            if (this.#inSymbolTableDefinition === true && currentElement.depth === 0) {
              this.#inSymbolTableDefinition = false;
            }
            if (this.#inSymbolList === true && currentElement.depth < 2) {
              this.#inSymbolList = false;
            }
            if (currentElement.nextElement) {
              currentElement.repurpose(currentElement.nextElement[0], currentElement.nextElement[1], currentElement.nextElement[2], currentElement.nextElement[3], currentElement.nextElement[4], currentElement.nextElement[5]);
            } else {
              if (!this.#reader.atEnd(currentElement.positionInStream + currentElement.totalLength)) {
                throw new Error("Not at end of stream");
              }
              currentElement = void 0;
              break;
            }
          }
        }
        return;
      }
    };
    exports.ValueStreamReader = ValueStreamReader;
  });

  // src/browser/ByteSliceReader.js
  var require_ByteSliceReader = __commonJS((exports) => {
    "use strict";
    var br = require_ByteReader();
    var vsr = require_ValueStreamReader();
    var ByteSliceReader = class extends br.ByteReader {
      #fileDescriptor;
      #fileStats;
      #bufferSize = 1;
      #bufferOffset = -1;
      #byteBuffer;
      #uint8Buffer;
      #reader;
      #readAsArrayBuffer;
      #callbackOnLoadEnd = (e) => {
      };
      #positionInFile = 0;
      #bufferRead = async () => {
        let slice = this.#fileDescriptor.slice(this.#bufferOffset, this.#bufferOffset + this.#bufferSize);
        this.#byteBuffer = await this.#readAsArrayBuffer(slice);
        this.#uint8Buffer = new Uint8Array(this.#byteBuffer);
      };
      #bufferCheckAndRead = async (bytesNeeded, offsetToStart) => {
        let dirty = false;
        if (this.#bufferOffset === -1) {
          this.#bufferOffset = 0;
          dirty = true;
        }
        if (offsetToStart !== void 0) {
          dirty = true;
          this.#bufferOffset = offsetToStart;
        } else if (this.#positionInFile < this.#bufferOffset || this.#positionInFile + bytesNeeded >= this.#bufferOffset + this.#bufferSize - 1) {
          dirty = true;
          this.#bufferOffset = this.#positionInFile;
        }
        if (dirty) {
          await this.#bufferRead();
        }
      };
      constructor(bufferSize) {
        super();
        this.#reader = new FileReader();
        let self = this;
        this.#readAsArrayBuffer = (file) => {
          let result = new Promise((resolve) => {
            self.#reader.onloadend = (e) => {
              resolve(self.#reader.result);
              self.#callbackOnLoadEnd(e);
            };
            self.#reader.readAsArrayBuffer(file);
          });
          return result;
        };
        if (Number.isInteger(bufferSize) && bufferSize > 0) {
          this.#bufferSize = bufferSize;
        } else if (bufferSize !== void 0) {
          throw new Error("ByteSliceReader constructor called with invalid bufferSize");
        }
      }
      loadFile(filePath) {
        if (!(filePath instanceof File)) {
          throw new Error(`ByteSliceReader loadFile() passed invalid filePath File ${filePath}.`);
        }
        this.#fileDescriptor = filePath;
        this.#fileStats = filePath.size;
        return this.#fileStats;
      }
      nextByte() {
        if (this.atEnd()) {
          return null;
        }
        let offsetInBuffer = this.#positionInFile - this.#bufferOffset;
        if (offsetInBuffer < 0 || this.#uint8Buffer === void 0 || offsetInBuffer >= this.#uint8Buffer.length) {
          return null;
        }
        let byte = this.#uint8Buffer[offsetInBuffer];
        if (byte === void 0) {
          throw new Error(`nextByte byte is undefined at ${offsetInBuffer} and ${this.#positionInFile}`);
        }
        this.#positionInFile++;
        return byte;
      }
      skipBytes(numBytesToSkip) {
        this.#positionInFile += numBytesToSkip;
      }
      setPosition(positionToSet) {
        this.#positionInFile = positionToSet;
      }
      async fillBuffer(bytesNeeded, offsetToStart) {
        if (Number.isInteger(bytesNeeded) && bytesNeeded > 0 && bytesNeeded <= this.#bufferSize) {
          this.setPosition(offsetToStart);
          await this.#bufferCheckAndRead(bytesNeeded, offsetToStart);
        }
      }
      atEnd(position) {
        if (position === void 0) {
          position = this.#positionInFile;
        }
        if (position === this.#fileStats) {
          return true;
        }
        if (position > this.#fileStats) {
          throw new Error(`ByteSliceReader atEnd() asked to skip beyond end of file. ${position} > ${this.#fileStats}`);
        }
        return false;
      }
      get size() {
        return this.#fileStats;
      }
      get positionInFile() {
        return this.#positionInFile;
      }
      get biBuffer() {
        return this.#byteBuffer;
      }
      get isReady() {
        return this.#reader.readyState === 2;
      }
      set readerOnLoadEndCallback(callback) {
        this.#callbackOnLoadEnd = callback;
      }
      rawBytes(offset, length) {
        return this.#uint8Buffer.slice(offset - this.#bufferOffset, offset - this.#bufferOffset + length);
      }
    };
    exports.ByteSliceReader = ByteSliceReader;
  });

  // src/browser/bite.js
  var require_bite = __commonJS((exports, module) => {
    "use strict";
    var ByteBufferReader = require_ByteBufferReader().ByteBufferReader;
    var ByteReader = require_ByteReader().ByteReader;
    var ByteSliceReader = require_ByteSliceReader().ByteSliceReader;
    var IonElement = require_IonElement().IonElement;
    var IonElementTextWriter = require_IonElementTextWriter().IonElementTextWriter;
    var IonTypes = require_IonTypes().IonTypes;
    var utilities = require_ReaderUtilities();
    var ScalarValueReader = require_ScalarValueReader().ScalarValueReader;
    var SymbolTable = require_SymbolTable().SymbolTable;
    var TypeDescriptorReader = require_TypeDescriptorReader().TypeDescriptorReader;
    var Analyzer = require_StructuralAnalyzer().StructuralAnalyzer;
    var ValueStreamReader = require_ValueStreamReader().ValueStreamReader;
    module.exports = {
      ByteBufferReader,
      ByteReader,
      ByteSliceReader,
      IonElement,
      IonElementTextWriter,
      IonTypes,
      utilities,
      ScalarValueReader,
      SymbolTable,
      TypeDescriptorReader,
      Analyzer,
      ValueStreamReader
    };
  });
  return require_bite();
})();
