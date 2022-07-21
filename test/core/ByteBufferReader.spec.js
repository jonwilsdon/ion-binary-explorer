const assert = require('chai').assert;
const bbr = require('../../src/core/ByteBufferReader');

let bufferReader;

const fixBigIntPrinting = function () {
    // fix needed for node
    // http://thecodebarbarian.com/an-overview-of-bigint-in-node-js.html#limitations
    // from: https://github.com/sqlpad/sqlpad/issues/518
    BigInt.prototype.toJSON = function() { return this.toString(); };
};

describe('ByteReader', function() {
  beforeEach(function () {
    bufferReader = new bbr.ByteBufferReader();
    fixBigIntPrinting();
  });
  describe("readVarUInt()", function () {
    it('should read a 1 byte VarUInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 127);
      assert.strictEqual(value.numBytesRead, 1);
    });
    it('should read a 4 byte VarUInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 4);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 268435455);
      assert.strictEqual(value.numBytesRead, 4);
    });
    it('should read a 5 byte VarUInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 5);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 34359738367);
      assert.strictEqual(value.numBytesRead, 5);
    });
    it('should read a 14 byte VarUInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), 
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 14);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
         parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
         parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
         parseInt('0x7F', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarUInt();
      assert.strictEqual(value.magnitude, 316912650057057350374175801343n);
      assert.strictEqual(value.numBytesRead, 14);
    });
  });
  describe("readUInt()", function () {
    it('should read a 1 byte UInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(1);
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(1);
      assert.strictEqual(value.magnitude, 128);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(1);
      assert.strictEqual(value.magnitude, 255);
      assert.strictEqual(value.numBytesRead, 1);
    });
    it('should read a 3 byte UInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(3);
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 3);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x08', 16), parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(3);
      assert.strictEqual(value.magnitude, 8390784);
      assert.strictEqual(value.numBytesRead, 3);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(3);
      assert.strictEqual(value.magnitude, 16777215);
      assert.strictEqual(value.numBytesRead, 3);
    });
    it('should read a 4 byte UInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(4);
      assert.strictEqual(value.magnitude, 0n);
      assert.strictEqual(value.numBytesRead, 4);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x08', 16), parseInt('0x80', 16), parseInt('0x08', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(4);
      assert.strictEqual(value.magnitude, 2148040712n);
      assert.strictEqual(value.numBytesRead, 4);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(4);
      assert.strictEqual(value.magnitude, 4294967295n);
      assert.strictEqual(value.numBytesRead, 4);
    });
    it('should read a 14 byte UInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(14);
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.numBytesRead, 14);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x08', 16), parseInt('0x80', 16), parseInt('0x08', 16),
         parseInt('0x80', 16), parseInt('0x08', 16), parseInt('0x80', 16), parseInt('0x08', 16),
         parseInt('0x80', 16), parseInt('0x08', 16), parseInt('0x80', 16), parseInt('0x08', 16),
         parseInt('0x80', 16), parseInt('0x08', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(14);
      assert.strictEqual(value.magnitude, 2596821878924811327576341614198792n);
      assert.strictEqual(value.numBytesRead, 14);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readUInt(14);
      assert.strictEqual(value.magnitude, 5192296858534827628530496329220095n);
      assert.strictEqual(value.numBytesRead, 14);
    });
  });
  describe("readVarInt()", function () {
    it('should read a 1 byte VarInt', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarInt();
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xC0', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarInt();
      assert.strictEqual(value.magnitude, -0);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xBF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarInt();
      assert.strictEqual(value.magnitude, 63);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readVarInt();
      assert.strictEqual(value.magnitude, -63);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 1);
    });
  });
  it('should read a 3 byte VarInt', function() {
    let value;
    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 0);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 3);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x3F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 1048575);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 3);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x40', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -0);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 3);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -1048575);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 3);
  });
  it('should read a 4 byte VarInt', function() {
    let value;
    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 0);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 4);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x3F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 134217727);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 4);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x40', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -0);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 4);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -134217727);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 4);
  });
  it('should read a 5 byte VarInt', function() {
    let value;
    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -0);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 5);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x3F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 17179869183);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 5);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x40', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -0);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 5);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -17179869183);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 5);
  });
  it('should read a 14 byte VarInt', function() {
    let value;
    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
       parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
       parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
       parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 0);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 14);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x3F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
       parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
       parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
       parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, 158456325028528675187087900671n);
    assert.strictEqual(value.isNegative, false);
    assert.strictEqual(value.numBytesRead, 14);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x40', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
       parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
       parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
       parseInt('0x00', 16), parseInt('0x80', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -0);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 14);

    bufferReader.loadBuffer(new Uint8Array(
      [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
       parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
       parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
       parseInt('0x7F', 16), parseInt('0xFF', 16)]
    ));
    bufferReader.setPosition(0);
    value = bufferReader.readVarInt();
    assert.strictEqual(value.magnitude, -158456325028528675187087900671n);
    assert.strictEqual(value.isNegative, true);
    assert.strictEqual(value.numBytesRead, 14);
  });
  describe("readInt()", function () {
    it('should read a 1 byte Int', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(1);
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(1);
      assert.strictEqual(value.magnitude, 127);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(1);
      assert.strictEqual(value.magnitude, -0);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 1);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(1);
      assert.strictEqual(value.magnitude, -127);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 1);
    });
    it('should read a 3 byte Int', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(3);
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 3);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(3);
      assert.strictEqual(value.magnitude, 8388607);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 3);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(3);
      assert.strictEqual(value.magnitude, -0);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 3);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(3);
      assert.strictEqual(value.magnitude, -8388607);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 3);
    });
    it('should read a 4 byte Int', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(4);
      // explicitly test both -0n and 0n to show that BigInt does not differentiate between the two
      assert.strictEqual(value.magnitude, -0n);
      assert.strictEqual(value.magnitude, 0n);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 4);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(4);
      assert.strictEqual(value.magnitude, 2147483647n);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 4);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(4);
      // explicitly test both -0n and 0n to show that BigInt does not differentiate between the two
      assert.strictEqual(value.magnitude, -0n);
      assert.strictEqual(value.magnitude, 0n);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 4);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(4);
      assert.strictEqual(value.magnitude, -2147483647n);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 4);
    });
    it('should read a 14 byte Int', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(14);
      assert.strictEqual(value.magnitude, 0);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 14);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(14);
      assert.strictEqual(value.magnitude, 2596148429267413814265248164610047n);
      assert.strictEqual(value.isNegative, false);
      assert.strictEqual(value.numBytesRead, 14);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16),
         parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(14);
      assert.strictEqual(value.magnitude, -0);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 14);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      bufferReader.setPosition(0);
      value = bufferReader.readInt(14);
      assert.strictEqual(value.magnitude, -2596148429267413814265248164610047n);
      assert.strictEqual(value.isNegative, true);
      assert.strictEqual(value.numBytesRead, 14);
    });
  });
});