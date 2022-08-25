const { assert } = require('chai');
const svr = require("../../src/core/ScalarValueReader");
const bbr = require('../../src/core/ByteBufferReader');
const br = require('../../src/core/ByteReader');
const { IonTypes } = require('../../src/core/IonTypes');

let scalarValueReader;
let bufferReader;

describe('ScalarValueReader', function() {
  describe("constructor", function () {
    it('should require a byte reader as a parameter', function() {
      assert.throws(() => { new svr.ScalarValueReader(); }, 
                    "ScalarValueReader expected byteReader to be a ByteReader." );
    });
    it('should accept a byte reader as a parameter', function() {
      const byteReader = new br.ByteReader();
      assert.doesNotThrow(() => { new svr.ScalarValueReader(byteReader); });

      const bufferReader = new bbr.ByteBufferReader();
      assert.doesNotThrow(() => { new svr.ScalarValueReader(bufferReader); });
    });
  });
  describe("read()", function () {
    beforeEach(function () {
      bufferReader = new bbr.ByteBufferReader();
      scalarValueReader = new svr.ScalarValueReader(bufferReader);
    });
    it('should fail when passed a non-existent type', function() {
      assert.throws(() => { scalarValueReader.read(19 , 0, 2); },
                            "ScalarValueReader read() called with non-existant type 19.");
      assert.throws(() => { scalarValueReader.read('foo', 0, 2); },
                            "ScalarValueReader read() called with non-existant type foo.");
    });
    it('should fail when passed a non-scalar type', function() {
      assert.throws(() => { scalarValueReader.read(IonTypes["null"], 0, 2); },
                            "ScalarValueReader called on null, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["bool"], 0, 2); },
                            "ScalarValueReader called on bool, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["list"], 0, 2); },
                            "ScalarValueReader called on list, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["sexp"], 0, 2); },
                            "ScalarValueReader called on sexp, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["struct"], 0, 2); },
                            "ScalarValueReader called on struct, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["annotation"], 0, 2); },
                            "ScalarValueReader called on annotation, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["reserved"], 0, 2); },
                            "ScalarValueReader called on reserved, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["bvm"], 0, 2); },
                            "ScalarValueReader called on bvm, a non-scalar.");
      assert.throws(() => { scalarValueReader.read(IonTypes["nop"], 0, 2); },
                            "ScalarValueReader called on nop, a non-scalar.");
    });
    it('should fail when passed an invalid position', function() {
      assert.throws(() => { scalarValueReader.read(IonTypes["int+"], -1, 2); },
                            "ScalarValueReader read() called with invalid position -1.");
      assert.throws(() => { scalarValueReader.read(IonTypes["int+"], null, 2); },
                            "ScalarValueReader read() called with invalid position null.");
    });
    it('should fail when passed an invalid length', function() {
      assert.throws(() => { scalarValueReader.read(IonTypes["int+"], 0, -1); },
                            "ScalarValueReader read() called with invalid length -1.");
      assert.throws(() => { scalarValueReader.read(IonTypes["int+"], 0, null); },
                            "ScalarValueReader read() called with invalid length null.");
    });
    it('should read positive ints', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int+"],0,1);
      assert.strictEqual(value, 0);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int+"],0,1);
      assert.strictEqual(value, 255);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int+"],0,2);
      assert.strictEqual(value, 65535);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int+"],0,4);
      assert.strictEqual(value, 0n);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int+"],0,4);
      assert.strictEqual(value, 4294967295n);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int+"],0,14);
      assert.strictEqual(value, 5192296858534827628530496329220095n);
    });
    it('should read negative ints', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int-"],0,1);
      assert.strictEqual(value, -255);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int-"],0,2);
      assert.strictEqual(value, -65535);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int-"],0,4);
      assert.strictEqual(value, -4294967295n);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["int-"],0,14);
      assert.strictEqual(value, -5192296858534827628530496329220095n);
    });
    it('should fail when finding a 0 with negative ints', function() {
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      assert.throws(() => { scalarValueReader.read(IonTypes["int-"],0,1); },
                            "readNegativeInt() zero not a valid negative int value.");
      assert.throws(() => { scalarValueReader.read(IonTypes["int-"],0,4); },
                            "readNegativeInt() zero not a valid negative int value.");
    });
    it('should read floats', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16)]
      ));
      value = scalarValueReader.read(IonTypes["float"],0,4);
      assert.strictEqual(value, 4.609175024471393E-28);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16),
         parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16)]
      ));
      value = scalarValueReader.read(IonTypes["float"],0,8);
      assert.strictEqual(value, 1.2497855238365512E-221);
    });
    it('should fail floats when given an invalid length', function() {
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16), parseInt('0x12', 16)]
      ));
      assert.throws(() => { scalarValueReader.read(IonTypes["float"],0,1); },
                            "ScalarValueReader illegal float length 1.");
      assert.throws(() => { scalarValueReader.read(IonTypes["float"],0,2); },
                            "ScalarValueReader illegal float length 2.");
      assert.throws(() => { scalarValueReader.read(IonTypes["float"],0,3); },
                            "ScalarValueReader illegal float length 3.");
      assert.throws(() => { scalarValueReader.read(IonTypes["float"],0,5); },
                            "ScalarValueReader illegal float length 5.");
      assert.throws(() => { scalarValueReader.read(IonTypes["float"],0,6); },
                            "ScalarValueReader illegal float length 6.");
      assert.throws(() => { scalarValueReader.read(IonTypes["float"],0,7); },
                            "ScalarValueReader illegal float length 7.");
    });
    it('should read 1 byte decimals', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["decimal"],0,1);
      assert.strictEqual(value.coefficient.magnitude, 0);
      assert.strictEqual(value.exponent.magnitude, -63);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xBF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["decimal"],0,1);
      assert.strictEqual(value.coefficient.magnitude, 0);
      assert.strictEqual(value.exponent.magnitude, 63);
    });
    it('should read 2 byte decimals', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["decimal"],0,2);
      assert.strictEqual(value.coefficient.magnitude, -127);
      assert.strictEqual(value.exponent.magnitude, -63);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xBF', 16), parseInt('0x7F', 16)]
      ));
      value = scalarValueReader.read(IonTypes["decimal"],0,2);
      assert.strictEqual(value.coefficient.magnitude, 127);
      assert.strictEqual(value.exponent.magnitude, 63);
    });
    it('should read 15 byte decimals', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
         parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
         parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16), parseInt('0x7F', 16),
         parseInt('0x7F', 16), parseInt('0xFF', 16), parseInt('0x7F', 16)]
      ));
      value = scalarValueReader.read(IonTypes["decimal"],0,15);
      assert.strictEqual(value.coefficient.magnitude, 127);
      assert.strictEqual(value.exponent.magnitude, -158456325028528675187087900671n);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xBF', 16), parseInt('0x7F', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["decimal"],0,15);
      assert.strictEqual(value.coefficient.magnitude, 2596148429267413814265248164610047n);
      assert.strictEqual(value.exponent.magnitude, 63);
    });
    it('should read 2 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,2);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month, undefined);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xC0', 16), parseInt('0xE1', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,2);
      assert.strictEqual(value.offset.magnitude, -0);
      assert.strictEqual(value.year.magnitude, 97);
      assert.strictEqual(value.month, undefined);
    });
    it('should read 3 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x06', 16), parseInt('0xC8', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,3);
      // +14 hours (Line Islands)
      assert.strictEqual(value.offset.magnitude, 840);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month, undefined);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x10', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,3);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 2048);
      assert.strictEqual(value.month, undefined);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,3);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day, undefined);
    });
    it('should read 4 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,4);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day.magnitude, 0);
      assert.strictEqual(value.hour, undefined);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x06', 16), parseInt('0xC8', 16), parseInt('0x10', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,4);
      // +14 hours (Line Islands)
      assert.strictEqual(value.offset.magnitude, 840);
      assert.strictEqual(value.year.magnitude, 2048);
      assert.strictEqual(value.month, undefined);
    });
    it('should fail on 5 byte timestamps with hour and without minutes', function () {
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16)]
      ));
      assert.throws(() => { scalarValueReader.read(IonTypes["timestamp"],0,5); },
                            "ScalarValueReader hours present without minutes.");
    });
    it('should read 5 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x06', 16), parseInt('0xC8', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,5);
      // +14 hours (Line Islands)
      assert.strictEqual(value.offset.magnitude, 840);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day.magnitude, 0);
      assert.strictEqual(value.hour, undefined);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x06', 16), parseInt('0xC8', 16), parseInt('0x10', 16), parseInt('0x80', 16),
         parseInt('0x86', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,5);
      // +14 hours (Line Islands)
      assert.strictEqual(value.offset.magnitude, 840);
      assert.strictEqual(value.year.magnitude, 2048);
      assert.strictEqual(value.month.magnitude, 6);
      assert.strictEqual(value.day, undefined);
    });
    it('should read 6 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,6);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day.magnitude, 0);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second, undefined);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x06', 16), parseInt('0xC8', 16), parseInt('0x10', 16), parseInt('0x80', 16),
         parseInt('0x86', 16), parseInt('0x83')]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,6);
      // +14 hours (Line Islands)
      assert.strictEqual(value.offset.magnitude, 840);
      assert.strictEqual(value.year.magnitude, 2048);
      assert.strictEqual(value.month.magnitude, 6);
      assert.strictEqual(value.day.magnitude, 3);
      assert.strictEqual(value.hour, undefined);
    });
    it('should read 7 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,7);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day.magnitude, 0);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent, undefined);
    });
    it('should read 8 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,8);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day.magnitude, 0);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.numBytesRead, 0);

      // 2000-01-01T00:00:00Z with no fractional seconds
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x0F', 16), parseInt('0xD0', 16), parseInt('0x81', 16),
         parseInt('0x81', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,8);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 2000);
      assert.strictEqual(value.month.magnitude, 1);
      assert.strictEqual(value.day.magnitude, 1);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent, undefined);
    });
    it('should read 9 byte timestamps', function () {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x00', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,9);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 0);
      assert.strictEqual(value.month.magnitude, 0);
      assert.strictEqual(value.day.magnitude, 0);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.numBytesRead, 1);

      // 2000-01-01T00:00:00Z with 0d0 fractional seconds and implicit zero coefficient
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x0F', 16), parseInt('0xD0', 16), parseInt('0x81', 16),
         parseInt('0x81', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,9);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 2000);
      assert.strictEqual(value.month.magnitude, 1);
      assert.strictEqual(value.day.magnitude, 1);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.numBytesRead, 0);

      // 2000-01-01T00:00:00Z with 0d-0 fractional seconds
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x0F', 16), parseInt('0xD0', 16), parseInt('0x81', 16),
         parseInt('0x81', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0xC0', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,9);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 2000);
      assert.strictEqual(value.month.magnitude, 1);
      assert.strictEqual(value.day.magnitude, 1);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent.magnitude, -0);
      assert.strictEqual(value.fractionExponent.isNegative, true);
      assert.strictEqual(value.fractionCoefficient.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.numBytesRead, 0);

      // 2000-01-01T00:00:00Z with 0d1 fractional seconds
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x0F', 16), parseInt('0xD0', 16), parseInt('0x81', 16),
         parseInt('0x81', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x81', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,9);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 2000);
      assert.strictEqual(value.month.magnitude, 1);
      assert.strictEqual(value.day.magnitude, 1);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent.magnitude, 1);
      assert.strictEqual(value.fractionCoefficient.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.numBytesRead, 0);
    });
    it('should read 10 byte timestamps', function () {
      let value;
      
      // 2000-01-01T00:00:00Z with 0d0 fractional seconds and explicit zero coefficient
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x80', 16), parseInt('0x0F', 16), parseInt('0xD0', 16), parseInt('0x81', 16),
         parseInt('0x81', 16), parseInt('0x80', 16), parseInt('0x80', 16), parseInt('0x80', 16),
         parseInt('0x80', 16), parseInt('0x00', 16)]
      ));
      value = scalarValueReader.read(IonTypes["timestamp"],0,10);
      assert.strictEqual(value.offset.magnitude, 0);
      assert.strictEqual(value.year.magnitude, 2000);
      assert.strictEqual(value.month.magnitude, 1);
      assert.strictEqual(value.day.magnitude, 1);
      assert.strictEqual(value.hour.magnitude, 0);
      assert.strictEqual(value.minute.magnitude, 0);
      assert.strictEqual(value.second.magnitude, 0);
      assert.strictEqual(value.fractionExponent.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.magnitude, 0);
      assert.strictEqual(value.fractionCoefficient.numBytesRead, 1);
    });
    it('should read symbols', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16)]
      ));
      value = scalarValueReader.read(IonTypes["symbol"],0,1);
      assert.strictEqual(value, 0);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["symbol"],0,1);
      assert.strictEqual(value, 255);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["symbol"],0,2);
      assert.strictEqual(value, 65535);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16), parseInt('0x00', 16)]
      ));
      value = scalarValueReader.read(IonTypes["symbol"],0,4);
      assert.strictEqual(value, 0n);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["symbol"],0,4);
      assert.strictEqual(value, 4294967295n);

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["symbol"],0,14);
      assert.strictEqual(value, 5192296858534827628530496329220095n);
    });
    it('should read strings', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x30', 16)]
      ));
      value = scalarValueReader.read(IonTypes["string"],0,1);
      assert.strictEqual(value, "0");

      bufferReader.loadBuffer(new Uint8Array(
        [parseInt('0x30', 16), parseInt('0x30', 16), parseInt('0x30', 16), parseInt('0x30', 16),
         parseInt('0x30', 16), parseInt('0x30', 16), parseInt('0x30', 16), parseInt('0x30', 16),
         parseInt('0x30', 16), parseInt('0x30', 16), parseInt('0x30', 16), parseInt('0x30', 16),
         parseInt('0x30', 16), parseInt('0x30', 16)]
      ));
      value = scalarValueReader.read(IonTypes["string"],0,14);
      assert.strictEqual(value, "00000000000000");
    });
    it('should read clobs', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        //1 byte clob
        //{{ "\xFF" }}
        [parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["clob"],0,1);
      assert.deepStrictEqual(value, new Uint8Array([255]));

      bufferReader.loadBuffer(new Uint8Array(
        //13 byte clob
        //{{"\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF"}}
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), 
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["clob"],0,13);
      assert.deepStrictEqual(value, new Uint8Array([255,255,255,255,255,255,255,255,255,255,255,255,255]));
    });
    it('should read blobs', function() {
      let value;
      bufferReader.loadBuffer(new Uint8Array(
        //1 byte blob
        //{{/w==}} (base64 representation)
        [parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["clob"],0,1);
      assert.deepStrictEqual(value, new Uint8Array([255]));

      bufferReader.loadBuffer(new Uint8Array(
        //13 byte blob
        //{{/////////////////w==}} (base64 representation)
        [parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), 
         parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
         parseInt('0xFF', 16)]
      ));
      value = scalarValueReader.read(IonTypes["clob"],0,13);
      assert.deepStrictEqual(value, new Uint8Array([255,255,255,255,255,255,255,255,255,255,255,255,255]));
    });
  });
});