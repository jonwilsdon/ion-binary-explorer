'use strict';

importScripts('js/bite.js');

const TypeDescriptorReader = BITE.TypeDescriptorReader;
const ByteBufferReader = BITE.ByteBufferReader;
const ScalarValueReader = BITE.ScalarValueReader;
const ElementReference = BITE.ElementReference;
const IonElement = BITE.IonElement;
const utilities = BITE.utilities;
const Inspector = BITE.Inspector;
const IonTypes = BITE.IonTypes;

let bufferReader = null;
let readerSize = null;
let typeReader = null;
let scalarReader = null;
let inspector = null;

let elementStack, inSymbolTableDefinition, inSymbolList, currentElement;

let offsetInFile = 0;
let target = 0;

// takes in a buffer, reads bytes in range (outside beginning range, inside ending range)
// example: buffer size 1300, range start 50, range end 150, with 100 13-byte values
//          would return values at 39, 52, 65, 78, 91, 104, 117, 130, and 143
function read(buffer, offset, totalFileSize, options) {

  console.log(`inspect-worker: read ${offset}`);
  let nibblesToDisplay = [];
  let bufferOffset = (offset === undefined) ? 0 : offset;

  let context = "bvm";
  if (options.context !== undefined) {
    context = options.context;
  }

  bufferReader = new ByteBufferReader();
  bufferReader.loadBuffer(buffer);
  readerSize = bufferReader.size;
  typeReader = new TypeDescriptorReader(bufferReader);
  scalarReader = new ScalarValueReader(bufferReader);
  inspector = new Inspector();

  let exactSize = (options.exactSize !== undefined) ? options.exactSize : readerSize;
  let rangeStart = options.rangeStart;
  let rangeEnd = options.rangeEnd;

  if (rangeStart === undefined || rangeEnd === undefined) {
    throw new Error("Range start and range end must be defined");
  }

  let relativeStart = rangeStart - offset;
  let relativeEnd = rangeEnd - offset;

  let inLargeContainer = !!options.inLargeContainer;
  let longElementOffset = null;
  let longElementStack = null;
  let isFromLongElement = null;

  elementStack = [];
  inSymbolTableDefinition = false;
  inSymbolList = false;
  if (inLargeContainer) {
    let stackLength = 3;
    let longStack = options.longElementStack;
    isFromLongElement = [];
    if (longStack.length > stackLength) {
      stackLength = longStack.length;
    }
    for (let i = 0; i < stackLength; ++i) {
      if (i >= longStack.length) {
        elementStack.push(new IonElement([offset, 0, 0, totalFileSize-offset, null, null, undefined]));
      } else {
        let elemRef = longStack[i];
        if (i === (longStack.length-1)) {
          elemRef = [elemRef[0], 0, elemRef[2], elemRef[3],
                     elemRef[4], elemRef[5], undefined];
        } else {
          isFromLongElement.push(true);
        }
        elementStack.push(new IonElement(elemRef));
      }
    }
    currentElement = elementStack[longStack.length-1];
  } else {
    // usually descend only to symbol definitions in symbol tables
    for (let i = 0; i < 3; ++i) {
      elementStack.push(new IonElement([offset, 0, 0, totalFileSize-offset, null, null, undefined]));
    }
    currentElement = elementStack[0];
  }

  if (relativeEnd > exactSize) {
    //throw new Error("RangeEnd larger than buffer size");
    relativeEnd = exactSize;
  }

  while (true) {
    try {
      let returnValue = currentElement.readTypeDescriptor(typeReader, context);

      // done reading the buffer or the range!
      if (returnValue === null || currentElement.relativeOffset >= relativeEnd) {
        break;
      }

    } catch (error) {
      console.log(`Error! bufferOffset: ${bufferOffset}  currentElement: ${currentElement.toString()}`);
      throw error;
    }

    if (currentElement.type === IonTypes["bvm"]) {
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;
    }

    let bytesUpToRepresentation = currentElement.totalLength;

    if (currentElement.isContainer && currentElement.bytePositionOfRepresentation !== null) {
      bytesUpToRepresentation = currentElement.bytePositionOfRepresentation - currentElement.relativeOffset;
    }

    if (currentElement.relativeOffset + bytesUpToRepresentation > readerSize) {
      break;
    }

    // are we in the range?
    if (relativeStart < currentElement.relativeOffset + currentElement.totalLength &&
        relativeEnd > currentElement.relativeOffset) {
      // in range, inspect element
      let rawBytes = bufferReader.rawBytes(currentElement.relativeOffset, bytesUpToRepresentation);
      inspector.inspectElement(currentElement, rawBytes, scalarReader, bytesUpToRepresentation, bufferOffset);
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      inSymbolTableDefinition = true;
    }

    if (inSymbolTableDefinition === true) {
      // check the field name, see if it is 'symbols'
      if (currentElement.depth === 1 && currentElement.fieldNameSymbolID === 7) {
        inSymbolList = true;
      }
    }

    // contains elements
    if (currentElement.isContainer && !currentElement.isNull && currentElement.containsElement !== null && 
        currentElement.length !== 0) {
      let elemDef = currentElement.containsElement;
      // resize elementStack if necessary
      // 2- depth
      while (elemDef[2] >= elementStack.length) {
        elementStack.push(new IonElement([offset, 0, 0, readerSize, null, null, undefined]));
      }
      currentElement = elementStack[elemDef[2]];

      // 1- relativeOffset
      if (elemDef[1] > readerSize) {
        break;
      }
      
      currentElement.repurpose(elemDef);
    }
    // contains no elements, but not the last at its depth
    else if (currentElement.nextElementReference !== undefined &&
             currentElement.nextElementReference !== null) {
      // 1- relativeOffset
      if (currentElement.nextElementReference[1] > readerSize) {
        break;
      }

      currentElement.repurpose(currentElement.nextElementReference);
    }
    // contains no elements, last at its depth
    else {

      while (currentElement.depth > 0) {
        if (isFromLongElement !== null && isFromLongElement.length >= (currentElement.depth-1)) {
          isFromLongElement[currentElement.depth-1] = false;
        }

        currentElement = elementStack[currentElement.depth - 1];
        
        if (isFromLongElement !== null && isFromLongElement.length > currentElement.depth-1) {
          isFromLongElement[currentElement.depth-1] = false;
        }

        if (currentElement.nextElementReference !== undefined &&
            currentElement.nextElementReference !== null) {
          break;
        }
      }

      if (inLargeContainer === true && currentElement.depth === 0) {
        inLargeContainer = false;
      }

      if (inSymbolTableDefinition === true && currentElement.depth === 0) {
        inSymbolTableDefinition = false;
      }

      if (inSymbolList === true && currentElement.depth < 2) {
        inSymbolList = false;
      }

      if (currentElement.nextElementReference !== undefined &&
          currentElement.nextElementReference !== null) {

        // 1- relativeOffset
        if (currentElement.nextElementReference[1] > readerSize) {
          break;
        }
        currentElement.repurpose(currentElement.nextElementReference);
      }
      // finished
      else {
        if (typeof currentElement.relativeOffset === "bigint" || typeof currentElement.totalLength === "bigint") {
          let totalLength = BigInt(currentElement.relativeOffset) + BigInt(currentElement.totalLength);
          
          // takes care of the case where the length of a top level value is larger than the buffer
          // and is the last top level value in the stream
          if (totalLength !== BigInt(totalFileSize)) {
            throw new Error("Not at end of stream");
          }
        } else {
          if (!(bufferReader.atEnd(currentElement.relativeOffset + currentElement.totalLength))) {
            throw new Error("Not at end of stream");
          }
        }

        currentElement = undefined;
        break;
      }
    }
  }

  console.log(`inspect-worker readAll done.`);

  postMessage({'action': 'nibbles',
               'nibblesToDisplay': inspector.nibblesToDisplay,
               'offset': offset });

  postMessage({'action': 'done',
               'offset': offset });
}

onmessage = (event) => {
  switch (event.data.action) {
    case 'read':
      console.log(`inspect-worker received: ${JSON.stringify(event.data)}`);
      read(event.data.buffer, event.data.offsetInFile, event.data.totalFileSize, event.data.options);
      break;
    case 'setOffset':
      offsetInFile = event.data.offset;
      target = event.data.actual;
      break;
    default:
      console.log(`inspect-worker: unknown event ${JSON.stringify(event.data)}`);
  }
}