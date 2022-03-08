
importScripts('js/bite.js');

const ByteBufferReader = BITE.ByteBufferReader;
const TypeDescriptorReader = BITE.TypeDescriptorReader;
const ScalarValueReader = BITE.ScalarValueReader;
const IonElement = BITE.IonElement;
const utilities = BITE.utilities;
const IonTypes = BITE.IonTypes;

let bufferOffset = 0;
let bufferReader = new ByteBufferReader();
let typeReader =  null;

function read(buffer, offsetInFile, totalFileSize, options) {
  let topLevelOffsets = [];
  let symbolTableOffsets = [];
  let symbolTables = [];
  let symbolsToAdd = [];
  let context = options.context;
  let contextOffsets = [];

  bufferReader.loadBuffer(buffer);
  typeReader = new TypeDescriptorReader(bufferReader);
  scalarReader = new ScalarValueReader(bufferReader);

  let bytesRead = bufferReader.size;
  let elementStack = [];
  let inSymbolTableDefinition = !!options.inSymbolTableDefinition;
  let inSymbolList = !!options.inSymbolList;

  let inLargeContainer = !!options.inLargeContainer;
  let longElementOffset = null;
  let longElementStack = null;

  let atEnd = false;

  let currentElement;
  if (inLargeContainer) {
    let stackLength = 3;
    let longStack = options.longElementStack;
    if (longStack.length > stackLength) {
      stackLength = longStack.length;
    }
    for (let i = 0; i < stackLength; ++i) {
      if (i >= longStack.length) {
        elementStack.push(new IonElement(0,0, totalFileSize-offsetInFile, null, null, null));
      } else {
        if (i === (longStack.length-1)) {
          longStack[i][0] = 0;
        }
        elementStack.push(new IonElement(longStack[i][0], longStack[i][1], longStack[i][2],
                                         0, longStack[i][4], 0));
      }
    }
    currentElement = elementStack[longStack.length-1];
  } else {
    // usually descend only to symbol definitions in symbol tables
    for (let i = 0; i < 3; ++i) {
      elementStack.push(new IonElement(0,0, totalFileSize-offsetInFile, null, null, null));
    }
    currentElement = elementStack[0];
  }
 
  console.log(`** ${offsetInFile}`);

  if (offsetInFile > 105000000) {
    console.log(`oIF: `);
  }

  while (true) {
    try {
      let returnValue = currentElement.readTypeDescriptor(typeReader, context);

      // done reading the buffer!
      if (returnValue === null) { 
        bytesRead = currentElement.positionInStream;
        break;
      }

      if (offsetInFile > 105000000) {
        console.log(`oIF: pis ${currentElement.positionInStream} t ${currentElement.type} tl ${currentElement.totalLength} d ${currentElement.depth}`);
      }
      if (currentElement.positionInStream === 570468) {
        console.log(`ne ${currentElement.nextElement}`);
      }
    } catch (error) {
      console.log(`Error! currentElement: ${currentElement.toString()} offset: ${currentElement.positionInStream+offsetInFile}`);
      throw error;
    }

    if (offsetInFile === 0 && currentElement.positionInStream === 0 &&
        currentElement.type !== IonTypes["bvm"]) {
      throw new Error("||top-level-worker|| no BVM found");
    }

    if (currentElement.depth === 0) {
      topLevelOffsets.push(currentElement.positionInStream + offsetInFile);
    }

    if (currentElement.type === IonTypes["bvm"]) {
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;
      contextOffsets.push({'offset':currentElement.positionInStream + offsetInFile, 'context': context });
      postMessage({
        'action': 'BVMValidated',
        'majorVersion': currentElement.majorVersion,
        'minorVersion': currentElement.minorVersion,
        'offset': currentElement.positionInStream
      });

      symbolTable = {
        'position': currentElement.positionInStream,
        'shared': false,
        'append': false,
        'numSymbols': 0
      };
      symbolTables.push(symbolTable);
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      symbolTableOffsets.push(currentElement.positionInStream + offsetInFile);
      inSymbolTableDefinition = true;
      symbolTable = {
                      'position': currentElement.positionInStream,
                      'shared': currentElement.isSharedSymbolTable,
                      'append': false,
                      'numSymbols': 0
                    };
      symbolTables.push(symbolTable);
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
        let symbolString = '';
        if (currentElement.length === 0) {
          console.log(`||NOTICE|| Adding 0 length string to symbol table at offset ${currentElement.positionInStream}.`);
        } else {
          symbolString = utilities.readScalarFromElement(currentElement, scalarReader);
        }
        symbolTable.numSymbols++;
        symbolsToAdd.push({ 'symbolString': symbolString, 'position': currentElement.positionInStream});
      }
    }

    // symbol table contains elements
    if (inSymbolTableDefinition === true && currentElement.depth < 2 && currentElement.isContainer && 
        !currentElement.isNull && currentElement.containsElement !== null && currentElement.length !== 0) {
      let elemDef = currentElement.containsElement;
      currentElement = elementStack[elemDef[1]];
      currentElement.repurpose(elemDef[0], elemDef[1],
                               elemDef[2], elemDef[3],
                               elemDef[4], elemDef[5]);
    // this element exceeds the buffer size, descend until it doesn't
    // TODO: remove example or provide more details of example
    // buffer: 5500000
    // 2000000
    // 2000000
    // 10000000
    //  6000000
    //   2000000 dump elemStack, rec pos, return
    //   2000000
    //   2000000
    //  4000000
    //   2000000
    //   2000000
    // 5000000 ...
    } else if (currentElement.totalLength > bufferReader.size) {
      // there are previous topLevelOffsets to return
      if (topLevelOffsets.length > 1) {
        break;
      }
      if (currentElement.containsElement === null) {
        throw new Error(`Element with type ${currentElement.type} at ${currentElement.positionInStream} with length ${currentElement.totalLength} is too large for the buffer size and contains no elements.`);
      } else {
        inLargeContainer = true;
        let elemDef = currentElement.containsElement;
        // resize elementStack if necessary
        while (elemDef[1] >= elementStack.length) {
          elementStack.push(new IonElement(0,0, totalFileSize-offsetInFile, null, null, null));
        }
        currentElement = elementStack[elemDef[1]];
        currentElement.repurpose(elemDef[0], elemDef[1],
                                elemDef[2], elemDef[3],
                                elemDef[4], elemDef[5]);
      }
    // in a large container, next element will fit in buffer by itself and
    // the current element's length exceeds the current buffer
    } else if (inLargeContainer === true &&
               currentElement.totalLength + currentElement.positionInStream > bufferReader.size) {
      // dump the elementStack, mark this element as an element to start reading from
      longElementOffset = currentElement.positionInStream + offsetInFile;
      longElementStack = [];
      for (let i = 0; i < elementStack.length; ++i) {
        longElementStack.push(elementStack[i].minimumDefinition());
        longElementStack[longElementStack.length-1][0] += offsetInFile;
      }
      break;
    // not last at depth
    } else if (currentElement.nextElement) {
      currentElement.repurpose(currentElement.nextElement[0], currentElement.nextElement[1],
                               currentElement.nextElement[2], currentElement.nextElement[3],
                               currentElement.nextElement[4], currentElement.nextElement[5]);
    // contains no elements, last at depth
    } else {
      let tempOldElement = currentElement;
      let nextElementPosition = currentElement.positionInStream + currentElement.totalLength;
      while (currentElement.depth > 0) {
        currentElement = elementStack[currentElement.depth - 1];
        if (inLargeContainer === true) {
          let endOfDepth = currentElement.positionInStream + currentElement.bytesRemainingAtDepth - offsetInFile;
          if (nextElementPosition < endOfDepth) {
            currentElement.nextElement = [nextElementPosition, currentElement.depth, endOfDepth-nextElementPosition,
                                          currentElement.container, currentElement.containerType, currentElement.previousElement];
            break;
          }
        } else if (currentElement.nextElement !== null) {
          break;
        }
      }

      if (inLargeContainer === true && currentElement.depth === 0) {
        inLargeContainer = false;
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
        if (typeof currentElement.positionInStream === "bigint" || typeof currentElement.totalLength === "bigint") {
          let totalLength = BigInt(currentElement.positionInStream) + BigInt(currentElement.totalLength);
          
          // takes care of the case where the length of a top level value is larger than the buffer
          // and is the last top level value in the stream
          if (totalLength === BigInt(totalFileSize)) {
            atEnd = true;
          } else {
            throw new Error("Not at end of stream");
          }
        } else {
          if (!bufferReader.atEnd(currentElement.positionInStream + currentElement.totalLength)) {
            throw new Error("Not at end of stream");
          }
        }

        if (offsetInFile + bytesRead === totalFileSize) {
          atEnd = true;
        }

        currentElement = undefined;
        break;
      }
    }
  }

  postMessage({'action': 'topLevelSlice',
               'symbolTables': symbolTables,
               'symbolsToAdd': symbolsToAdd,
               'offsetInFile': offsetInFile,
               'topLevelOffsets': topLevelOffsets,
               'symbolTableOffsets': symbolTableOffsets,
               'buffer': buffer,
               'contextOffsets': contextOffsets,
               'atEnd': atEnd,
               'longElementOffset': longElementOffset,
               'longElementStack': longElementStack},
              [buffer]);
}

onmessage = (event) => {
  switch (event.data.action) {
    case 'read':
      read(event.data.buffer, event.data.offsetInFile, event.data.totalFileSize, event.data.options);
      break;
    default:
      console.log(`top-level-worker: unknown event ${JSON.stringify(event.data)}`);
  }
};