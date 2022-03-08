'use strict';

importScripts('js/bite.js');

const TypeDescriptorReader = BITE.TypeDescriptorReader;
const ByteBufferReader = BITE.ByteBufferReader;
const ScalarValueReader = BITE.ScalarValueReader;
const IonElement = BITE.IonElement;
const utilities = BITE.utilities;
const Analyzer = BITE.Analyzer;
const Inspector = BITE.Inspector;
const IonTypes = BITE.IonTypes;

let number = -1;

let bufferReader = null;
let readerSize = null;
let typeReader = null;
let scalarReader = null;
let symbolTable = null;
let stats = null;
let inspector = null;
let textWriter = null;

let symbolsToAdd = [];
let symbolsUsage = [];
let symbolTables = [];
let topLevelPositions = [];

let elementStack, inSymbolTableDefinition, inSymbolList, currentElement;

function readAll(buffer, offset, options) {
  symbolsToAdd = [];
  symbolsUsage = [];
  symbolTables = [];
  symbolTable = null;

  let bufferOffset = (offset === undefined) ? 0 : offset;

  bufferReader = new ByteBufferReader();
  bufferReader.loadBuffer(buffer);
  readerSize = bufferReader.size;
  let bytesRead = readerSize;
  typeReader = new TypeDescriptorReader(bufferReader);
  scalarReader = new ScalarValueReader(bufferReader);
  stats = new Analyzer();
  inspector = new Inspector();

  elementStack = [];
  inSymbolTableDefinition = false;
  inSymbolList = false;
  // depth > 10 is not common
  for (let i = 0; i < 10; ++i) {
    elementStack.push(new IonElement(0,0, readerSize, null, null, null));
  }
  currentElement = elementStack[0];

  let inspect = false;
  if ((options !== undefined) && options.inspect) {
    inspect = options.inspect;
  }
  let suppressSymbolTables = false; 
  if ((options !== undefined) && options.suppressSymbolTables) {
    suppressSymbolTables = options.suppressSymbolTables;
  }
  let context = "unknown";
  if (options.context !== undefined) {
    context = options.context;
  }

  while (true) {
    try {
      let returnValue = currentElement.readTypeDescriptor(typeReader, context);

      // done reading the buffer!
      if (returnValue === null) {
        bytesRead = currentElement.positionInStream;
        break;
      }
    } catch (error) {
      console.log(`Error! currentElement: ${currentElement.toString()}`);
      throw error;
    }

    if (options.validateBVMExists &&
        currentElement.positionInStream === 0 &&
        currentElement.type !== IonTypes["bvm"]) {
      throw new Error("||worker-reader|| no BVM found");
    }

    if (currentElement.depth === 0) {
      topLevelPositions.push(currentElement.positionInStream);
    }

    stats.trackElement(currentElement, bufferOffset);

    if (currentElement.type === IonTypes["bvm"]) {
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      inSymbolTableDefinition = true;
    }

    if (inSymbolTableDefinition === true) {
    }

    if (currentElement.fieldNameSymbolID !== undefined) {
      symbolsUsage.push({ 'symbolID': currentElement.fieldNameSymbolID,
                          'position': currentElement.bytePositionOfRepresentation || currentElement.positionInStream });
      //symbolTable.addUsage(currentElement.fieldNameSymbolID, 
      //                     currentElement.bytePositionOfRepresentation || currentElement.positionInStream);
    }

    if (currentElement.type === IonTypes["symbol"]) {
      let symbolID = (currentElement.bytePositionOfRepresentation === null) ?
                          currentElement.varUIntLength :
                          utilities.readScalarFromElement(currentElement, scalarReader);
      
      symbolsUsage.push({ 'symbolID': symbolID,
                          'position': currentElement.bytePositionOfRepresentation || currentElement.positionInStream });
    }

    // TODO: report offset as position of firstAnnotation instead of element offset
    if (currentElement.firstAnnotation !== null) {
      symbolsUsage.push({ 'symbolID': currentElement.firstAnnotation.magnitude,
                          'position': currentElement.positionInStream });
      // TODO: report other annotations
      // while ()
    }

    //if (currentElement.positionInStream < 10000) {
    if (inspect === true) {
      let bytesUpToRepresentation = currentElement.totalLength;
      if (currentElement.isContainer && currentElement.bytePositionOfRepresentation !== null) {
        bytesUpToRepresentation = currentElement.bytePositionOfRepresentation - currentElement.positionInStream;
      }

      let rawBytes = bufferReader.rawBytes(currentElement.positionInStream, bytesUpToRepresentation);
      inspector.inspectElement(currentElement, rawBytes, scalarReader, bytesUpToRepresentation, bufferOffset);
    }
    //}
    /*else if (inspect === true) {
      postMessage({'action': 'nibbles',
                   'nibblesToDisplay': inspector.nibblesToDisplay,
                   'symbolTables': symbolTables,
                   'symbolsToAdd': symbolsToAdd,
                   'offset': offset });
      symbolTables = [];
      symbolsToAdd = [];
      inspect = false;
    }*/

    // contains elements
    if (currentElement.isContainer && !currentElement.isNull && currentElement.containsElement !== null && 
        currentElement.length !== 0) {
      let elemDef = currentElement.containsElement;
      // resize elementStack if necessary
      while (elemDef[1] >= elementStack.length) {
        elementStack.push(new IonElement(0,0, readerSize, null, null, null));
      }
      currentElement = elementStack[elemDef[1]];
      currentElement.repurpose(elemDef[0], elemDef[1],
                               elemDef[2], elemDef[3],
                               elemDef[4], elemDef[5]);
    }
    // contains no elements, but not the last at its depth
    else if (currentElement.nextElement) {
      currentElement.repurpose(currentElement.nextElement[0], currentElement.nextElement[1],
                               currentElement.nextElement[2], currentElement.nextElement[3],
                               currentElement.nextElement[4], currentElement.nextElement[5]);
    }
    // contains no elements, last at its depth
    else {
      while (currentElement.depth > 0) {
        currentElement = elementStack[currentElement.depth - 1];
        if (currentElement.nextElement !== null) {
          break;
        }
      }

      if (inSymbolTableDefinition === true && currentElement.depth === 0) {
        inSymbolTableDefinition = false;
        symbolTable = undefined;
      }

      if (inSymbolList === true && currentElement.depth < 2) {
        inSymbolList = false;
      }

      if (currentElement.nextElement) {
        currentElement.repurpose(currentElement.nextElement[0], currentElement.nextElement[1],
                                 currentElement.nextElement[2], currentElement.nextElement[3],
                                 currentElement.nextElement[4], currentElement.nextElement[5]);
      }
      // finished
      else {
        if (!bufferReader.atEnd(currentElement.positionInStream + currentElement.totalLength)) {
          throw new Error("Not at end of stream");
        }
        currentElement = undefined;
        break;
      }
    }
  }

  postMessage({'action': 'done',
               'symbolTables': symbolTables,
               'symbolsToAdd': symbolsToAdd,/*
               'symbolsUsage': symbolsUsage,*/
               'topLevels': topLevelPositions,
               'stats': stats.stats,
               'offset': offset,
               'size': bytesRead,
               'context': context });
  
  
  if (inspect === true) {
    postMessage({'action': 'nibbles',
              'nibblesToDisplay': inspector.nibblesToDisplay,
              'offset': offset });
  }
}

onmessage = (event) => {
  switch (event.data.action) {
    case 'readAll':
      readAll(event.data.biBuffer, event.data.offset);
      break;
    case 'read':
      readAll(event.data.buffer, event.data.offsetInFile, event.data.options);
      break;
    case 'number':
      number = event.data.value;
      break;
    default:
      console.log(`worker-reader: unknown event ${JSON.stringify(event.data)}`);
  }
}