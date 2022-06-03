
importScripts('js/bite.js');

const ByteBufferReader = BITE.ByteBufferReader;
const TypeDescriptorReader = BITE.TypeDescriptorReader;
const ScalarValueReader = BITE.ScalarValueReader;
const ElementReference = BITE.ElementReference;
const Verifier = BITE.Verifier;
const IonElement = BITE.IonElement;
const utilities = BITE.utilities;
const IonTypes = BITE.IonTypes;

let bufferOffset = 0;
let bufferReader = new ByteBufferReader();
let typeReader =  null;

function referenceArrayFromStack(elementStack, depth) {
  let refArray = [];
  let maxDepth = (depth !== undefined) ? depth : elementStack.length;
  for (let i = 0; i < maxDepth; ++i) {
    refArray.push(elementStack[i].reference());
  }
  return refArray;
}

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

  let verify = !!options.verify;
  let inLargeContainer = !!options.inLargeContainer;
  let longElementOffset = null;
  let longElementStack = null;
  let isFromLongElement = null;

  let atEnd = false;


  let currentElement;
  if (inLargeContainer) {
    let stackLength = 3;
    let longStack = options.longElementStack;
    isFromLongElement = [];
    if (longStack.length > stackLength) {
      stackLength = longStack.length;
    }
    for (let i = 0; i < stackLength; ++i) {
      if (i >= longStack.length) {
        if (totalFileSize-offsetInFile < 0) {
          throw new Error(`?`);
        }
        elementStack.push(new IonElement([offsetInFile, 0, 0, totalFileSize-offsetInFile, null, null, undefined]));
      } else {
        let elemRef = longStack[i];
        if (i === (longStack.length-1)) {
          elemRef = [offsetInFile, 0, elemRef[2], elemRef[3],
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
      elementStack.push(new IonElement([offsetInFile, 0, 0, totalFileSize-offsetInFile, null, null, undefined]));
    }
    currentElement = elementStack[0];
  }

  let verifier;
  if (verify === true) {
    verifier = new Verifier((inLargeContainer) ? elementStack.slice(0, options.longElementStack.length) : [],
                            bytesRead, false, false);
  }

  while (true) {
    
    try {
      let returnValue = currentElement.readTypeDescriptor(typeReader, context);

      // done reading the buffer!
      if (returnValue === null) { 
        //bytesRead = currentElement.previousElement;
        if (inLargeContainer === true) {
          // dump the elementStack, mark this element as an element to start reading from
          longElementOffset = currentElement.absoluteOffset;
          longElementStack = [];
          for (let i = 0; i <= currentElement.depth; ++i) {
            longElementStack.push(elementStack[i].reference());
          }
          if (verify === true) {
            verifier.verifyStack(longElementStack, true);
            verifier.atEnd(currentElement.totalLength);
          }
        }
        break;
      }
    } catch (error) {
      console.log(`Error! currentElement: ${currentElement.toString()} offset: ${currentElement.absoluteOffset}`);
      throw error;
    }

    if (offsetInFile === 0 && currentElement.relativeOffset === 0 &&
        currentElement.type !== IonTypes["bvm"]) {
      throw new Error("||top-level-worker|| no BVM found");
    }

    if (currentElement.depth === 0) {
      if (topLevelOffsets.length === 0) {
        topLevelOffsets.push(currentElement.absoluteOffset);
      // check if this element is not larger than the buffer by itself, but does go past the end of the buffer
      // if so, the values will be read in the next buffer
      } else if (currentElement.totalLength < bufferReader.size &&
                 currentElement.totalLength + currentElement.relativeOffset > bufferReader.size) {
        topLevelOffsets.push(currentElement.absoluteOffset);
        break;
      // it has been more than a magic number of bytes since the last top level offset
      } else if (currentElement.absoluteOffset - topLevelOffsets[topLevelOffsets.length-1] > 1000000) {
        topLevelOffsets.push(currentElement.absoluteOffset);
      }
    }

    if (currentElement.type === IonTypes["bvm"]) {
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;
      contextOffsets.push({'offset':currentElement.absoluteOffset, 'context': context });
      postMessage({
        'action': 'BVMValidated',
        'majorVersion': currentElement.majorVersion,
        'minorVersion': currentElement.minorVersion,
        'offset': currentElement.relativeOffset
      });

      symbolTable = {
        'position': currentElement.relativeOffset,
        'shared': false,
        'append': false,
        'numSymbols': 0
      };
      symbolTables.push(symbolTable);
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      symbolTableOffsets.push(currentElement.absoluteOffset);
      inSymbolTableDefinition = true;
      symbolTable = {
                      'position': currentElement.relativeOffset,
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
          console.log(`||NOTICE|| Adding 0 length string to symbol table at offset ${currentElement.absoluteOffset}.`);
        } else {
          symbolString = utilities.readScalarFromElement(currentElement, scalarReader);
        }
        symbolTable.numSymbols++;
        symbolsToAdd.push({ 'symbolString': symbolString, 'position': currentElement.relativeOffset});
      }
    }

    // symbol table contains elements
    if (inSymbolTableDefinition === true && currentElement.depth < 2 && currentElement.isContainer && 
        !currentElement.isNull && currentElement.containsElement !== null && currentElement.length !== 0) {
      let elemDef = currentElement.containsElement;
      // 2- depth
      currentElement = elementStack[elemDef[2]];
      if (elemDef[1] > bufferReader.size) {
        throw new Error(`Ding!`);
      }
      if (verify === true) {
        verifier.verifyElement(elemDef);
        verifier.verifyStack(referenceArrayFromStack(elementStack, elemDef[2]));
      }
      currentElement.repurpose(elemDef);
      if (isFromLongElement !== null && isFromLongElement[elemDef[2]] === true) {
        isFromLongElement[elemDef[2]] = false;
      }
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
        //throw new Error(`Shouldn't happen: ${topLevelOffsets}`);
        //break;
      }
      if (currentElement.containsElement === null) {
        throw new Error(`Element with type ${currentElement.type} at ${currentElement.relativeOffset} with length ${currentElement.totalLength} is too large for the buffer size and contains no elements.`);
      } else {
        inLargeContainer = true;
        let elemDef = currentElement.containsElement;
        // resize elementStack if necessary
        // 2- depth
        while (elemDef[2] >= elementStack.length) {
          elementStack.push(new IonElement([offsetInFile, 0, 0, totalFileSize-offsetInFile, null, null, undefined]));

          if (isFromLongElement !== null && isFromLongElement[elementStack.length-1] === true) {
            isFromLongElement[elementStack.length-1] = false;
          }
        }
        // 2- depth
        currentElement = elementStack[elemDef[2]];
        if (elemDef[1] > bufferReader.size || (currentElement.relativeOffset + currentElement.totalLength > bufferReader.size)) {
          throw new Error(`Ding!`);
        }
        if (verify === true) {
          verifier.verifyElement(elemDef);
          verifier.verifyStack(referenceArrayFromStack(elementStack, elemDef[2]));
        }
        currentElement.repurpose(elemDef);
      }
    // in a large container, next element will fit in buffer by itself and
    // the current element's length exceeds the current buffer
    } else if (inLargeContainer === true &&
               currentElement.totalLength + currentElement.relativeOffset > bufferReader.size) {
      // dump the elementStack, mark this element as an element to start reading from
      longElementOffset = currentElement.absoluteOffset;
      longElementStack = [];
      for (let i = 0; i <= currentElement.depth; ++i) {
        longElementStack.push(elementStack[i].reference());
      }
      if (verify === true) {
        verifier.verifyStack(longElementStack, true);
        verifier.atEnd(currentElement.totalLength);
      }
      break;
    // not last at depth
    } else if (currentElement.nextElementReference !== undefined &&
               currentElement.nextElementReference !== null) {
      if (currentElement.nextElementReference[1] > bufferReader.size) {
        //throw new Error(`Ding!`);
        break;
      }
      if (verify === true) {
        verifier.verifyElement(currentElement.nextElementReference);
        verifier.verifyStack(referenceArrayFromStack(elementStack, currentElement.depth));
      }
      currentElement.repurpose(currentElement.nextElementReference);
    // contains no elements, last at depth
    } else {

      let origElementOffset = currentElement.absoluteOffset;
      
      if (isFromLongElement !== null && isFromLongElement.length >= (currentElement.depth-1)) {
        isFromLongElement[currentElement.depth-1] = false;
      }

      if (currentElement.relativeOffset + currentElement.totalLength > bufferReader.size) {
        if (inLargeContainer === true) {
          // dump the elementStack, mark this element as an element to start reading from
          longElementOffset = currentElement.absoluteOffset;
          longElementStack = [];
          for (let i = 0; i <= currentElement.depth; ++i) {
            longElementStack.push(elementStack[i].reference());
          }
          if (verify === true) {
            verifier.verifyStack(longElementStack, true);
            verifier.atEnd(currentElement.totalLength);
          }
          break;
        }
      }

      while (currentElement.depth > 0) {
        currentElement = elementStack[currentElement.depth - 1];
        
        if (isFromLongElement !== null && isFromLongElement[currentElement.depth-1] === true) {
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
        symbolTable = undefined;
      }

      if (inSymbolList === true && currentElement.depth < 2) {
        inSymbolList = false;
      }

      if (currentElement.nextElementReference !== undefined &&
          currentElement.nextElementReference !== null) {

        if (verify === true) {
          verifier.verifyElement(currentElement.nextElementReference);
          verifier.verifyStack(referenceArrayFromStack(elementStack, currentElement.depth));
        }
        if ((currentElement.nextElementReference[0]+currentElement.nextElementReference[1]-offsetInFile) > bufferReader.size) {
          throw new Error(`Ding!`);
        }
        
        let nextElement = currentElement.nextElementReference;
        if (inLargeContainer === true) {
          let absoluteOffset = nextElement[0] + nextElement[1];
          nextElement[0] = absoluteOffset - offsetInFile;
          nextElement[1] = absoluteOffset - nextElement[0];
        }
        currentElement.repurpose(nextElement);
      }
      // finished
      else {
        if (typeof currentElement.relativeOffset === "bigint" || typeof currentElement.totalLength === "bigint") {
          let totalLength = BigInt(currentElement.relativeOffset) + BigInt(currentElement.totalLength);
          
          // takes care of the case where the length of a top level value is larger than the buffer
          // and is the last top level value in the stream
          if (totalLength === BigInt(totalFileSize)) {
            atEnd = true;
          } else {
            throw new Error("Not at end of stream");
          }
        } else {
          if (!(bufferReader.atEnd(currentElement.relativeOffset + currentElement.totalLength) || 
              (offsetInFile + bytesRead === totalFileSize))) {
            throw new Error("Not at end of stream");
          }
        }

        if (offsetInFile + bytesRead === totalFileSize) {
          atEnd = true;
        }

        // dump the elementStack, mark this element as an element to start reading from
        longElementOffset = origElementOffset;
        longElementStack = [];
        for (let i = 0; i <= currentElement.depth; ++i) {
          longElementStack.push(elementStack[i].reference());
        }
        if (verify === true) {
          verifier.verifyStack(longElementStack, true);
          verifier.atEnd(currentElement.totalLength);
        }

        currentElement = undefined;
        break;
      }
    }
  }

  if (topLevelOffsets.length === 0 && longElementOffset === null) {
    throw new Error(`No offset`);
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