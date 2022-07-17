const assert = require('chai').assert;
const tdr = require("../../src/core/TypeDescriptorReader");
const br = require('../../src/core/ByteReader');
const types = require('../../src/core/IonTypes');
let tdReader;

const createReader = (reader) => {
  return new tdr.TypeDescriptorReader(reader);
};

const createSingleUseByteReader = (hexToTest) => {
  const buf = new Uint8Array(hexToTest);
  let pos = 0;
  const byteReader = new br.ByteReader();
  byteReader.nextByte = () => {
    const byte = buf[pos];
    if (pos > buf.length) { throw new Error("nextByte called too many times."); }
    pos++;
    return byte;
  };
  byteReader.skipBytes = (numBytesToSkip) => {
    pos += numBytesToSkip;
  };
  return byteReader;
};

const createTypeDescriptorTest = (typeDesc, expectedSuccessArray) => {
  for (let i = 0 ; i < 16 ; ++i) {
    const buf = [(16*typeDesc) + i, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255];
    // VarUInts (all 0x_E and sorted struct)
    if (i === 14 || (typeDesc === types.IonTypes["struct"] && i === 1)) {
      buf[1] = 142; // 8E
    }
    const singleUseByteReader = createSingleUseByteReader(buf);
    tdReader = new tdr.TypeDescriptorReader(singleUseByteReader);
    if (expectedSuccessArray[i] === true) {
      let typeAndLength = undefined;

      assert.doesNotThrow(() => { typeAndLength = tdReader.readTypeAndLength(0, "1_0"); });

      // nop padding
      if (typeDesc === types.IonTypes["null"] && i < 15) {
        assert.strictEqual(typeAndLength.type, types.IonTypes["nop"]);
      }
      // bvm
      else if(typeDesc === types.IonTypes["annotation"] && i === 0) {
        assert.strictEqual(typeAndLength.type, types.IonTypes["bvm"]);
      }
      else {
        assert.strictEqual(typeAndLength.type, typeDesc);
      }

      // bools have no length
      if (typeDesc === types.IonTypes["bool"] && i === 1) {
        assert.strictEqual(typeAndLength.length, 0);
      }
      // sorted structs have a length field which is set to 15 above
      else if (typeDesc === types.IonTypes["struct"] && i === 1) {
        assert.strictEqual(typeAndLength.length, 15);
      }
      // bvm has a length of 3
      else if (typeDesc === types.IonTypes["annotation"] && i === 0) {
        assert.strictEqual(typeAndLength.length, 3);
      }
      // VarUInts for each type are set to be a length of 15 above
      else if (i === 14) {
        assert.strictEqual(typeAndLength.length, 15);
      }
      // null value for each type
      else if (i === 15) {
        assert.strictEqual(typeAndLength.length, 0);
        assert.strictEqual(typeAndLength.isNull, true);
      }
      else {
        assert.strictEqual(typeAndLength.length, i);
      }
    }
    else {
      assert.throws(() => { tdReader.readTypeAndLength(); }, Error);
    }
  }
};


describe('TypeDescriptorReader', function() {
  describe("constructor", function () {
    it('should throw on an invalid byteReader', function() {
      assert.throws(createReader, 
                    Error );
    });
    it('should succeed when passed a byteReader', function() {
      assert.doesNotThrow(function () { createReader(createSingleUseByteReader([0])) });
    });
  });
  describe('readTypeAndLength', function() {
    it('should parse T0', function() {
      createTypeDescriptorTest(0, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T1', function() {
      createTypeDescriptorTest(1, [
        true,  // 0
        true,  // 1
        false, // 2
        false, // 3
        false, // 4
        false, // 5
        false, // 6
        false, // 7
        false, // 8
        false, // 9
        false, // A
        false, // B
        false, // C
        false, // D
        false, // E
        true   // F
      ]);
    });
    it('should parse T2', function() {
      createTypeDescriptorTest(2, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T3', function() {
      createTypeDescriptorTest(3, [
        false, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T4', function() {
      createTypeDescriptorTest(4, [
        true, // 0
        false, // 1
        false, // 2
        false, // 3
        true, // 4
        false, // 5
        false, // 6
        false, // 7
        true, // 8
        false, // 9
        false, // A
        false, // B
        false, // C
        false, // D
        false, // E
        true  // F
      ]);
    });
    it('should parse T5', function() {
      createTypeDescriptorTest(5, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T6', function() {
      createTypeDescriptorTest(6, [
        false, // 0
        false, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T7', function() {
      createTypeDescriptorTest(7, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T8', function() {
      createTypeDescriptorTest(8, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T9', function() {
      createTypeDescriptorTest(9, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T10', function() {
      createTypeDescriptorTest(10, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T11', function() {
      createTypeDescriptorTest(11, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T12', function() {
      createTypeDescriptorTest(12, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T13', function() {
      createTypeDescriptorTest(13, [
        true, // 0
        true, // 1
        true, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        true  // F
      ]);
    });
    it('should parse T14', function() {
      createTypeDescriptorTest(14, [
        true, // 0
        false, // 1
        false, // 2
        true, // 3
        true, // 4
        true, // 5
        true, // 6
        true, // 7
        true, // 8
        true, // 9
        true, // A
        true, // B
        true, // C
        true, // D
        true, // E
        false  // F
      ]);
    });
    it('should parse T15', function() {
      createTypeDescriptorTest(15, [
        false, // 0
        false, // 1
        false, // 2
        false, // 3
        false, // 4
        false, // 5
        false, // 6
        false, // 7
        false, // 8
        false, // 9
        false, // A
        false, // B
        false, // C
        false, // D
        false, // E
        false  // F
      ]);
    });

    // TODO: Expand this to test comprehensively
    it('should parse VarUInts', function() {
      const buf = [parseInt('0x0E', 16), parseInt('0x8E', 16)];
      const singleUseByteReader = createSingleUseByteReader(buf);
      tdReader = new tdr.TypeDescriptorReader(singleUseByteReader);
      assert.doesNotThrow(() => { tdReader.readTypeAndLength(0, "1_0"); });
    });
  });
});