
importScripts('js/bite.js');

const ByteBufferReader = BITE.ByteBufferReader;
const TypeDescriptorReader = BITE.TypeDescriptorReader;
const IonElement = BITE.IonElement;
const IonTypes = BITE.IonTypes;

let bufferOffset = 0;
let bufferReader = new ByteBufferReader();
let typeReader =  null;

function read(buffer, offsetInFile, totalFileSize, initialContext) {
  let topLevelOffsets = [];
  let symbolTableOffsets = [];
  let context = initialContext;
  let contextOffsets = [];

  bufferReader.loadBuffer(buffer);
  typeReader = new TypeDescriptorReader(bufferReader);

  let elementStack = [];
  let inSymbolTableDefinition = false;
  let inSymbolList = false;

  // descend only to symbol definitions in symbol tables
  for (let i = 0; i < 3; ++i) {
    elementStack.push(new IonElement(0,0, totalFileSize-offsetInFile, null, null, null));
  }
  let currentElement = elementStack[0];

  while (true) {
    try {
      let returnValue = currentElement.readTypeDescriptor(typeReader, context);

      // done reading the buffer!
      if (returnValue === null) {
 
        if (currentElement.positionInStream + offsetInFile >= totalFileSize) {

          if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
            // TODO: Warn here. No use in having a symbol table at the end of a stream.
            symbolTableOffsets.push(currentElement.positionInStream + offsetInFile);
          }

          //console.log(`topLevelOffsets ${JSON.stringify(topLevelOffsets)}`);
          postMessage({'action': 'topLevelSlice',
                       'offsetInFile': offsetInFile,
                       'topLevelOffsets': topLevelOffsets,
                       'symbolTableOffsets': symbolTableOffsets,
                       'contextOffsets': contextOffsets,
                       'buffer': buffer,
                       atEnd: true},
                      [buffer]);
        }
        else {

          // first element in next stream
          //topLevelOffsets.push(currentElement.positionInStream + offsetInFile);

          postMessage({'action': 'topLevelSlice',
                       'offsetInFile': offsetInFile,
                       'topLevelOffsets': topLevelOffsets,
                       'symbolTableOffsets': symbolTableOffsets,
                       'contextOffsets': contextOffsets,
                       'buffer': buffer,
                       atEnd: false},
                      [buffer]);
        }
        break;
      }
    } catch (error) {
      console.log(`Error! currentElement: ${currentElement.toString()}`);
      throw error;
    }

    topLevelOffsets.push(currentElement.positionInStream + offsetInFile);

    // TODO: BVM context
    if (currentElement.type === IonTypes["bvm"]) {
      context = `${currentElement.majorVersion}_${currentElement.minorVersion}`;
      contextOffsets.push({'offset':currentElement.positionInStream + offsetInFile, 'context': context });
    }

    if (currentElement.isLocalSymbolTable === true || currentElement.isSharedSymbolTable === true) {
      symbolTableOffsets.push(currentElement.positionInStream + offsetInFile);
    }

    // not the last top level
    if (currentElement.nextElement) {
      currentElement.repurpose(currentElement.nextElement[0], currentElement.nextElement[1],
                              currentElement.nextElement[2], currentElement.nextElement[3],
                              currentElement.nextElement[4], currentElement.nextElement[5]);
    }
    else {
      // TODO: What happens with multiple Ion streams? Must check to see if data after last
      // element is a new BVM
      //if ((currentElement.positionInStream + currentElement.totalLength) >= buffer.length) {
      //  throw new Error("Not at end of stream");
      //} 

      // first element in next stream or the EOF
      //topLevelOffsets.push(currentElement.positionInStream + currentElement.totalLength + offsetInFile);
      currentElement = undefined;

      postMessage({'action': 'topLevelSlice',
                   'offsetInFile': offsetInFile,
                   'topLevelOffsets': topLevelOffsets,
                   'symbolTableOffsets': symbolTableOffsets,
                   'buffer': buffer,
                   'contextOffsets': contextOffsets,
                   'atEnd': true },
                  [buffer]);

      break;
    }
  }
}

onmessage = (event) => {
  switch (event.data.action) {
    case 'read':
      read(event.data.buffer, event.data.offsetInFile, event.data.totalFileSize, event.data.options.context);
      break;
    default:
      console.log(`top-level-worker: unknown event ${JSON.stringify(event.data)}`);
  }
};