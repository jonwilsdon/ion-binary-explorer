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
  for (let i = 0; i < 100; ++i) {
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
      postMessage({
        'action': 'BVMValidated',
        'majorVersion': currentElement.majorVersion,
        'minorVersion': currentElement.minorVersion,
        'offset': currentElement.positionInStream
      });
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;

      symbolTable = {
        'position': currentElement.positionInStream,
        'shared': false,
        'append': false,
        'numSymbols': 0
      };
      if (suppressSymbolTables === false) {
        symbolTables.push(symbolTable);
      }
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      inSymbolTableDefinition = true;
      symbolTable = {
                      'position': currentElement.positionInStream,
                      'shared': currentElement.isSharedSymbolTable,
                      'append': false,
                      'numSymbols': 0
                    };
      if (suppressSymbolTables === false ) {
        symbolTables.push(symbolTable);
      }
    }

    if (inSymbolTableDefinition === true) {
      // check the field name, see if it is 'symbols'
      if (currentElement.depth === 1 && currentElement.fieldNameSymbolID === 7) {
        inSymbolList = true;
      }
      // check the field name, see if it is 'imports'
      if (currentElement.depth === 1 && currentElement.fieldNameSymbolID === 6) {
        // check the value, see if it is $ion_symbol_table
        if (currentElement.type === IonTypes["symbol"] && currentElement.bytePositionOfRepresentation !== null &&
            utilities.readScalarFromElement(currentElement, scalarReader) === 3) {
          if (symbolTable.append === true || symbolTable.shared === true) {
            // TODO: error, multiple imports
          }
          symbolTable.append = true;
        } else {
          if (symbolTable.append === true || symbolTable.shared === true) {
            // TODO: error, multiple imports
          }
          symbolTable.shared = true;
          // TODO: Add handling of shared symbol table here
        }
      // TODO: handle max_id
      } else if (currentElement.depth === 2 && inSymbolList === true && currentElement.type === IonTypes["string"]) {
        if (suppressSymbolTables === false) {
          let symbolString = utilities.readScalarFromElement(currentElement, scalarReader);
          symbolTable.numSymbols++;
          symbolsToAdd.push({ 'symbolString': symbolString, 'position': currentElement.positionInStream});
        }
      }
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