'use strict';

importScripts('js/bite.js');

const TypeDescriptorReader = BITE.TypeDescriptorReader;
const ByteBufferReader = BITE.ByteBufferReader;
const ScalarValueReader = BITE.ScalarValueReader;
const ElementReference = BITE.ElementReference;
const Verifier = BITE.Verifier;
const IonElement = BITE.IonElement;
const utilities = BITE.utilities;
const Analyzer = BITE.Analyzer;
const IonTypes = BITE.IonTypes;

let number = -1;

let bufferReader = null;
let readerSize = null;
let typeReader = null;
let scalarReader = null;
let stats = null;

let symbolsUsage = [];

let elementStack, inSymbolTableDefinition, inSymbolList, currentElement;

function readAll(buffer, offset, totalFileSize, options) {
  symbolsUsage = [];

  let bufferOffset = (offset === undefined) ? 0 : offset; 

  bufferReader = new ByteBufferReader();
  bufferReader.loadBuffer(buffer);
  readerSize = bufferReader.size;
  let bytesRead = readerSize;
  typeReader = new TypeDescriptorReader(bufferReader);
  scalarReader = new ScalarValueReader(bufferReader);
  stats = new Analyzer();

  let exactSize = (options.exactSize !== undefined) ? options.exactSize : readerSize;

  let verify = !!options.verify;
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
          elemRef = [offset, 0, elemRef[2], elemRef[3],
                     elemRef[4], elemRef[5], elemRef[6]];
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
      elementStack.push(new IonElement([offset, 0,0, totalFileSize-offset, null, null, undefined]));
    }
    currentElement = elementStack[0];
  }

  let verifier;
  if (verify === true) {
    verifier = new Verifier((inLargeContainer) ? elementStack.slice(0, options.longElementStack.length) : [],
                            bytesRead, true, true);
  }

  let context = "bvm";
  if (options.context !== undefined) {
    context = options.context;
  }

  while (true) {
    try {
      let returnValue = currentElement.readTypeDescriptor(typeReader, context);

      // done reading the buffer!
      if (returnValue === null || currentElement.relativeOffset >= exactSize) {
        if (verify === true) {
          verifier.atEnd(0);
        }
        break;
      }
    } catch (error) {
      console.log(`Error! bufferOffset: ${bufferOffset} currentElement: ${currentElement.toString()}`);
      throw error;
    }

    stats.trackElement(currentElement, bufferOffset);

    if (currentElement.type === IonTypes["bvm"]) {
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      inSymbolTableDefinition = true;
    }

    if (currentElement.fieldNameSymbolID !== undefined) {
      symbolsUsage.push({ 'symbolID': currentElement.fieldNameSymbolID,
                          'position': currentElement.bytePositionOfRepresentation || currentElement.relativeOffset });
    }

    if (currentElement.type === IonTypes["symbol"]) {
      let symbolID = (currentElement.bytePositionOfRepresentation === null) ?
                          currentElement.varUIntLength :
                          utilities.readScalarFromElement(currentElement, scalarReader);
      
      symbolsUsage.push({ 'symbolID': symbolID,
                          'position': currentElement.bytePositionOfRepresentation || currentElement.relativeOffset });
    }

    // TODO: report offset as position of firstAnnotation instead of element offset
    if (currentElement.firstAnnotation !== null) {
      symbolsUsage.push({ 'symbolID': currentElement.firstAnnotation.magnitude,
                          'position': currentElement.relativeOffset });
      // TODO: report other annotations
      // while ()
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
      if (verify === true) {
        verifier.verifyElement(elemDef);
      }
      currentElement.repurpose(elemDef);
    }
    // contains no elements, but not the last at its depth
    else if (currentElement.nextElementReference !== undefined &&
             currentElement.nextElementReference !== null) {
      if (verify === true) {
        verifier.verifyElement(currentElement.nextElementReference);
      }
      currentElement.repurpose(currentElement.nextElementReference);
    }
    // contains no elements, last at its depth
    else {

      let initialLength = currentElement.totalLength;
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
        if (verify === true) {
          verifier.verifyElement(currentElement.nextElementReference);
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
          if (!(bufferReader.atEnd(currentElement.relativeOffset + currentElement.totalLength) || 
              (offset + bytesRead === totalFileSize))) {
            throw new Error("Not at end of stream");
          }
        }

        if (verify === true) {
          verifier.atEnd(initialLength);
        }
        currentElement = undefined;
        break;
      }
    }
  }

  postMessage({'action': 'done',/*
               'symbolsUsage': symbolsUsage,*/
               'stats': stats.stats,
               'offset': offset,
               'size': bytesRead,
               'context': context });
}

onmessage = (event) => {
  switch (event.data.action) {
    case 'readAll':
      readAll(event.data.biBuffer, event.data.offset);
      break;
    case 'read':
      readAll(event.data.buffer, event.data.offsetInFile, event.data.totalFileSize, event.data.options);
      break;
    case 'number':
      number = event.data.value;
      break;
    default:
      console.log(`worker-reader: unknown event ${JSON.stringify(event.data)}`);
  }
}