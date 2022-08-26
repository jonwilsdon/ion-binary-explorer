'use strict';

const br = require('./ByteReader');
const IonTypes = require('./IonTypes').IonTypes;

/**
 * Reads the type descriptor
 * 
 * @summary
 * A value consists of a one-octet type descriptor, possibly followed by a length in octets, possibly followed
 * by a representation.
 * 
 * @example
 *        7       4 3       0
 *       +---------+---------+
 * value |    T    |    L    |
 *       +---------+---------+======+
 *       :     length [VarUInt]     :
 *       +==========================+
 *       :      representation      :
 *       +==========================+
 * 
 * @description
 * The type descriptor octet has two subfields: a four-bit type code T, and a four-bit length L.
 * 
 * Each value of T identifies the format of the representation, and generally (though not always) identifies an
 * Ion datatype. Each type code T defines the semantics of its length field L as described below.
 * 
 * The length value – the number of octets in the representation field(s) – is encoded in L and/or length fields,
 * depending on the magnitude and on some particulars of the actual type. The length field is empty (taking up no
 * octets in the message) if we can store the length value inside L itself. If the length field is not empty,
 * then it is a single VarUInt field. The representation may also be empty (no octets) in some cases,
 * as detailed below.
 * 
 * Unless otherwise defined, the length of the representation is encoded as follows:
 *   If the value is null (for that type), then L is set to 15.
 *   If the representation is less than 14 bytes long, then L is set to the length, and the length field is omitted.
 *   If the representation is at least 14 bytes long, then L is set to 14, and the length field is set to the
 *     representation length, encoded as a VarUInt field.
 */
class TypeDescriptorReader {

  /**
   * Mapping of all 256 (1 byte) Ion 1.0 type descriptors
   */
  #typeDescriptors_1_0 = [
    /* 0x00 - nop padding         */ () => ({ type: IonTypes["nop"], length: 0, isNull: false }),
    /* 0x01 - nop padding         */ () => ({ type: IonTypes["nop"], length: 1, isNull: false }), 
    /* 0x02 - nop padding         */ () => ({ type: IonTypes["nop"], length: 2, isNull: false }), 
    /* 0x03 - nop padding         */ () => ({ type: IonTypes["nop"], length: 3, isNull: false }),
    /* 0x04 - nop padding         */ () => ({ type: IonTypes["nop"], length: 4, isNull: false }),
    /* 0x05 - nop padding         */ () => ({ type: IonTypes["nop"], length: 5, isNull: false }),
    /* 0x06 - nop padding         */ () => ({ type: IonTypes["nop"], length: 6, isNull: false }),
    /* 0x07 - nop padding         */ () => ({ type: IonTypes["nop"], length: 7, isNull: false }),
    /* 0x08 - nop padding         */ () => ({ type: IonTypes["nop"], length: 8, isNull: false }),
    /* 0x09 - nop padding         */ () => ({ type: IonTypes["nop"], length: 9, isNull: false }),
    /* 0x0a - nop padding         */ () => ({ type: IonTypes["nop"], length: 10, isNull: false }),
    /* 0x0b - nop padding         */ () => ({ type: IonTypes["nop"], length: 11, isNull: false }),
    /* 0x0c - nop padding         */ () => ({ type: IonTypes["nop"], length: 12, isNull: false }),
    /* 0x0d - nop padding         */ () => ({ type: IonTypes["nop"], length: 13, isNull: false }),
    /* 0x0e - nop padding         */ () => ({ type: IonTypes["nop"], length: 14, isNull: false }), // VarUInt
    /* 0x0f - null (null)         */ () => ({ type: IonTypes["null"], length: 0, isNull: true }),
    /* 0x10 - bool - false        */ () => ({ type: IonTypes["bool"], length: 0, isNull: false, bool: false }),
    /* 0x11 - bool - true         */ () => ({ type: IonTypes["bool"], length: 0, isNull: false, bool: true }),
    /* 0x12 - invalid bool        */ () => this.#typeDescriptorError("0x12"),
    /* 0x13 - invalid bool        */ () => this.#typeDescriptorError("0x13"),
    /* 0x14 - invalid bool        */ () => this.#typeDescriptorError("0x14"),
    /* 0x15 - invalid bool        */ () => this.#typeDescriptorError("0x15"),
    /* 0x16 - invalid bool        */ () => this.#typeDescriptorError("0x16"),
    /* 0x17 - invalid bool        */ () => this.#typeDescriptorError("0x17"),
    /* 0x18 - invalid bool        */ () => this.#typeDescriptorError("0x18"),
    /* 0x19 - invalid bool        */ () => this.#typeDescriptorError("0x19"),
    /* 0x1a - invalid bool        */ () => this.#typeDescriptorError("0x1a"),
    /* 0x1b - invalid bool        */ () => this.#typeDescriptorError("0x1b"),
    /* 0x1c - invalid bool        */ () => this.#typeDescriptorError("0x1c"),
    /* 0x1d - invalid bool        */ () => this.#typeDescriptorError("0x1d"),
    /* 0x1e - invalid bool        */ () => this.#typeDescriptorError("0x1e"),
    /* 0x1f - bool (null)         */ () => ({ type: IonTypes["bool"], length: 0, isNull: true }),
    /* 0x20 - int (pos) - 0       */ () => ({ type: IonTypes["int+"], length: 0, isNull: false }),
    /* 0x21 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 1, isNull: false }),
    /* 0x22 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 2, isNull: false }),
    /* 0x23 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 3, isNull: false }),
    /* 0x24 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 4, isNull: false }),
    /* 0x25 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 5, isNull: false }),
    /* 0x26 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 6, isNull: false }),
    /* 0x27 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 7, isNull: false }),
    /* 0x28 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 8, isNull: false }),
    /* 0x29 - int (pos)           */ () => ({ type: IonTypes["int+"], length: 9, isNull: false }),
    /* 0x2a - int (pos)           */ () => ({ type: IonTypes["int+"], length: 10, isNull: false }),
    /* 0x2b - int (pos)           */ () => ({ type: IonTypes["int+"], length: 11, isNull: false }),
    /* 0x2c - int (pos)           */ () => ({ type: IonTypes["int+"], length: 12, isNull: false }),
    /* 0x2d - int (pos)           */ () => ({ type: IonTypes["int+"], length: 13, isNull: false }),
    /* 0x2e - int (pos) (L >= 14) */ () => ({ type: IonTypes["int+"], length: 14, isNull: false }), // VarUInt
    /* 0x2f - int (pos) (null)    */ () => ({ type: IonTypes["int+"], length: 0, isNull: true }), // NOTE: no magnitude
    /* 0x30 - invalid int         */ () => this.#typeDescriptorError("0x30"),
    /* 0x31 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 1, isNull: false }),
    /* 0x32 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 2, isNull: false }),
    /* 0x33 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 3, isNull: false }),
    /* 0x34 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 4, isNull: false }),
    /* 0x35 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 5, isNull: false }),
    /* 0x36 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 6, isNull: false }),
    /* 0x37 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 7, isNull: false }),
    /* 0x38 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 8, isNull: false }),
    /* 0x39 - int (neg)           */ () => ({ type: IonTypes["int-"], length: 9, isNull: false }),
    /* 0x3a - int (neg)           */ () => ({ type: IonTypes["int-"], length: 10, isNull: false }),
    /* 0x3b - int (neg)           */ () => ({ type: IonTypes["int-"], length: 11, isNull: false }),
    /* 0x3c - int (neg)           */ () => ({ type: IonTypes["int-"], length: 12, isNull: false }),
    /* 0x3d - int (neg)           */ () => ({ type: IonTypes["int-"], length: 13, isNull: false }),
    /* 0x3e - int (neg) (L >= 14) */ () => ({ type: IonTypes["int-"], length: 14, isNull: false }), // VarUInt
    /* 0x3f - int (neg) (null)    */ () => ({ type: IonTypes["int-"], length: 0, isNull: true }), // NOTE: no magnitude
    /* 0x40 - float - 0e0         */ () => ({ type: IonTypes["float"], length: 0, isNull: false }),
    /* 0x41 - invalid float       */ () => this.#typeDescriptorError("0x41"),
    /* 0x42 - invalid float       */ () => this.#typeDescriptorError("0x42"), // reserved for 16 bit floats
    /* 0x43 - invalid float       */ () => this.#typeDescriptorError("0x43"),
    /* 0x44 - float (32 bits)     */ () => ({ type: IonTypes["float"], length: 4, isNull: false }),
    /* 0x45 - invalid float       */ () => this.#typeDescriptorError("0x45"),
    /* 0x46 - invalid float       */ () => this.#typeDescriptorError("0x46"),
    /* 0x47 - invalid float       */ () => this.#typeDescriptorError("0x47"),
    /* 0x48 - float (64 bits)     */ () => ({ type: IonTypes["float"], length: 8, isNull: false }),
    /* 0x49 - invalid float       */ () => this.#typeDescriptorError("0x49"),
    /* 0x4a - invalid float       */ () => this.#typeDescriptorError("0x4a"),
    /* 0x4b - invalid float       */ () => this.#typeDescriptorError("0x4b"),
    /* 0x4c - invalid float       */ () => this.#typeDescriptorError("0x4c"),
    /* 0x4d - invalid float       */ () => this.#typeDescriptorError("0x4d"),
    /* 0x4e - invalid float       */ () => this.#typeDescriptorError("0x4e"),
    /* 0x4f - float (null)        */ () => ({ type: IonTypes["float"], length: 0, isNull: true }),
    /* 0x50 - decimal - 0d0       */ () => ({ type: IonTypes["decimal"], length: 0, isNull: false }),
    /* 0x51 - decimal             */ () => ({ type: IonTypes["decimal"], length: 1, isNull: false }),
    /* 0x52 - decimal             */ () => ({ type: IonTypes["decimal"], length: 2, isNull: false }),
    /* 0x53 - decimal             */ () => ({ type: IonTypes["decimal"], length: 3, isNull: false }),
    /* 0x54 - decimal             */ () => ({ type: IonTypes["decimal"], length: 4, isNull: false }),
    /* 0x55 - decimal             */ () => ({ type: IonTypes["decimal"], length: 5, isNull: false }),
    /* 0x56 - decimal             */ () => ({ type: IonTypes["decimal"], length: 6, isNull: false }),
    /* 0x57 - decimal             */ () => ({ type: IonTypes["decimal"], length: 7, isNull: false }),
    /* 0x58 - decimal             */ () => ({ type: IonTypes["decimal"], length: 8, isNull: false }),
    /* 0x59 - decimal             */ () => ({ type: IonTypes["decimal"], length: 9, isNull: false }),
    /* 0x5a - decimal             */ () => ({ type: IonTypes["decimal"], length: 10, isNull: false }),
    /* 0x5b - decimal             */ () => ({ type: IonTypes["decimal"], length: 11, isNull: false }),
    /* 0x5c - decimal             */ () => ({ type: IonTypes["decimal"], length: 12, isNull: false }),
    /* 0x5d - decimal             */ () => ({ type: IonTypes["decimal"], length: 13, isNull: false }),
    /* 0x5e - decimal (L >= 14)   */ () => ({ type: IonTypes["decimal"], length: 14, isNull: false }), // VarUInt
    /* 0x5f - decimal (null)      */ () => ({ type: IonTypes["decimal"], length: 0, isNull: true }),
    /* 0x60 - invalid timestamp   */ () => this.#typeDescriptorError("0x60"),
    /* 0x61 - invalid timestamp   */ () => this.#typeDescriptorError("0x61"),
    /* 0x62 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 2, isNull: false }),
    /* 0x63 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 3, isNull: false }),
    /* 0x64 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 4, isNull: false }),
    /* 0x65 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 5, isNull: false }),
    /* 0x66 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 6, isNull: false }),
    /* 0x67 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 7, isNull: false }),
    /* 0x68 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 8, isNull: false }),
    /* 0x69 - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 9, isNull: false }),
    /* 0x6a - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 10, isNull: false }),
    /* 0x6b - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 11, isNull: false }),
    /* 0x6c - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 12, isNull: false }),
    /* 0x6d - timestamp           */ () => ({ type: IonTypes["timestamp"], length: 13, isNull: false }),
    /* 0x6e - timestamp (L >= 14) */ () => ({ type: IonTypes["timestamp"], length: 14, isNull: false }), // VarUInt
    /* 0x6f - timestamp (null)    */ () => ({ type: IonTypes["timestamp"], length: 0, isNull: true }),
    /* 0x70 - symbol - $0 (SID0)  */ () => ({ type: IonTypes["symbol"], length: 0, isNull: false }),
    /* 0x71 - symbol              */ () => ({ type: IonTypes["symbol"], length: 1, isNull: false }),
    /* 0x72 - symbol              */ () => ({ type: IonTypes["symbol"], length: 2, isNull: false }),
    /* 0x73 - symbol              */ () => ({ type: IonTypes["symbol"], length: 3, isNull: false }),
    /* 0x74 - symbol              */ () => ({ type: IonTypes["symbol"], length: 4, isNull: false }),
    /* 0x75 - symbol              */ () => ({ type: IonTypes["symbol"], length: 5, isNull: false }),
    /* 0x76 - symbol              */ () => ({ type: IonTypes["symbol"], length: 6, isNull: false }),
    /* 0x77 - symbol              */ () => ({ type: IonTypes["symbol"], length: 7, isNull: false }),
    /* 0x78 - symbol              */ () => ({ type: IonTypes["symbol"], length: 8, isNull: false }),
    /* 0x79 - symbol              */ () => ({ type: IonTypes["symbol"], length: 9, isNull: false }),
    /* 0x7a - symbol              */ () => ({ type: IonTypes["symbol"], length: 10, isNull: false }),
    /* 0x7b - symbol              */ () => ({ type: IonTypes["symbol"], length: 11, isNull: false }),
    /* 0x7c - symbol              */ () => ({ type: IonTypes["symbol"], length: 12, isNull: false }),
    /* 0x7d - symbol              */ () => ({ type: IonTypes["symbol"], length: 13, isNull: false }),
    /* 0x7e - symbol (L >= 14)    */ () => ({ type: IonTypes["symbol"], length: 14, isNull: false }), // VarUInt
    /* 0x7f - symbol (null)       */ () => ({ type: IonTypes["symbol"], length: 0, isNull: true }),
    /* 0x80 - string - ""         */ () => ({ type: IonTypes["string"], length: 0, isNull: false }),
    /* 0x81 - string              */ () => ({ type: IonTypes["string"], length: 1, isNull: false }),
    /* 0x82 - string              */ () => ({ type: IonTypes["string"], length: 2, isNull: false }),
    /* 0x83 - string              */ () => ({ type: IonTypes["string"], length: 3, isNull: false }),
    /* 0x84 - string              */ () => ({ type: IonTypes["string"], length: 4, isNull: false }),
    /* 0x85 - string              */ () => ({ type: IonTypes["string"], length: 5, isNull: false }),
    /* 0x86 - string              */ () => ({ type: IonTypes["string"], length: 6, isNull: false }),
    /* 0x87 - string              */ () => ({ type: IonTypes["string"], length: 7, isNull: false }),
    /* 0x88 - string              */ () => ({ type: IonTypes["string"], length: 8, isNull: false }),
    /* 0x89 - string              */ () => ({ type: IonTypes["string"], length: 9, isNull: false }),
    /* 0x8a - string              */ () => ({ type: IonTypes["string"], length: 10, isNull: false }),
    /* 0x8b - string              */ () => ({ type: IonTypes["string"], length: 11, isNull: false }),
    /* 0x8c - string              */ () => ({ type: IonTypes["string"], length: 12, isNull: false }),
    /* 0x8d - string              */ () => ({ type: IonTypes["string"], length: 13, isNull: false }),
    /* 0x8e - string (L >= 14)    */ () => ({ type: IonTypes["string"], length: 14, isNull: false }), // VarUInt
    /* 0x8f - string (null)       */ () => ({ type: IonTypes["string"], length: 0, isNull: true }),
    /* 0x90 - clob                */ () => ({ type: IonTypes["clob"], length: 0, isNull: false }), // 0 length clobs are legal
    /* 0x91 - clob                */ () => ({ type: IonTypes["clob"], length: 1, isNull: false }),
    /* 0x92 - clob                */ () => ({ type: IonTypes["clob"], length: 2, isNull: false }),
    /* 0x93 - clob                */ () => ({ type: IonTypes["clob"], length: 3, isNull: false }),
    /* 0x94 - clob                */ () => ({ type: IonTypes["clob"], length: 4, isNull: false }),
    /* 0x95 - clob                */ () => ({ type: IonTypes["clob"], length: 5, isNull: false }),
    /* 0x96 - clob                */ () => ({ type: IonTypes["clob"], length: 6, isNull: false }),
    /* 0x97 - clob                */ () => ({ type: IonTypes["clob"], length: 7, isNull: false }),
    /* 0x98 - clob                */ () => ({ type: IonTypes["clob"], length: 8, isNull: false }),
    /* 0x99 - clob                */ () => ({ type: IonTypes["clob"], length: 9, isNull: false }),
    /* 0x9a - clob                */ () => ({ type: IonTypes["clob"], length: 10, isNull: false }),
    /* 0x9b - clob                */ () => ({ type: IonTypes["clob"], length: 11, isNull: false }),
    /* 0x9c - clob                */ () => ({ type: IonTypes["clob"], length: 12, isNull: false }),
    /* 0x9d - clob                */ () => ({ type: IonTypes["clob"], length: 13, isNull: false }),
    /* 0x9e - clob (L >= 14)      */ () => ({ type: IonTypes["clob"], length: 14, isNull: false }), // VarUInt
    /* 0x9f - clob (null)         */ () => ({ type: IonTypes["clob"], length: 0, isNull: true }),
    /* 0xa0 - blob                */ () => ({ type: IonTypes["blob"], length: 0, isNull: false }), // 0 length blobs are legal
    /* 0xa1 - blob                */ () => ({ type: IonTypes["blob"], length: 1, isNull: false }),
    /* 0xa2 - blob                */ () => ({ type: IonTypes["blob"], length: 2, isNull: false }),
    /* 0xa3 - blob                */ () => ({ type: IonTypes["blob"], length: 3, isNull: false }),
    /* 0xa4 - blob                */ () => ({ type: IonTypes["blob"], length: 4, isNull: false }),
    /* 0xa5 - blob                */ () => ({ type: IonTypes["blob"], length: 5, isNull: false }),
    /* 0xa6 - blob                */ () => ({ type: IonTypes["blob"], length: 6, isNull: false }),
    /* 0xa7 - blob                */ () => ({ type: IonTypes["blob"], length: 7, isNull: false }),
    /* 0xa8 - blob                */ () => ({ type: IonTypes["blob"], length: 8, isNull: false }),
    /* 0xa9 - blob                */ () => ({ type: IonTypes["blob"], length: 9, isNull: false }),
    /* 0xaa - blob                */ () => ({ type: IonTypes["blob"], length: 10, isNull: false }),
    /* 0xab - blob                */ () => ({ type: IonTypes["blob"], length: 11, isNull: false }),
    /* 0xac - blob                */ () => ({ type: IonTypes["blob"], length: 12, isNull: false }),
    /* 0xad - blob                */ () => ({ type: IonTypes["blob"], length: 13, isNull: false }),
    /* 0xae - blob (L >= 14)      */ () => ({ type: IonTypes["blob"], length: 14, isNull: false }), // VarUInt
    /* 0xaf - blob (null)         */ () => ({ type: IonTypes["blob"], length: 0, isNull: true }),
    /* 0xb0 - list - []           */ () => ({ type: IonTypes["list"], length: 0, isNull: false }),
    /* 0xb1 - list                */ () => ({ type: IonTypes["list"], length: 1, isNull: false }),
    /* 0xb2 - list                */ () => ({ type: IonTypes["list"], length: 2, isNull: false }),
    /* 0xb3 - list                */ () => ({ type: IonTypes["list"], length: 3, isNull: false }),
    /* 0xb4 - list                */ () => ({ type: IonTypes["list"], length: 4, isNull: false }),
    /* 0xb5 - list                */ () => ({ type: IonTypes["list"], length: 5, isNull: false }),
    /* 0xb6 - list                */ () => ({ type: IonTypes["list"], length: 6, isNull: false }),
    /* 0xb7 - list                */ () => ({ type: IonTypes["list"], length: 7, isNull: false }),
    /* 0xb8 - list                */ () => ({ type: IonTypes["list"], length: 8, isNull: false }),
    /* 0xb9 - list                */ () => ({ type: IonTypes["list"], length: 9, isNull: false }),
    /* 0xba - list                */ () => ({ type: IonTypes["list"], length: 10, isNull: false }),
    /* 0xbb - list                */ () => ({ type: IonTypes["list"], length: 11, isNull: false }),
    /* 0xbc - list                */ () => ({ type: IonTypes["list"], length: 12, isNull: false }),
    /* 0xbd - list                */ () => ({ type: IonTypes["list"], length: 13, isNull: false }),
    /* 0xbe - list (L >= 14)      */ () => ({ type: IonTypes["list"], length: 14, isNull: false }), // VarUInt
    /* 0xbf - list (null)         */ () => ({ type: IonTypes["list"], length: 0, isNull: true }),
    /* 0xc0 - sexp - ()           */ () => ({ type: IonTypes["sexp"], length: 0, isNull: false }),
    /* 0xc1 - sexp                */ () => ({ type: IonTypes["sexp"], length: 1, isNull: false }),
    /* 0xc2 - sexp                */ () => ({ type: IonTypes["sexp"], length: 2, isNull: false }),
    /* 0xc3 - sexp                */ () => ({ type: IonTypes["sexp"], length: 3, isNull: false }),
    /* 0xc4 - sexp                */ () => ({ type: IonTypes["sexp"], length: 4, isNull: false }),
    /* 0xc5 - sexp                */ () => ({ type: IonTypes["sexp"], length: 5, isNull: false }),
    /* 0xc6 - sexp                */ () => ({ type: IonTypes["sexp"], length: 6, isNull: false }),
    /* 0xc7 - sexp                */ () => ({ type: IonTypes["sexp"], length: 7, isNull: false }),
    /* 0xc8 - sexp                */ () => ({ type: IonTypes["sexp"], length: 8, isNull: false }),
    /* 0xc9 - sexp                */ () => ({ type: IonTypes["sexp"], length: 9, isNull: false }),
    /* 0xca - sexp                */ () => ({ type: IonTypes["sexp"], length: 10, isNull: false }),
    /* 0xcb - sexp                */ () => ({ type: IonTypes["sexp"], length: 11, isNull: false }),
    /* 0xcc - sexp                */ () => ({ type: IonTypes["sexp"], length: 12, isNull: false }),
    /* 0xcd - sexp                */ () => ({ type: IonTypes["sexp"], length: 13, isNull: false }),
    /* 0xce - sexp (L >= 14)      */ () => ({ type: IonTypes["sexp"], length: 14, isNull: false }), // VarUInt
    /* 0xcf - sexp (null)         */ () => ({ type: IonTypes["sexp"], length: 0, isNull: true }),
    /* 0xd0 - struct - {}         */ () => ({ type: IonTypes["struct"], length: 0, isNull: false }),
    /* 0xd1 - struct              */ () => ({ type: IonTypes["struct"], length: 14, isNull: false }), // sorted, VarUInt
    /* 0xd2 - struct              */ () => ({ type: IonTypes["struct"], length: 2, isNull: false }),
    /* 0xd3 - struct              */ () => ({ type: IonTypes["struct"], length: 3, isNull: false }),
    /* 0xd4 - struct              */ () => ({ type: IonTypes["struct"], length: 4, isNull: false }),
    /* 0xd5 - struct              */ () => ({ type: IonTypes["struct"], length: 5, isNull: false }),
    /* 0xd6 - struct              */ () => ({ type: IonTypes["struct"], length: 6, isNull: false }),
    /* 0xd7 - struct              */ () => ({ type: IonTypes["struct"], length: 7, isNull: false }),
    /* 0xd8 - struct              */ () => ({ type: IonTypes["struct"], length: 8, isNull: false }),
    /* 0xd9 - struct              */ () => ({ type: IonTypes["struct"], length: 9, isNull: false }),
    /* 0xda - struct              */ () => ({ type: IonTypes["struct"], length: 10, isNull: false }),
    /* 0xdb - struct              */ () => ({ type: IonTypes["struct"], length: 11, isNull: false }),
    /* 0xdc - struct              */ () => ({ type: IonTypes["struct"], length: 12, isNull: false }),
    /* 0xdd - struct              */ () => ({ type: IonTypes["struct"], length: 13, isNull: false }),
    /* 0xde - struct (L >= 14)    */ () => ({ type: IonTypes["struct"], length: 14, isNull: false }), // VarUInt
    /* 0xdf - struct (null)       */ () => ({ type: IonTypes["struct"], length: 0, isNull: true }),
    /* 0xe0 - bvm                 */ () => ({ type: IonTypes["bvm"], length: 3, isNull: false }),
    /* 0xe1 - invalid annotation  */ () => this.#typeDescriptorError("0xe1"),
    /* 0xe2 - invalid annotation  */ () => this.#typeDescriptorError("0xe2"),
    /* 0xe3 - annotation          */ () => ({ type: IonTypes["annotation"], length: 3, isNull: false }),
    /* 0xe4 - annotation          */ () => ({ type: IonTypes["annotation"], length: 4, isNull: false }),
    /* 0xe5 - annotation          */ () => ({ type: IonTypes["annotation"], length: 5, isNull: false }),
    /* 0xe6 - annotation          */ () => ({ type: IonTypes["annotation"], length: 6, isNull: false }),
    /* 0xe7 - annotation          */ () => ({ type: IonTypes["annotation"], length: 7, isNull: false }),
    /* 0xe8 - annotation          */ () => ({ type: IonTypes["annotation"], length: 8, isNull: false }),
    /* 0xe9 - annotation          */ () => ({ type: IonTypes["annotation"], length: 9, isNull: false }),
    /* 0xea - annotation          */ () => ({ type: IonTypes["annotation"], length: 10, isNull: false }),
    /* 0xeb - annotation          */ () => ({ type: IonTypes["annotation"], length: 11, isNull: false }),
    /* 0xec - annotation          */ () => ({ type: IonTypes["annotation"], length: 12, isNull: false }),
    /* 0xed - annotation          */ () => ({ type: IonTypes["annotation"], length: 13, isNull: false }),
    /* 0xee - annotation (L >= 14)*/ () => ({ type: IonTypes["annotation"], length: 14, isNull: false }), // VarUInt
    /* 0xef - invalid annotation  */ () => this.#typeDescriptorError("0xef"), 
    /* 0xf0 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf0"), 
    /* 0xf1 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf1"), 
    /* 0xf2 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf2"), 
    /* 0xf3 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf3"),
    /* 0xf4 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf4"),
    /* 0xf5 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf5"),
    /* 0xf6 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf6"),
    /* 0xf7 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf7"),
    /* 0xf8 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf8"),
    /* 0xf9 - invalid (reserved)  */ () => this.#typeDescriptorError("0xf9"),
    /* 0xfa - invalid (reserved)  */ () => this.#typeDescriptorError("0xfa"),
    /* 0xfb - invalid (reserved)  */ () => this.#typeDescriptorError("0xfb"),
    /* 0xfc - invalid (reserved)  */ () => this.#typeDescriptorError("0xfc"),
    /* 0xfd - invalid (reserved)  */ () => this.#typeDescriptorError("0xfd"),
    /* 0xfe - invalid (reserved)  */ () => this.#typeDescriptorError("0xfe"),
    /* 0xff - invalid (reserved)  */ () => this.#typeDescriptorError("0xff")
  ];

  /**
   * The byte reader source
   */
  #byteReader;

  /**
   * A VarUInt that holds the length of the current Ion element.
   */
  #varUIntLengthByte;

  /**
   * Error handling for invalid type descriptors.
   * 
   * @param {String} hexString
   * @throws Error every time.
   */
  #typeDescriptorError = (hexString) => { 
    // TODO: pass the error to the caller
    const err = new Error(`Invalid Ion T/L pair ${hexString}.`);
    throw err;
  };

  /**
   * Requires a ByteReader.
   * 
   * @param {ByteReader} byteReader
   * @throws Error if byteReader is not a ByteReader
   */
  constructor (byteReader) {
    if (!(byteReader instanceof br.ByteReader)) {
      // TODO: pass the error to the caller
      const err = new Error("expected byteReader to be a ByteReader");
      throw err;
    }

    this.#byteReader = byteReader;
  }

  /**
   * Reads the type descriptor and optional (>14) length bytes
   * 
   * @param {Number} positionToSet
   * - positionToSet is required to be a positive integer
   * @param {String} context 
   * context can have the following values:
   * - "1_0" - the Ion data is expected to be Ion 1.0
   * - "bvm" - a bvm is required before being able to read the data
   * @throws Error if
   * - positionToSet is not a positive integer
   * - there is no byte to read
   * - context is invalid
   * - context is bvm and the bytes read are not a bvm
   * @returns {null | Object}
   * The Object returned has the following properties:
   * - type
   * - length
   * - isNull
   * - length (if VarUInt)
   * - varUIntLength
   * - isVarUInt
   * - isSortedStruct
   * - annotationsLength
   * - annotationsVarUIntLength
   * - majorVersion
   * - minorVersion 
   */
  readTypeAndLength(positionToSet, context) {
    if (!Number.isInteger(positionToSet) || positionToSet < 0) {
      // TODO: pass the error to the caller
      const err = new Error(`positionToSet is not a positive integer`);
      throw err;
    }

    this.#byteReader.setPosition(positionToSet);

    const typeAndLengthByte = this.#byteReader.nextByte();

    // not enough bytes available, propagate null
    if (typeAndLengthByte === null) {
      return null;
    }

    if (typeAndLengthByte === undefined) {
      // TODO: pass the error to the caller
      const err = new Error(`typeAndLengthyByte is undefined`);
      throw err;
    }

    let typeDescriptors;
    let mustBeBVM = false;
    switch (context) {
      case "1_0":
        typeDescriptors = this.#typeDescriptors_1_0;
        break;
      case "bvm":
        typeDescriptors = this.#typeDescriptors_1_0;
        mustBeBVM = true;
        break;
      default:
        // TODO: pass the error to the caller
        const err = new Error(`unknown context`);
        throw err;

    }
    const typeAndLength = typeDescriptors[typeAndLengthByte]();

    if (typeAndLength.type === IonTypes["bvm"]) {
      typeAndLength.majorVersion = this.#byteReader.nextByte();
      typeAndLength.minorVersion = this.#byteReader.nextByte();
      this.#byteReader.skipBytes(-2);
    } else if (mustBeBVM === true) {
      // TODO: pass the error to the caller
      const err = new Error(`bvm not found`);
      throw err;
    }

    // Length 14 indicates that there is a VarUInt that contains the length
    if (typeAndLength.length === 14) {
      const varUIntInfo = this.#byteReader.readVarUInt();
      
      // not enough bytes available, reset reader position (typeAndLengthByte), propagate null
      if (varUIntInfo === null) {
        this.#byteReader.skipBytes(-1);
        return null;
      }

      if (varUIntInfo.magnitude < 14) {
        // TODO: pass the notice to the caller
        const notice = "T/L pair has length and magnitude which could be represented without extra length byte";
      }
      if (typeof varUIntInfo.magnitude === 'bigint') {
        typeAndLength.length = BigInt(varUIntInfo.numBytesRead) + varUIntInfo.magnitude;
      } else {
        typeAndLength.length = varUIntInfo.numBytesRead + varUIntInfo.magnitude;
      }
      typeAndLength.varUIntLength = varUIntInfo.numBytesRead;
      typeAndLength.isVarUInt = true;

      // sorted struct (0xD1)
      if (typeAndLengthByte === 209) {
        typeAndLength.isSortedStruct = true;
      }
    }

    if (typeAndLength.type === IonTypes.annotation) {
      const varUIntInfo = this.#byteReader.readVarUInt();

      // not enough bytes available, reset reader position (typeAndLengthByte), propagate null
      if (varUIntInfo === null) {
        if ( typeAndLength.varUIntLength !== undefined) {
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

  /**
   * Reads the field name at the specified position.
   * 
   * @param {Number} positionToSet
   * @returns {Number} a SymbolID (VarUInt)
   */
  readFieldName(positionToSet) {
    this.#byteReader.setPosition(positionToSet);
    return this.#byteReader.readVarUInt();
  }

  /**
   * Sets the reader to the specified position.
   * 
   * @param {Number} positionToSet
   */
  setPosition(positionToSet) {
    this.#byteReader.setPosition(positionToSet);
  }
}

exports.TypeDescriptorReader = TypeDescriptorReader;