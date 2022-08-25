'use strict';

const { IonTypes } = require('./IonTypes');
const ElementReference = require('./ElementReference');
const { TypeDescriptorReader } = require('./TypeDescriptorReader');

/**
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
 * Stores the "structure" (T/L and length) of an Ion element.  
 * An Ion element includes any annotations that wrap it.  
 * Does not store the representation (except for bools).
 */
class IonElement {
  #type;              // 0-15 (T)
  #isNull;            // true or false (L=15)
  #annotations;       // Array of symbol ids (annot)
  #fieldNameSymbolID; // 0 - ? (field name)
  #isLocalSymbolTable = false;    // true or false
  #isSharedSymbolTable = false;   // true or false

  #majorVersion;
  #minorVersion;

  #reference;

  // in bytes:
  #length = 0; // number of bytes in the representation, including annotations wrapper (length) and varUInt length
  #varUIntLength = 0; // number of bytes in the length VarUInt
  #lengthWithoutAnnotations = 0; // number of bytes in the representation - annotations wrapper (length)
  #varUIntLengthWithAnnotations = 0; // number of bytes in the length VarUInt (of T=14)
  #annotationsLength = 0; // number of bytes in the annotations (annot_length of T=14)
  #annotationsVarUIntLength = 0; // number of bytes in the annotations length VarUInt (annot of T=14)
  #fieldNameVarUIntLength = 0; // number of bytes in the field mame length VarUInt

  // info about other elements
  #contains = null;

  // booleans require special handling for retrieving the representation
  #boolRepresentation = null;

  // BVMs, struct elements with NOP, NOP
  #isSystemElement = false;

  // Structs with length 1
  #isSorted = false;

  #firstAnnotation = null;

  /**
   * Resets this element's properties to defaults.
   */
  #clear = () => {
    this.#type = undefined;              // 0-15 (T)
    this.#isNull = undefined;            // true or false (L=15)
    this.#annotations = undefined;       // Array of symbol idsn(annot)
    this.#fieldNameSymbolID = undefined; // 0 - ? (field name)
    this.#isLocalSymbolTable = false;    // true or false
    this.#isSharedSymbolTable = false;   // true or false

    this.#majorVersion = undefined;
    this.#minorVersion = undefined;
  
    this.#reference = undefined;

    // in bytes:
    this.#length = 0; // number of bytes in the representation, including annotations wrapper (length) and varUInt length
    this.#varUIntLength = 0; // number of bytes in the length VarUInt
    this.#lengthWithoutAnnotations = 0; // number of bytes in the representation - annotations wrapper (length)
    this.#varUIntLengthWithAnnotations = 0; // number of bytes in the length VarUInt (of T=14)
    this.#annotationsLength = 0; // number of bytes in the annotations (annot_length of T=14)
    this.#annotationsVarUIntLength = 0; // number of bytes in the annotations length VarUInt (annot of T=14)
    this.#fieldNameVarUIntLength = 0; // number of bytes in the field mame length VarUInt
  
    // info about other elements
    this.#contains = null;
  
    // booleans require special handling for retrieving the representation
    this.#boolRepresentation = null;
  
    // BVMs, struct elements with NOP, NOP
    this.#isSystemElement = false;
  
    // Structs with length 1
    this.#isSorted = false;
  }

  /**
   * Sets this element's reference
   * 
   * @param {ElementReference} elementReference 
   */
  #initialize = (elementReference) => {
    this.#reference = elementReference;

    this.#annotations = [];
  }

  /**
   * Requires an ElementReference
   * 
   * @param {ElementReference} elementReference
   * @throws Error if elementReference is not an ElementReference
   */
  constructor (elementReference) {
    if (!(ElementReference.isElementReference(elementReference))) {
      const err = new Error(`IonElement constructor passed ${elementReference} instead of ElementReference.`);
      throw err;
    }

    this.#initialize(elementReference);
  }

  /**
   * Specifies what properties to stringify
   * 
   * @returns An object
   */
  toString () {
    return `{ #reference: ${this.#reference},
              #type: ${this.#type}, 
              #isSystemElement: ${this.#isSystemElement},
              #isNull: ${this.#isNull},
              #isLocalSymbolTable: ${this.#isLocalSymbolTable},
              #isSharedSymbolTable: ${this.#isSharedSymbolTable},
              #annotations: ${this.#annotations},
              #length: ${this.#length},
              #varUIntLength: ${this.#varUIntLength},
              #fieldNameVarUIntLength: ${this.#fieldNameVarUIntLength},
              #fieldNameSymbolID: ${this.#fieldNameSymbolID},
              #annotationsLength: ${this.#annotationsLength},
              #annotationsVarUIntLength: ${this.#annotationsVarUIntLength},
              #lengthWithoutAnnotations: ${this.#lengthWithoutAnnotations},
              #contains: ${this.#contains},
              bytePositionOfRepresentation: ${this.bytePositionOfRepresentation},
              isContainer: ${this.isContainer} }`;
  }

  /**
   * Repurposes (clears and reinitializes) this element to a new reference.
   * 
   * @param {ElementReference} elementReference 
   * @throws Error if elementReference is not an ElementReference
   */
  repurpose (elementReference) {
    if (!(ElementReference.isElementReference(elementReference))) {
      const err = new Error(`IonElement repurpose passed ${elementReference} instead of ElementReference.`);
      throw err;
    }

    this.#clear();
    this.#initialize(elementReference);
  }

  /**
   * The reference for this element.
   * 
   * @returns An ElementReference
   */
  reference() {
    return this.#reference;
  }

  /**
   * Reads the T/L and length of an element. Also reads bvms.
   * @example
   *        7       4 3       0
   *       +---------+---------+
   * value |    T    |    L    |
   *       +---------+---------+======+
   *       :     length [VarUInt]     :
   *       +==========================+
   *       :      representation      :
   *       +==========================+
   * @example
   *                        7    0 7     0 7     0 7    0
   *                       +------+-------+-------+------+
   * binary version marker | 0xE0 | major | minor | 0xEA |
   *                       +------+-------+-------+------+
   * @param {TypeDescriptorReader} typeReader 
   * @param {String} context Can be either "1_0" or "bvm"
   * @throws 
   * @returns 
   */
  readTypeDescriptor (typeReader, context) {
    // 1- relativeOffset
    let position = this.#reference[1];
  
    // read field name, if in a struct
    let fieldNameInfo = undefined;
        // 4- containerOffset
    if (this.#reference[4] !== null && 
        // 5- containerType
        this.#reference[5] === IonTypes["struct"]) {
      fieldNameInfo = typeReader.readFieldName(position);

      // not enough bytes available, propagate null
      if (fieldNameInfo === null) {
        return null;
      }

      position += fieldNameInfo.numBytesRead;
    }
    let currentType = typeReader.readTypeAndLength(position, context);

    // not enough bytes available, reset reader position, propagate null
    if (currentType === null) {
      // 1- relativeOffset
      typeReader.setPosition(this.#reference[1]);
      return null;
    }

    // set before we check for annotations, ensures the length includes annotation wrapper
    this.#length = currentType.length || 0;
  
    let annotationInfo = undefined;
    // annotations wrap an element. Combine the annotation into the next element.
    if (currentType.type === IonTypes["annotation"]) {
      annotationInfo = currentType;
  
      if (!Number.isInteger(annotationInfo.annotationsVarUIntLength) ||
          !Number.isInteger(annotationInfo.annotationsLength)) {
            const err = new Error("Annotation missing 'annot_length' field data.");
            throw err;
      }
  
      if (annotationInfo.annotationsLength === 0) {
        const err = new Error("'annot_length' field must be greater than zero.");
        throw err;
      }

      let annotationsLengthRemaining = annotationInfo.annotationsLength;

      // current position + 1 for the T/L byte + varUInt length (if present) +
      // annotations varUInt length
      let annotationPosition = position + 1 + (annotationInfo.varUIntLength || 0) +
                               annotationInfo.annotationsVarUIntLength;
      let annotation;
      do {
        annotation = typeReader.readFieldName(annotationPosition);
        // not enough bytes available, reset reader position, propagate null
        if (annotation === null) {
          // 1- relativeOffset
          typeReader.setPosition(this.#reference[1]);
          return null;
        }

        this.#annotations.push(annotation);
        annotationPosition += annotation.numBytesRead;
        annotationsLengthRemaining -= annotation.numBytesRead;
      } while (annotationsLengthRemaining > 0);

      const firstAnnotation = this.#annotations[0];
  
      // current position + 1 for the T/L byte + varUInt length (if present) +
      // annotations varUInt length + length of annotations
      const valuePosition = position + 1 + (annotationInfo.varUIntLength || 0) +
                            annotationInfo.annotationsVarUIntLength + annotationInfo.annotationsLength;
      currentType = typeReader.readTypeAndLength(valuePosition, context);

      // not enough bytes available, reset reader position, propagate null
      if (currentType === null) {
        // 1- relativeOffset
        typeReader.setPosition(this.#reference[1]);
        return null;
      }
  
      if (currentType.type === IonTypes["annotation"]) {
        const err = new Error("Annotations cannot wrap annotations.");
        throw err;
      }
      else if (currentType.type === IonTypes["nop"]) {
        const err = new Error("Annotations cannot wrap nop.");
        throw err;
      }
  
      // local symbol table (0x83) or shared symbol table (0x89)
      if (firstAnnotation.magnitude === 3 || firstAnnotation.magnitude === 9) {
        // depth > 0, warn
        // 2- depth
        if (this.#reference[2] > 0) {
          const err = new Error("Symbol table annotation is not at depth 0.");
          throw err;
        }

        // element is not struct, warn
        if (currentType.type !== IonTypes["struct"]) {
          const err = new Error("Symbol table annotation is not wrapping struct.");
          throw err;
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
  
    // BVMs are system elements and only valid at depth 0
    if (currentType.type === IonTypes["bvm"]) {
      // 2- depth
      if (this.#reference[2] !== 0) {
        const err = new Error(`BVM encountered at depth ${this.#reference[2]}`);
        throw err;
      }
  
      this.#isSystemElement = true;
      this.#majorVersion = currentType.majorVersion;
      this.#minorVersion = currentType.minorVersion;
    }

    // nop values are system elements
    if (currentType.type === IonTypes["nop"]) {
      this.#isSystemElement = true;
    }

    // sorted struct
    if (currentType.type === IonTypes["struct"] && currentType.isSortedStruct) {
      this.#isSorted = true;

      // must have a length
      if ((currentType.length - currentType.varUIntLength) === 0) {
        const err = new Error(`Sorted struct with no length.`);
        throw err;
      }
    }

    // always set lengthWithoutAnnotations even if there are no annotations
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

    // 1 is for the type descriptor byte
    let totalLength;
    if (typeof this.#length === 'bigint' || typeof this.#fieldNameVarUIntLength === 'bigint') {
      totalLength = 1n + BigInt(this.#length) + BigInt(this.#fieldNameVarUIntLength);
    } else {
      totalLength = 1 + this.#length + this.#fieldNameVarUIntLength;
    }

    // if this is a container, create the child element
    if (IonTypes.isContainer(this.#type) && this.#lengthWithoutAnnotations !== 0 && this.#isNull === false) {

      if (typeof totalLength === 'bigint') {
        this.#contains = ElementReference.createElementReference(
          // file offset
          this.#reference[0],
          // offset
          this.bytePositionOfRepresentation,
          // depth
          this.#reference[2]+1,
          // bytes remaining at depth
          // 1- relativeOffset
          (totalLength - BigInt(this.bytePositionOfRepresentation - this.#reference[1])),
          // container element (this element)
          // 1- relativeOffset, 0- fileOffset
          this.#reference[1] + this.#reference[0],
          // container element type (this element)
          this.#type,
          // next offset
          undefined
        );
      } else {
        this.#contains = ElementReference.createElementReference(
          // file offset
          this.#reference[0],
          // offset
          this.bytePositionOfRepresentation,
          // depth
          this.#reference[2]+1,
          // bytes remaining at depth
          // 1- relativeOffset
          (totalLength - (this.bytePositionOfRepresentation - this.#reference[1])),
          // container element (this element)
          // 1- relativeOffset, 0- fileOffset
          this.#reference[1] + this.#reference[0],
          // container element type (this element)
          this.#type,
          // next offset
          undefined
        );
      }
    }

    // if there are bytesRemainingAtDepth, create the next element
    let newBytesRemaining;
    // 3- bytesRemainingAtDepth
    if (typeof totalLength === 'bigint' || typeof this.#reference[3] === 'bigint') {
      newBytesRemaining = BigInt(this.#reference[3]) - BigInt(totalLength);
      if (newBytesRemaining > 0n) {
        // 6- nextOffset 1- relativeOffset 0- fileOffset
        this.#reference[6] = BigInt(this.#reference[1]) + BigInt(totalLength) + BigInt(this.#reference[0]);
      }
      else if (newBytesRemaining < 0n) {
        typeReader.setPosition(this.#reference[1]);
        return null;
      }
      else {      
        // intentionally do nothing if newBytesRemaining === 0
      }
    } else {
      // 3- bytesRemainingAtDepth
      newBytesRemaining = this.#reference[3] - totalLength;
      if (newBytesRemaining > 0) {
        // 6- nextOffset 1- relativeOffset 0- fileOffset
        this.#reference[6] = this.#reference[1] + totalLength + this.#reference[0];
      }
      else if (newBytesRemaining < 0) {
        typeReader.setPosition(this.#reference[1]);
        return null;
      }
      else {      
        // intentionally do nothing if newBytesRemaining === 0
      }
    }
  }

  /**
   * Calculates the relative offset in the stream for this element's value representation.
   * 
   * @returns
   * - `null` for byte positions of bvm, nop, 0 length values, and null values
   * - `Number` the number of relative bytes to this element's representation
   */
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

    // 1- relativeOffset
    return this.#reference[1] + 
           this.#fieldNameVarUIntLength +
           // if there are annotations on this element
           ( (this.#annotationsLength > 0) ?
           // 1 for T/L of annotations wrapper
             (1 + this.#varUIntLengthWithAnnotations + this.#annotationsVarUIntLength + this.#annotationsLength) : 
             (0)
           ) + 
           // 1 for T/L of value
           1 + this.#varUIntLength;
  }

  /**
   * Calculates the relative offset in the stream for this element's annotations
   * 
   * @returns 
   * - `null` for elements without annotations
   * - `Number` the number of relative bytes to this element's annotations
   */
  get bytePositionOfAnnotations() {
    if (!(this.#annotationsLength > 0)) {
      return null;
    }

    // 1- relativeOffset
    return this.#reference[1] + 
           // 1 for T/L of annotations wrapper
           (this.#fieldNameVarUIntLength + 1 + this.#varUIntLengthWithAnnotations + this.#annotationsVarUIntLength);
  }

  /**
   * @returns
   * - `true` if the element is a container type
   * - `false` if the element is not a container type
   */
  get isContainer() {
    return IonTypes.isContainer(this.#type);
    // TODO: is the below also acceptable?
    // return this.#contains !== null;
  }

  /** 
   * @returns
   * - `true` if the element is a scalar type
   * - `false` if the element is not a scalar type
   */
  get isScalar() {
    return IonTypes.isScalar(this.#type);
  }

  /**
   * @returns
   * - `true` if the element is a null value
   * - `false` if the element is not a null value
   */
  get isNull() {
    return this.#isNull;
  }

  /**
   * @returns
   * - `ElementReference` for the first element contained in this container
   * - `null` if there are no elements in the container or this is not a container
   */
  get containsElement() {
    return this.#contains;
  }

  /**
   * @returns
   * - `ElementReference` for the next element at this depth in the same container
   * - `null` if there are no elements left at this depth in the same container
   */
  get nextElementReference() {
    return ElementReference.nextElementReference(this.#reference);
  }

  /**
   * @returns {Number} the absolute bytes of the element position in the stream
   */
  get absoluteOffset() {
    return ElementReference.absoluteOffset(this.#reference);
  }

  /**
   * @returns {Number} the relative bytes of the element position in the stream
   */
  get relativeOffset() {
    // 1- relativeOffset
    return this.#reference[1];
  }

  /**
   * @returns {Number} the depth of the element
   */
  get depth() {
    // 2- depth
    return this.#reference[2];
  }

  /**
   * @returns {Number} the absolute offset of the container of this element
   */
  get container() {
    // 4- containerOffset
    return this.#reference[4];
  }

  /**
   * @returns {IonType} the type of container this element is contained inside
   */
  get containerType() {
    // 5- containerType
    return this.#reference[5];
  }

  /**
   * This length includes any field names and the T/L byte
   * 
   * @returns
   * - `bigint` the number of total bytes in this element if the element length is larger than a Number
   * - `Number` the number of total bytes in this element 
   */
  get totalLength() {
    let totalLength;
    if (typeof this.#length === 'bigint') {
      totalLength = BigInt(this.#fieldNameVarUIntLength) + 1n + this.#length;
    } else {
      totalLength = this.#fieldNameVarUIntLength + 1 + this.#length;
    }
    return totalLength;
  }

  /**
   * If the element has annotations, this length will be the length from the annotation wrapper 
   * (including the annotation wrapper varUInt length)
   * 
   * @returns
   * - `bigint` the number of bytes in this element if the element length is larger than a Number
   * - `Number` the number of bytes in this element 
   */
  get length() {
    return this.#length;
  }

  /**
   * The safe property to use when looking for the length of a scalar value
   * 
   * @returns {Number} the number of bytes not including annotations for this element
   */
  get lengthWithoutAnnotations() {
    return this.#lengthWithoutAnnotations;
  }

  /**
   * @returns 
   * - `IonType` the type of the element
   * - `undefined` if the element is uninitialized
   */
  get type() {
    return this.#type;
  }

  /**
   * @returns
   * - `Number` the major version of the BVM
   * - `undefined` if the element is not a BVM
   */
  get majorVersion() {
    return this.#majorVersion;
  }

  /**
   * @returns
   * - `Number` the minor version of the BVM
   * - `undefined` if the element is not a BVM
   */
  get minorVersion() {
    return this.#minorVersion;
  }

  /**
   * @returns
   * - `Number` the field name symbol ID if the element is in a struct
   * - `undefined` if the element is not in a struct
   */
  get fieldNameSymbolID() {
    return this.#fieldNameSymbolID;
  }

  /**
   * @returns {Array} array of symbol ids (annot)
   */
  get annotations() {
    return this.#annotations;
  }

  /**
   * @returns {Number} the number of bytes in the annotations (annot_length of T=14)
   */
  get annotationsLength() {
    return this.#annotationsLength;
  }

  /**
   * @returns {Number} the number of bytes in the annotations length VarUInt (annot of T=14)
   */
  get annotationsVarUIntLength() {
    return this.#annotationsVarUIntLength;
  }


  // TODO: this variable name is confusing, it is actually the length of the annotations varUInt.
  /**
   * @returns {Number} the number of bytes in the length VarUInt (of T=14) if there are annotations
   */
  get varUIntLengthWithAnnotations() {
    return this.#varUIntLengthWithAnnotations;
  }

  /**
   * @returns {Number} the number of bytes in the length VarUInt
   */
  get varUIntLength() {
    return this.#varUIntLength;
  }

  /**
   * @returns
   * - `true` if the element is a Boolean and is true
   * - `false` if the element is a Boolean and is false
   * - `undefined` if the element is a Boolean and is null.boolean
   * - `null` if the element is a not a Boolean
   */
  get boolRepresentation() {
    return this.#boolRepresentation;
  }

  /**
  * @returns
  * - `true` if the element is a system element
  * - `false` if the element is not a system element
  */
  get isSystemElement() {
    return this.#isSystemElement;
  }

  /**
  * @returns
  * - `true` if the element is a sorted struct
  * - `false` if the element is not a sorted struct
  */
  get isSorted() {
    return this.#isSorted;
  }

  /**
  * @returns
  * - `true` if the element is a local symbol table
  * - `false` if the element is not a local symbol table
  */
  get isLocalSymbolTable() {
    return this.#isLocalSymbolTable;
  }

  /**
  * @returns
  * - `true` if the element is a shared symbol table
  * - `false` if the element is not a shared symbol table
  */
  get isSharedSymbolTable() {
    return this.#isSharedSymbolTable;
  }

  /**
   * @returns {Number} the symbol ID of the first annotation wrapping this element
   */
  get firstAnnotation() {
    return this.#firstAnnotation;
  }

  /**
   * @returns {Number} the number of bytes remaining (including this element) at the current depth
   */
  get bytesRemainingAtDepth() {
    // 3- bytesRemainingAtDepth
    return this.#reference[3];
  }

  /**
   * @returns {Number} the number of bytes in the field mame length VarUInt
   */
  get fieldNameVarUIntLength() {
    return this.#fieldNameVarUIntLength;
  }

  /**
   * @example
   *   {
   *  depth: 0,
   *  fieldName: {
   *    nibbles: {
   *      symbolStart: 0,
   *      symbolEnd: 1
   *    }
   *    symbolMagnitude: 0
   *  },
   *  annotation: {
   *    nibbles: {
   *      type: 0,
   *      wrapperLengthStart: 1,
   *      wrapperLengthEnd: 1,
   *      annotationsLengthStart: 2,
   *      annotationsLengthEnd: 2
   *    }
   *    lengthValue: 3,
   *    annotations: [
   *      {
   *        nibbles: {
   *          symbolStart: 4,
   *          symbolEnd: 5
   *        },
   *        symbolMagnitude: 0
   *      }
   *    ]
   *  },
   *  element: {
   *    nibbles: {
   *      type: 0,
   *      lengthStart: 1,
   *      lengthEnd: 1
   *    },
   *    typeValue: 0,
   *    lengthValue: 0
   *    // type specific info added here
   *   }
   * }
   * 
   * @throws
   * @returns
   */
  get nibblePositionStruct() {
    const struct = {};
    let position = 0;

    // 1- relativeOffset 2- depth
    struct.offset = this.#reference[1];
    struct.depth = this.#reference[2];
    if (typeof this.totalLength === 'bigint') {
      struct.totalNibbles = this.totalLength * 2n;
    } else {
      struct.totalNibbles = this.totalLength * 2;
    }

    if (this.#fieldNameSymbolID === undefined) {
      struct.fieldName = null;
    } else {
      const fieldNameStruct = {};

      fieldNameStruct.symbolMagnitude = this.fieldNameSymbolID;
      fieldNameStruct.nibbles = {};
      // this should always be 0 and is enforced elsewhere
      fieldNameStruct.nibbles.symbolStart = position;
      fieldNameStruct.nibbles.symbolEnd = position + (this.fieldNameVarUIntLength * 2) - 1;

      struct.fieldName = fieldNameStruct;

      position = fieldNameStruct.nibbles.symbolEnd + 1;
    }

    if (this.annotationsLength === 0) {
      struct.annotation = {};
    } else {
      const annotationStruct = {};
      const nibbles = {};

      // Annotation:
      // 1        - nibbles.type                              - nibble:T (type)
      // 2        - nibbles.wrapperLengthStart                - nibble:L (length)
      // [3,4...] - nibbles.wrapperLengthEnd                  - nibble:VarUInt Length of wrapper
      // 3,4...   - nibbles.annotationsLengthStart            - nibble:VarUInt Length of annotations
      //          - nibbles.annotationswrapperLengthEnd       -
      // 5,6...   - nibbles.annotation[i].nibbles.symbolStart - nibble:VarUInt Annotation (symbol ID)
      //          - nibbles.annotation[i].nibbles.symbolEnd   -
      // 7,8... - value 

      nibbles.type = position;
      position += 1;

      nibbles.wrapperLengthStart = position;
      nibbles.wrapperLengthEnd = position + (this.#varUIntLengthWithAnnotations * 2);

      position = nibbles.wrapperLengthEnd + 1;

      nibbles.annotationsLengthStart = position;
      nibbles.annotationsLengthEnd = position + (this.#annotationsVarUIntLength * 2) - 1;
      position = nibbles.annotationsLengthEnd + 1;
      annotationStruct.wrapperLengthValue = this.#length;
      annotationStruct.lengthValue = this.annotationsLength; // byte length of annotations

      const annotationList = [];

      for (let i = 0; i < this.annotations.length; ++i) {
        const annotation = {};

        annotation.nibbles = {};

        annotation.nibbles.symbolStart = position;
        annotation.nibbles.symbolEnd = position + (this.annotations[i].numBytesRead * 2) - 1;
        position = annotation.nibbles.symbolEnd + 1;

        annotation.symbolMagnitude = this.annotations[i].magnitude;

        annotationList.push(annotation);
      }

      annotationStruct.nibbles = nibbles;
      annotationStruct.annotations = annotationList;
      struct.annotation = annotationStruct;
    }

    const element = {};
    const nibbles = {};

    nibbles.type = position;
    position += 1;
    nibbles.lengthStart = position;
    nibbles.lengthEnd = position + (this.varUIntLength * 2);

    position = nibbles.lengthEnd +1;
    if (position === struct.totalNibbles) {
      // no representation nibbles
    } else if (position < struct.totalNibbles) {
      nibbles.representationStart = position;
      nibbles.representationEnd = struct.totalNibbles - 1;
    } else {
      const err = new Error(`nibblePositionStruct has invalid position ${postion} out of ${struct.totalNibbles} for representationLength` );
      throw err;
    }

    element.typeValue = this.type;
    element.typeName = IonTypes.nameFromType(this.type);
    element.lengthValue = this.lengthWithoutAnnotations - this.varUIntLength;
    element.totalLength = this.totalLength;

    element.nibbles = nibbles;
    struct.element = element;

    return struct;
  }

}

exports.IonElement = IonElement;