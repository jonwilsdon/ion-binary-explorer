const { assert } = require('chai');
const tdr = require("../../src/core/TypeDescriptorReader");
const br = require('../../src/core/ByteReader');
const bbr = require('../../src/core/ByteBufferReader');
const types = require('../../src/core/IonTypes');
const ie = require('../../src/core/IonElement');
const er = require('../../src/core/ElementReference');
const { IonTypes } = require('../../src/core/IonTypes');
let tdReader;

// 0xE0 01 00 EA (BVM)
const bvmBuf = [parseInt('0xE0', 16), parseInt('0x01', 16), parseInt('0x00', 16), parseInt('0xEA', 16)];

// 0x21 FF (int+ 255)
// 0x20    (int+ 0)
const intBuf = [parseInt('0x21', 16), parseInt('0xFF', 16), parseInt('0x20', 16)];

const createReader = (reader) => {
  return new tdr.TypeDescriptorReader(reader);
};

const createBufferByteReader = (hexToTest) => {
  const buf = new Uint8Array(hexToTest);
  const byteReader = new bbr.ByteBufferReader();
  byteReader.loadBuffer(buf);
  return byteReader;
};

const createNibbleStruct = () => {
  return {
    annotation: {},
    depth: 0,
    element: {
      lengthValue: 0,
      nibbles: {
        lengthEnd: 1,
        lengthStart: 1,
        type: 0
      },
      totalLength: 0,
      typeName: "",
      typeValue: 0
    },
    fieldName: null,
    offset: 0,
    totalNibbles: 1
  };
};

describe('IonElement', function() {
  describe("constructor", function () {
    it('should error when not passed an ElementReference', function() {
      let element;
      assert.throws(() => 
                    { element = new ie.IonElement(); },
                    Error);

      assert.throws(() => 
                    { element = new ie.IonElement(0); }, 
                    Error);

      assert.throws(() => 
                    { element = new ie.IonElement([0, 0, 0, 0, 0, 0]); }, 
                    Error);

      assert.doesNotThrow(() => 
                    { element = new ie.IonElement(er.createElementReference(0, 0, 0, 0, 0, IonTypes["list"], 0)); });
    });
    it('should succeed when passed all parameters', function() {
      const containerType = IonTypes["struct"];
      const containerOffset = 0;
      const fileOffset = 1;
      const positionInStream = 5;
      const depth = 4;
      const bytesRemainingAtDepth = 3;
      const next = null;
      const reference = er.createElementReference(fileOffset, positionInStream, depth, bytesRemainingAtDepth, 
                                                containerOffset, containerType, next);
      const element = new ie.IonElement(reference);
      assert.strictEqual(element.absoluteOffset, fileOffset+positionInStream);
      assert.strictEqual(element.relativeOffset, positionInStream);
      assert.strictEqual(element.depth, depth);
      assert.strictEqual(element.bytesRemainingAtDepth, bytesRemainingAtDepth);
      assert.strictEqual(element.container, containerOffset);
      assert.strictEqual(element.containerType, containerType);
      assert.strictEqual(element.nextElementReference, next);
    });
  });
  describe("readTypeDescriptor", function () {
    it('should fail when called with no bytes remaining at depth', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 0, null, null, null));
      assert.throws(() => { 
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(bvmBuf))); },
                    Error);
    });
    it('should read BVM and set as system element', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(bvmBuf)), "bvm");
      assert.strictEqual(element.depth, 0);
      assert.strictEqual(element.isSystemElement, true);
    });
    it('should fail when BVM appears at depth greater than zero', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 1, 4, null, null, null));
      assert.throws(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(bvmBuf)), "bvm"),
        Error });
    });
    it('should fail when passed BVM context for non-BVM value', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 3, null, null, null));
      assert.throws(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(intBuf)), "bvm"),
        Error });
    });
    it('should create the next element if there are bytes remaining', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 3, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(intBuf)), "1_0");
      assert.equal(element.nextElementReference !== null, true);
      assert.equal(element.nextElementReference[1], 2);
    });
    it('should not create a next element if there are no bytes remaining', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0x20 (int+ 0)
            [parseInt('0x20', 16)])), "1_0");
      assert.strictEqual(element.nextElementReference, null);
    });
    it('should create a child element for container elements', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 2, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0xB1 00 (1 byte empty list [])
            [parseInt('0xB1', 16), parseInt('0x00', 16)])), "1_0");
      assert.notStrictEqual(element.containsElement, null);
      assert.equal(element.containsElement[1], 1);
    });
    it('should not create child elements for non-container elements', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0x20 (int+ 0)
            [parseInt('0x20', 16)])), "1_0");
      assert.strictEqual(element.containsElement, null);
    });
    it('should read elements properly if in a struct', function () {
      const reader = createReader(
        createBufferByteReader(
          // D3 81 81 30 (3 byte struct { $ion:"0" })
          [parseInt('0xD3', 16), parseInt('0x81', 16), parseInt('0x81', 16), parseInt('0x30', 16)]));
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      structElement.readTypeDescriptor(reader, "1_0");
      const element = new ie.IonElement(er.createElementReference(0, 1, 1, 3, 0, IonTypes["struct"], null));
      element.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(structElement.type, IonTypes["struct"]);
      assert.strictEqual(structElement.length, 3);
      assert.strictEqual(element.type, IonTypes["string"]);
      assert.strictEqual(element.container, structElement.relativeOffset);
      assert.strictEqual(element.depth, 1);
      assert.strictEqual(element.fieldNameSymbolID, 1);
      assert.strictEqual(element.isSystemElement, false);
      assert.strictEqual(element.annotationsLength, 0);
    });
    it('should set struct element with NOP value as system element', function () {
      let reader = createReader(
        createBufferByteReader(
          // D3 80 01 AC (empty struct with three bytes of padding)
          [parseInt('0xD3', 16), parseInt('0x80', 16), parseInt('0x01', 16), parseInt('0xAC', 16)]));
      let structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      let element = new ie.IonElement(er.createElementReference(0, 1, 1, 3, 0, IonTypes["struct"], null));
      structElement.readTypeDescriptor(reader, "1_0");
      element.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(structElement.type, IonTypes["struct"]);
      assert.strictEqual(element.type, IonTypes["nop"]);
      assert.strictEqual(element.container, structElement.relativeOffset);
      assert.strictEqual(element.isSystemElement, true);

      reader = createReader(
        createBufferByteReader(
          // D2 8F 00 (empty struct with two bytes of padding)
          [parseInt('0xD2', 16), parseInt('0x8F', 16), parseInt('0x00', 16)]));
      structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 3, null, null, null));
      element = new ie.IonElement(er.createElementReference(0, 1, 1, 2, 
                                                           structElement.relativeOffset, IonTypes["struct"], null));
      structElement.readTypeDescriptor(reader, "1_0");
      element.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(structElement.type, IonTypes["struct"]);
      assert.strictEqual(element.type, IonTypes["nop"]);
      assert.strictEqual(element.container, structElement.relativeOffset);
      assert.strictEqual(element.isSystemElement, true);
    });
    it('should set sorted flag for sorted structs', function () {
      const reader = createReader(
        createBufferByteReader(
          // D1 83 81 81 30 (3 byte struct { $ion:"0" })
          [parseInt('0xD1', 16), parseInt('0x83', 16), parseInt('0x81', 16), parseInt('0x81', 16), parseInt('30', 16)]));
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 5, null, null, null));
      structElement.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(structElement.type, IonTypes["struct"]);
      assert.strictEqual(structElement.isSorted, true);
    });
    it('should fail when sorted struct is empty', function () {
      const reader = createReader(
        createBufferByteReader(
          // D1 80 01 AC (empty sorted struct with length 0 and two bytes of padding)
          [parseInt('0xD1', 16), parseInt('0x80', 16), parseInt('0x01', 16), parseInt('AC', 16)]));
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      assert.throws(() => {
        structElement.readTypeDescriptor(reader, "1_0");
        }, Error);

      // TODO: create this test in DOM and Value 
      // D1 82 01 AC (empty sorted struct with length 2 and two bytes of padding)
      // [parseInt('0xD1', 16), parseInt('0x82', 16), parseInt('0x01', 16), parseInt('AC', 16)]
    });
    it('should set shared system tables at depth 0 as system elements', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      assert.doesNotThrow(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(
              // E3 81 89 D0 (3 byte annotation wrapping 0 byte struct ($ion_shared_symbol_table::{}))
              [parseInt('0xE3', 16), parseInt('0x81', 16), parseInt('0x89', 16),
               parseInt('0xD0', 16)])), "1_0"); });
      
      assert.strictEqual(element.annotationsLength, 1);
      assert.strictEqual(element.type, IonTypes["struct"]);
      assert.strictEqual(element.isSystemElement, true);
    });
    it('should set local system tables at depth 0 as system elements', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      assert.doesNotThrow(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(
              // E3 81 83 D0 (3 byte annotation wrapping 0 byte struct ($ion_shared_symbol_table::{}))
              [parseInt('0xE3', 16), parseInt('0x81', 16), parseInt('0x83', 16),
               parseInt('0xD0', 16)])), "1_0"); });
      
      assert.strictEqual(element.annotationsLength, 1);
      assert.strictEqual(element.type, IonTypes["struct"]);
      assert.strictEqual(element.isSystemElement, true);
    });
    it('should warn when symbol tables appear at depth greater than 0', function () {
      const reader = createReader(
        createBufferByteReader(
          // D4 81 E3 81 89 D0 ({$ion: $ion_shared_symbol_table::{}})
          [parseInt('0xD4', 16), parseInt('0x81', 16), parseInt('0xE3', 16), parseInt('0x81', 16),
            parseInt('0x89', 16), parseInt('0xD0', 16)]));
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 6, null, null, null));
      const element = new ie.IonElement(er.createElementReference(0, 1, 15, 5, structElement.relativeOffset, 
                                                                IonTypes["struct"], null));
      structElement.readTypeDescriptor(reader, "1_0");
      assert.throws(() => {
        element.readTypeDescriptor(reader, "1_0"); },
        Error);
      
      assert.strictEqual(structElement.type, IonTypes["struct"]);
      assert.strictEqual(element.isSystemElement, false);
    });
    it('should fail when annotations wrap other annotations', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 6, null, null, null));
      assert.throws(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(
              // E6 81 81 E3 81 81 80 (1 byte annotation wrapping 3 byte annotation ($ion::$ion::""))
              [parseInt('0xE6', 16), parseInt('0x81', 16), parseInt('0x81', 16),
               parseInt('0xE3', 16), parseInt('0x81', 16), parseInt('0x81', 16), parseInt('0x80', 16)])), "1_0"); },
              Error);
    });
    it('should set annotation wrapper and read element inside of wrapper', function () {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 7, null, null, null));
      assert.doesNotThrow(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(
              // E6 81 81 D3 81 81 30 (1 byte annotation wrapping 3 byte struct ($ion::{$ion:"0"}))
              [parseInt('0xE6', 16), parseInt('0x81', 16), parseInt('0x81', 16),
               parseInt('0xD3', 16), parseInt('0x81', 16), parseInt('0x81', 16), parseInt('0x30', 16)])), "1_0"); });
      
      assert.strictEqual(element.annotationsLength, 1);
      assert.strictEqual(element.type, IonTypes["struct"]);
      assert.strictEqual(element.length, 6);
    });
    it('should fail when annotations wrap NOPs', function () {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      assert.throws(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(
              // 0xE3 0x81 0x84 0x00
              [parseInt('0xE3', 16), parseInt('0x81', 16),
               parseInt('0x84', 16), parseInt('0x00', 16)])), "1_0"); },
              Error);
    });
    it('should fail when annotations wrap NOP elements', function () {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      assert.throws(() => {
        element.readTypeDescriptor(
          createReader(
            createBufferByteReader(
              // E4 81 84 02 FF (3 byte annotation wrapping 2 byte NOP)
              [parseInt('0xE4', 16), parseInt('0x81', 16), parseInt('0x84', 16), 
               parseInt('0x02', 16), parseInt('0xFF', 16)])), "1_0"); },
              Error);
      
      const reader = createReader(
        createBufferByteReader(
          // D5 80 E3 81 84 00 ({$0:name::1 byte NOP})
          [parseInt('0xD5', 16), parseInt('0x80', 16), parseInt('0xE3', 16), parseInt('0x81', 16),
          parseInt('0x84', 16), parseInt('0x00', 16)]), "1_0");
      let structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 6, null, null, null));
      structElement.readTypeDescriptor(reader, "1_0");
      element = new ie.IonElement(er.createElementReference(0, 1, 1, 5, structElement.absoluteOffset, 
                                                            IonTypes["struct"], null));
      assert.throws(() => {
        element.readTypeDescriptor(reader, "1_0"); },
              Error);
    });
    it('should set NOPs as system elements', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0x00 (1 byte NOP)
            [parseInt('0x00', 16)])), "1_0");
      assert.strictEqual(element.type, IonTypes["nop"]);
      assert.strictEqual(element.isSystemElement, true);
    });
    it('should read nested containers', function () {
      const reader = createReader(
        createBufferByteReader(
          // $ion_symbol_table::{
          //   symbols: ["age", "years"] 
          // }
          // 17 byte (0x91) annotation wrapper
          //   1 byte (0x81) annot_length
          //     (0x83) $ion_symbol_table::
          //   13 byte (0x8D) (doesn't need separate length) struct
          //     (0x87) field name: symbols
          //     10 byte (0x8A) (doesn't need separate length) list 
          //       3 byte (0x83) string: age
          //       5 byte (0x85) string: years
          // EE 91 81 83 DE 8D 87 BE A2 83 61 67 65 85 79 65 61 72 73
          [parseInt('0xEE', 16), parseInt('0x91', 16), parseInt('0x81', 16), parseInt('0x83', 16),
           parseInt('0xDE', 16), parseInt('0x8D', 16), parseInt('0x87', 16), parseInt('0xBE', 16),
           parseInt('0x8A', 16), parseInt('0x83', 16), parseInt('0x61', 16), parseInt('0x67', 16),
           parseInt('0x65', 16), parseInt('0x85', 16), parseInt('0x79', 16), parseInt('0x65', 16),
           parseInt('0x61', 16), parseInt('0x72', 16), parseInt('0x73', 16)]));
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 19, null, null, null));
      structElement.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(structElement.type, IonTypes["struct"]);
      assert.strictEqual(structElement.annotationsLength, 1);
      assert.strictEqual(structElement.isSystemElement, true);
      assert.strictEqual(structElement.length, 18);

      const listElement = new ie.IonElement(er.createElementReference(0, structElement.bytePositionOfRepresentation, 1,
                                                                    15, structElement.relativeOffset,
                                                                    IonTypes["struct"], null));
      listElement.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(listElement.type, IonTypes["list"]);
      assert.strictEqual(listElement.length, 11);

      const ageStringElement = new ie.IonElement(er.createElementReference(0, listElement.bytePositionOfRepresentation, 2,
                                                                         listElement.lengthWithoutAnnotations - 1,
                                                                         listElement.relativeOffset, IonTypes["list"],
                                                                         null));
      ageStringElement.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(ageStringElement.type, IonTypes["string"]);

      const yearsStringElement = new ie.IonElement(er.createElementReference(0, ageStringElement.nextElementReference[1],
                                                                           2, (ageStringElement.bytesRemainingAtDepth - 
                                                                           ageStringElement.length + 1),
                                                                           listElement.relativeOffset, IonTypes["list"], 
                                                                           ageStringElement.relativeOffset));
      yearsStringElement.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(yearsStringElement.type, IonTypes["string"]);
    });
  });
  describe("getBytePositionOfRepresentation", function () {
    it('should return null for byte position of bvm and nop values', function () {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      let reader = createReader(createBufferByteReader(bvmBuf));
      element.readTypeDescriptor(reader, "bvm");
      assert.strictEqual(element.type, IonTypes["bvm"]);
      assert.strictEqual(element.bytePositionOfRepresentation, null);

      element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      reader = createReader(createBufferByteReader([parseInt('0x00', 16)]));
      element.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(element.type, IonTypes["nop"]);
      assert.strictEqual(element.bytePositionOfRepresentation, null);
    });
    it('should return null for byte position of representation of null values', function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0x2F (int+ null)
            [parseInt('0x2F', 16)])), "1_0");
      assert.strictEqual(element.bytePositionOfRepresentation, null);
    });
    it('should return null for byte position of representation of 0 length values', function () {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0x20 (int+ 0)
            [parseInt('0x20', 16)])), "1_0");
      assert.strictEqual(element.bytePositionOfRepresentation, null);

      element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0xD0 ({})
            [parseInt('0xD0', 16)])), "1_0");
      assert.strictEqual(element.bytePositionOfRepresentation, null);

      element = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // E3 81 89 D0 (3 byte annotation wrapping 0 byte struct ($ion::{}))
            [parseInt('0xE3', 16), parseInt('0x81', 16), parseInt('0x81', 16),
              parseInt('0xD0', 16)])), "1_0");
              // should fail
      assert.strictEqual(element.bytePositionOfRepresentation, null);
    });
    it('should return byte position of representation without annotations', function () {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 2, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 21 FF (1 byte positive int 255)
            [parseInt('0x21', 16), parseInt('0xFF', 16)])), "1_0");
      assert.strictEqual(element.bytePositionOfRepresentation, 1);
      assert.strictEqual(element.bytePositionOfAnnotations, null);

      element = new ie.IonElement(er.createElementReference(0, 0, 0, 16, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // VarUInt (8E = 14) byte positive int
            // 5192296858534827628530496329220095
            // 2E 8E FF FF FF FF FF FF FF FF FF FF FF FF FF FF
            [parseInt('0x2E', 16), parseInt('0x8E', 16),
             parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
             parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
             parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)])), "1_0");
      assert.strictEqual(element.bytePositionOfRepresentation, 2);
      assert.strictEqual(element.bytePositionOfAnnotations, null);
    });
    it('should return byte position of representation with annotations', function() {
      let element = new ie.IonElement(er.createElementReference(0, 0, 0, 5, null, null, null));
      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // E4 81 81 81 30 (4 byte annotation wrapper ($ion::"0"))
            [parseInt('0xE4', 16), parseInt('0x81', 16), parseInt('0x81'),
             parseInt('0x81', 16), parseInt('0x30', 16)])), "1_0");
      assert.strictEqual(element.bytePositionOfRepresentation, 4);
      assert.strictEqual(element.bytePositionOfAnnotations, 2);

      const reader = createReader(
        createBufferByteReader(
          // E3 81 89 D2 81 21 FF (3 byte annotation wrapping 2 byte struct ($ion_shared_symbol_table::{$ion:255}))
          [parseInt('0xE6', 16), parseInt('0x81', 16), parseInt('0x89', 16),
            parseInt('0xD2', 16), parseInt('0x81', 16), parseInt('0x21', 16), parseInt('0xFF', 16)]));
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 7, null, null, null));
      element = new ie.IonElement(er.createElementReference(0, 5, 1, 3, structElement.relativeOffset, null));
      structElement.readTypeDescriptor(reader, "1_0");
      element.readTypeDescriptor(reader, "1_0");
      assert.strictEqual(structElement.bytePositionOfRepresentation, 4);
      assert.strictEqual(structElement.bytePositionOfAnnotations, 2);
      assert.strictEqual(element.bytePositionOfRepresentation, 6);
      assert.strictEqual(element.bytePositionOfAnnotations, null);
    });
    // TODO: add test for bytePositionOfAnnotations when there is a fieldName as well
  });
  describe("getNibblePositionStruct", function () {
    it("should return nibble positions for empty struct", function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 1, null, null, null));
      const nibbleStruct = createNibbleStruct();
      nibbleStruct.element.totalLength = 1;
      nibbleStruct.element.typeName = "struct";
      nibbleStruct.element.typeValue = IonTypes["struct"];
      nibbleStruct.totalNibbles = 2;

      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // 0xD0 ({})
            [parseInt('0xD0', 16)])), "1_0");
      assert.deepEqual(element.nibblePositionStruct, nibbleStruct);
    });
    it("should return nibble positions for VarUInt length values", function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 16, null, null, null));
      const nibbleStruct = createNibbleStruct();
      nibbleStruct.element.lengthValue = 14;
      nibbleStruct.element.nibbles.lengthEnd = 3;
      nibbleStruct.element.nibbles.representationStart = 4;
      nibbleStruct.element.nibbles.representationEnd = 31;
      nibbleStruct.element.totalLength = 16;
      nibbleStruct.element.typeName = "int+";
      nibbleStruct.element.typeValue = IonTypes["int+"];
      nibbleStruct.totalNibbles = 32;

      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // VarUInt (8E = 14) byte positive int
            // 5192296858534827628530496329220095
            // 2E 8E FF FF FF FF FF FF FF FF FF FF FF FF FF FF
            [parseInt('0x2E', 16), parseInt('0x8E', 16),
             parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
             parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16),
             parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16), parseInt('0xFF', 16)])), "1_0");
      assert.deepEqual(element.nibblePositionStruct, nibbleStruct);
    });
    it("should return nibble positions for values with one annotation", function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 5, null, null, null));
      const nibbleStruct = createNibbleStruct();
      nibbleStruct.annotation.lengthValue = 1;
      nibbleStruct.annotation.annotations = [];
      nibbleStruct.annotation.annotations.push({ nibbles: { symbolStart: 4, symbolEnd: 5 }, symbolMagnitude: 1 });
      nibbleStruct.annotation.nibbles = { type: 0, wrapperLengthStart: 1, wrapperLengthEnd: 1, annotationsLengthStart: 2, annotationsLengthEnd: 3 };
      nibbleStruct.annotation.wrapperLengthValue = 4;
      nibbleStruct.element.lengthValue = 1;
      nibbleStruct.element.nibbles = { type: 6, lengthStart: 7, lengthEnd: 7, representationStart: 8, representationEnd: 9 };
      nibbleStruct.element.totalLength = 5;
      nibbleStruct.element.typeName = "string";
      nibbleStruct.element.typeValue = IonTypes["string"];
      nibbleStruct.totalNibbles = 10;

      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // E4 81 81 81 30 (4 byte annotation wrapper ($ion::"0"))
            [parseInt('0xE4', 16), parseInt('0x81', 16), parseInt('0x81'),
             parseInt('0x81', 16), parseInt('0x30', 16)])), "1_0");
      assert.deepEqual(element.nibblePositionStruct, nibbleStruct);
    });
    it("should return nibble positions for values with multiple annotations", function () {
      const element = new ie.IonElement(er.createElementReference(0, 0, 0, 20, null, null, null));
      const nibbleStruct = createNibbleStruct();
      nibbleStruct.annotation.lengthValue = 15;
      nibbleStruct.annotation.annotations = [];
      nibbleStruct.annotation.annotations.push({ nibbles: { symbolStart: 6, symbolEnd: 7 }, symbolMagnitude: 127 });
      nibbleStruct.annotation.annotations.push({ nibbles: { symbolStart: 8, symbolEnd: 11 }, symbolMagnitude: 16383 });
      nibbleStruct.annotation.annotations.push({ nibbles: { symbolStart: 12, symbolEnd: 17 }, symbolMagnitude: 2097151 });
      nibbleStruct.annotation.annotations.push({ nibbles: { symbolStart: 18, symbolEnd: 25 }, symbolMagnitude: 268435455 });
      nibbleStruct.annotation.annotations.push({ nibbles: { symbolStart: 26, symbolEnd: 35 }, symbolMagnitude: 34359738367 });
      nibbleStruct.annotation.nibbles = { type: 0, wrapperLengthStart: 1, wrapperLengthEnd: 3, annotationsLengthStart: 4, annotationsLengthEnd: 5 };
      nibbleStruct.annotation.wrapperLengthValue = 19;
      nibbleStruct.element.lengthValue = 1;
      nibbleStruct.element.nibbles = { type: 36, lengthStart: 37, lengthEnd: 37, representationStart: 38, representationEnd: 39 };
      nibbleStruct.element.totalLength = 20;
      nibbleStruct.element.typeName = "string";
      nibbleStruct.element.typeValue = IonTypes["string"];
      nibbleStruct.totalNibbles = 40;

      element.readTypeDescriptor(
        createReader(
          createBufferByteReader(
            // EE 91 8F FF 7F FF 7F 7F FF 7F 7F 7F FF 7F 7F 7F 7F FF 81 30 (18 byte annotation wrapper ($ion::"0"))
            // $127::$16383::$2097151::$268435455::$34359738367::"0"
            [parseInt('0xEE', 16), parseInt('0x92', 16), // T/L
             parseInt('0x8F'), // annot_length
             parseInt('0xFF'), // 127
             parseInt('0x7F'), parseInt('0xFF'), // 16,383
             parseInt('0x7F'), parseInt('0x7F'), parseInt('0xFF'), // 2,097,151
             parseInt('0x7F'), parseInt('0x7F'), parseInt('0x7F'), parseInt('0xFF'), // 268,435,455
             parseInt('0x7F'), parseInt('0x7F'), parseInt('0x7F'), parseInt('0x7F'), parseInt('0xFF'), // 34,359,738,367
             parseInt('0x81', 16), parseInt('0x30', 16)])), "1_0");
      assert.deepEqual(element.nibblePositionStruct, nibbleStruct);
    });
    it("should return nibble positions for nop element with field name", function () {
      const nibbleStruct = createNibbleStruct();
      nibbleStruct.depth = 1;
      nibbleStruct.fieldName = { symbolMagnitude: 0, nibbles: { symbolStart: 0, symbolEnd: 1 }};
      nibbleStruct.element.lengthValue = 1;
      nibbleStruct.element.nibbles = { type: 2, lengthStart:3, lengthEnd:3, representationStart: 4, representationEnd: 5 };
      nibbleStruct.element.totalLength = 3;
      nibbleStruct.element.typeName = "nop";
      nibbleStruct.element.typeValue = IonTypes["nop"];
      nibbleStruct.offset = 1;
      nibbleStruct.totalNibbles = 6;

      const reader = createReader(
        createBufferByteReader(
          // D3 80 01 FF (empty struct - with 3 bytes of padding)
          [parseInt('0xD3', 16), parseInt('0x80'), parseInt('0x01'), parseInt('0xFF')]));
  
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 4, null, null, null));
      structElement.readTypeDescriptor(reader, "1_0");
      const element = new ie.IonElement(er.createElementReference(0, 1, 1, 3, structElement.relativeOffset,
                                                                IonTypes["struct"], null));
      element.readTypeDescriptor(reader, "1_0");
      assert.deepEqual(element.nibblePositionStruct, nibbleStruct);
    });
    it("should return nibble positions for element with field name > 127", function () {
      const nibbleStruct = createNibbleStruct();
      nibbleStruct.depth = 1;
      nibbleStruct.fieldName = { symbolMagnitude: 128, nibbles: { symbolStart: 0, symbolEnd: 3 }};
      nibbleStruct.element.lengthValue = 1;
      nibbleStruct.element.nibbles = { type: 4, lengthStart:5, lengthEnd:5, representationStart: 6, representationEnd: 7 };
      nibbleStruct.element.totalLength = 4;
      nibbleStruct.element.typeName = "nop";
      nibbleStruct.element.typeValue = IonTypes["nop"];
      nibbleStruct.offset = 1;
      nibbleStruct.totalNibbles = 8;

      const reader = createReader(
        createBufferByteReader(
          // D3 01 80 01 FF (empty struct - with 4 bytes of padding)
          [parseInt('0xD3', 16), parseInt('0x01'), parseInt('0x80'), parseInt('0x01'), parseInt('0xFF')]));
  
      const structElement = new ie.IonElement(er.createElementReference(0, 0, 0, 5, null, null, null));
      structElement.readTypeDescriptor(reader, "1_0");
      const element = new ie.IonElement(er.createElementReference(0, 1, 1, 4, structElement.relativeOffset,
                                                                IonTypes["struct"], null));
      element.readTypeDescriptor(reader, "1_0");
      assert.deepEqual(element.nibblePositionStruct, nibbleStruct);
    });
  });
});