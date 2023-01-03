'use strict';

importScripts('js/bite.js');

const BYTES_TO_BUFFER = 35000000;
const INSPECT_BYTES = 300000;
const NUMBER_OF_WORKERS = 3;
const VERIFY = false;

const bsr = new BITE.ByteSliceReader(BYTES_TO_BUFFER);
const bsr_inspect = new BITE.ByteSliceReader(BYTES_TO_BUFFER);
const bsr_toplevel = new BITE.ByteSliceReader(BYTES_TO_BUFFER);
const SymbolTable = BITE.SymbolTable;
const IonTypes = BITE.IonTypes;
const Analyzer = BITE.Analyzer;
const ElementStack = BITE.ElementStack;

let fileStats = 0;
let t0;
let t1;
let t2;

let topLevelOffsets = [0];
let readerSliceOffsets = [];
let readerSliceLongElements = [];
let workerOffsets = [];
let lastProcessed = 0;
let symbolTableOffsets = [];

let stats = new Analyzer();
let symbolTables = [];
let contexts = [];
let topLevelReaderStarted = false;
let topLevelReaderDone = false;
let readingFinished = false;

let numWorkers = NUMBER_OF_WORKERS;
let bytesToBuffer = BYTES_TO_BUFFER;



let checkpoints = [];

class Checkpoint {
  #offset = 0;
  #elementStack = null;
  constructor(offset, elementStack) {
    if (!((Number.isInteger(offset) && offset >= 0) || 
         (typeof offset === 'bigint' && offset >= 0n))) {
      throw new Error(`Checkpoint - offset ${offset} is not a number.`);
    }

    if (!(elementStack instanceof ElementStack || elementStack === null)) {
      throw new Error(`Checkpoint - elementStack ${elementStack} is not an ElementStack.`);
    }

    this.#offset = offset;
    this.#elementStack = elementStack;
  }

  get offset() {
    return this.#offset;
  }

  get elementStack() {
    return this.#elementStack;
  }
};

// ensures checkpoints are sorted in ascending order by offset
function addCheckpoint(checkpoint) {
  if (!(checkpoint instanceof Checkpoint)) {
    throw new Error(`addCheckpoint - checkpoint ${checkpoint} is not a Checkpoint.`);
  }

  // most common case, adding checkpoint to the end
  if (checkpoints.length === 0 || checkpoint.offset > checkpoints[checkpoints.length-1].offset) {
    checkpoints.push(checkpoint);
    return;
  }

  for (let i = checkpoints.length-1; i >= 0; --i) {
    if (checkpoint.offset === checkpoints[i].offset) {
      // do nothing
      return;
    }
    if (checkpoint.offset > checkpoints[i].offset) {
      //insert
      checkpoints.splice(i, 0, checkpoint);
      return;
    }
  }

  throw new Error(`addCheckpoint - checkpoint not added to checkpoints.`);
}

function findNearestCheckpoint(offset) {
  let nearestOffsetIndex = checkpoints.length-1;
  for (let i = 0; i < checkpoints.length; ++i) {
    if (checkpoints[i].offset > offset) {
      nearestOffsetIndex = i-1;
      break;
    }
  }
  return checkpoints[nearestOffsetIndex];
}

// WorkerCoordinator delegates work to a pool of workers, stores the meta information about the bytes (symbol tables,
// stats, etc.), and is the communication hub with the main thread.

// When WorkerCoordinator receives a new file it performs two passes on the file.
// 1. The first pass reads the first slice (with a reader-worker), fills in all symbol tables in the first display
//    slice, sends the initial display slice text to the main thread, and then serially reads all of the following top
//    level values (with a top-level-worker) in the file.
// 2. The second pass starts at the end of the initial display slice and then, in parallel, reads every value (with
//    readers from the reader-worker pool), fills in symbol tables, and records the stats for values in the file. The
//    main thread is then notified that the stats are complete.

function addTopLevelOffsets(offsetArray) {
  if (offsetArray === undefined || offsetArray.length === 0) {
    return;
  }
  // drop the first element as it is the same as the last element of the previous array
  if (topLevelOffsets[topLevelOffsets.length-1] === offsetArray[0]) {
    offsetArray.shift();
  } else {
    throw new Error(`worker-coordinator: top level offset ${topLevelOffsets[topLevelOffsets.length-1]} does not match offsetArray ${offsetArray[0]}`);
  }

  topLevelOffsets = topLevelOffsets.concat(offsetArray);
}

// TODO: inefficient, move to binary search
function findNearestTopLevelOffset(offsetToStart) {
  let nearestOffsetIndex = topLevelOffsets.length-1;
  for (let i = 0; i < topLevelOffsets.length; ++i) {
    if (topLevelOffsets[i] > offsetToStart) {
      nearestOffsetIndex = i-1;
      break;
    }
  }

  return topLevelOffsets[nearestOffsetIndex];
}

function addSymbolTable(symbolTable) {
  //if (symbolTables.length === 0) {
  //  symbolTables.push({"table":new SymbolTable(true, true, true), "offset":0});
  //}
  //else {
    symbolTables.push({"table":new SymbolTable(true, true, true, contextForOffset(symbolTable.position), symbolTable.position),
                       "offset":symbolTable.position});
  //}
}

function getSymbolTable(offset) {
  let symbolTableIndex = symbolTables.length - 1;
  if (symbolTableIndex < 0) { console.log(`getSymbolTable return null`); return null; }
  for (let i = 0; i < symbolTables.length; ++i) {
    if (offset > symbolTables[i].offset) {
      symbolTableIndex = i;
    } else {
      break;
    }
  }

  return symbolTables[symbolTableIndex].table;
}

function addSymbolTableOffsets(offsetArray) {
  symbolTableOffsets = symbolTableOffsets.concat(offsetArray);
}

function contextForOffset(offset) {
  let context = contexts[0] || {"context": "unknown"};
  for (let i = 1; i < contexts.length; ++i) {
    if (contexts[i].offset > offset) {
      break;
    } else {
      context = contexts[i];
    }
  }
  return context.context;
}

/**
 * Expects:
 * { 'offset': Number, 'context': '1_0' || '1_1' || 'unknown' }
 * 
 * Discards duplicates as worker-reader and top-level-worker both report BVMs during the first pass.
 */
function addContextOffsets(contextOffsets) {
  while (contexts.length > 0 && contextOffsets[0].offset <= contexts[contexts.length-1].offset) {
    contexts.shift();
  }
  for (let i = 0; i < contextOffsets.length; ++i) {
    contexts.push(contextOffsets[i]);
  }
}

let inspectWorker = new Worker('inspect-worker.js');
inspectWorker.onmessage = (event) => {
  switch (event.data.action) {
    case "nibbles":
      let nibbles = event.data.nibblesToDisplay;
      for (let i = 0; i < nibbles.length; ++i) {
        let offset = nibbles[i].offset;
        let symbolTable = getSymbolTable(offset);
        if (nibbles[i].fieldName !== null) {
          if (symbolTable !== null) {
            nibbles[i].fieldName.symbolValue = symbolTable.getSymbolValue(nibbles[i].fieldName.symbolMagnitude, offset);
          } else {
            // TODO: ERROR - no symbol table
          }
        }
        if (nibbles[i].annotation.annotations !== undefined) {
          let annotations = nibbles[i].annotation.annotations;
          for (let j = 0; j < annotations.length; ++j) {
            if (symbolTable !== null) {
              annotations[j].symbolValue = symbolTable.getSymbolValue(annotations[j].symbolMagnitude, offset);
            } else {
              // TODO: ERROR - no symbol table
            }
          }
        }
        if (nibbles[i].element.typeValue === IonTypes['symbol']) {
          if (symbolTable !== null) {
            nibbles[i].element.representation = symbolTable.getSymbolValue(nibbles[i].element.details, offset);
          } else {
            // TODO: ERROR - no symbol table
          }
        }
      };
      postMessage({'action': 'nibblesToDisplay', 'nibbles': nibbles, 'target': event.data.target });
      break;
    default:
      console.log(`worker-coordinator: received action from inspectWorker ${event.data.action}`);
      break;
  }
};
inspectWorker.onerror = (error) => {
  console.log(`worker-coordinator: received error from inspectWorker ${JSON.stringify(error)}`);
};

// The top-level worker completes the first pass of the file
let topLevelWorker = new Worker('top-level-worker.js');
topLevelWorker.onmessage = (event) => {
  switch (event.data.action) {
    case 'topLevelSlice':
      let bytesRead;

      if (event.data.longElementOffset !== null) {
        bytesRead = event.data.longElementOffset - event.data.offsetInFile;
      } else {
        bytesRead = event.data.topLevelOffsets[event.data.topLevelOffsets.length-1] - event.data.offsetInFile;
      }

      addTopLevelOffsets(event.data.topLevelOffsets);
      let tlo = event.data.topLevelOffsets;
      for (let i = 0; i < tlo.length; ++i) {
        addCheckpoint(new Checkpoint(tlo[i], null));
      }

      if (event.data.longElementOffset !== null) {
        addCheckpoint(new Checkpoint(event.data.longElementOffset, new ElementStack(event.data.longElementStack)));
      }

      addSymbolTableOffsets(event.data.symbolTableOffsets);
      if (event.data.contextOffsets.length > 0) {
        addContextOffsets(event.data.contextOffsets);
      }

      // add symbol tables
      for (let j = 0; j < event.data.symbolTables.length; ++j) {
        if (event.data.symbolTables[j].append === false) {
          addSymbolTable(event.data.symbolTables[j]);
        }
        stats.addSymbolTable(event.data.symbolTables[j]);
      }

      // add symbols
      let symbolsToAdd = event.data.symbolsToAdd;
      
      for (let j = 0; j < symbolsToAdd.length; ++j) {
        let symbolTable = getSymbolTable(symbolsToAdd[j].position+event.data.offsetInFile);
        if (symbolTable !== null) {
          let symbolID = symbolTable.addSymbol(symbolsToAdd[j].symbolString, 
                                               symbolsToAdd[j].position+event.data.offsetInFile);
        } else {
          // TODO: ERROR - no symbol table
        }
      }

      let symbols = [];
      let offsets = [];
      for (let i = 0; i < symbolTables.length; ++i) {
        symbols.push(symbolTables[i].table.symbols);
        offsets.push(symbolTables[i].table.meta);
      }

      postMessage({'action': 'topLevelSliceCompleted', 'bytesRead': bytesRead, 'symbolTables': symbols, 'symbolOffsets': offsets});

      // At the first slice and there are more bytes than the first inspect pass will read
      if (event.data.offsetInFile === 0) {
        //  &&
        //  event.data.topLevelOffsets[event.data.topLevelOffsets.length-1] > INSPECT_BYTES_TO_BUFFER) {
        //let firstOffsetToRead = findNearestTopLevelOffset(INSPECT_BYTES_TO_BUFFER);
        //readerSliceOffsets.unshift(firstOffsetToRead);
        readerSliceOffsets.unshift(0);
        readerSliceLongElements.unshift([null, null]);

        bsr_inspect.fillBuffer(4, 0).then(value => {
          let buf = bsr_inspect.biBuffer;
          sendBufferToWorker(inspectWorker, buf, 0, {'rangeStart': 0, 'rangeEnd': INSPECT_BYTES});
        });
      }

      if (event.data.atEnd === true) {
        t1 = performance.now();
        let msTaken = t1 - t0;
        postMessage({'action': 'topLevelValuesRead', 'numValues': topLevelOffsets.length, 
                     'numSymbolTables': symbolTableOffsets.length, 'msTaken': msTaken});

        topLevelReaderDone = true;
        //bsr.setBufferSize(bytesToBuffer);
        //checkReaderWorkers();
      } else {
        // next set of top level values
        let offsetToStart;
        let options = { 'verify': VERIFY };
        if (event.data.longElementOffset !== null) {
          offsetToStart = event.data.longElementOffset;
          options.inLargeContainer = true;
          options.longElementStack = event.data.longElementStack;
          options.longElementStackNext = event.data.longElementStackNext;
        } else {
          if (event.data.topLevelOffsets.length === 0) {
            console.log(event.data);
          }
          offsetToStart = event.data.topLevelOffsets[event.data.topLevelOffsets.length-1];
        }

        let context = contextForOffset(offsetToStart);
        if (offsetToStart > readerSliceOffsets[readerSliceOffsets.length-1]) {
          readerSliceOffsets.push(offsetToStart);
        } else {
          throw new Error(`worker-coordinator: offsetToStart ${offsetToStart} <= last readerSliceOffsets ${readerSliceOffsets[readerSliceOffsets.length-1]}`);
        }
        readerSliceLongElements.push([event.data.longElementStack, event.data.longElementStackNext]);
        options.context = context;

        // read the next buffer and then send that buffer to the top-level-worker to read all
        // top-level values in the file
        //                      +- minimum bytes needed (bvm size)
        //                      |  +- offset to start
        //                      V  v
        console.log(`bsr_toplevel fillBuffer ${offsetToStart}`);
        bsr_toplevel.fillBuffer(4, offsetToStart).then(value => {
          let buf = bsr_toplevel.biBuffer;
          sendBufferToWorker(topLevelWorker, buf, offsetToStart, options);
        });
      }

      if (availableWorkers.length > 0) {
        checkReaderWorkers(readerSliceOffsets[0], event.data.buffer);
      }
      break;
    default:
      console.log(`worker-coordinator: unknown event from topLevelWorker ${JSON.stringify(event.data)}`);
  }
};
topLevelWorker.onerror = (error) => {
  console.log(`worker-coordinator: received error from topLevelWorker ${JSON.stringify(error)}`);
};

// Creates the NUMBER_OF_WORKERS in the pool of workers
// These workers complete the second pass of the file
let workers = [];
let availableWorkers = [];
function createReaderWorkers(numWorkers, workerSize) {
  workers = [];
  availableWorkers = [];
  for (let i = 0; i < numWorkers; ++i) {
    workers[i] = new Worker('worker-reader.js');
    workers[i].onmessage = (event) => {
      let self = workers[i];

      if (event.data.action === "BVMValidated") {
        addContextOffsets([{'offset': event.data.offset,
                            'context': `${event.data.majorVersion}_${event.data.minorVersion}` }]);

        /* not needed anymore, topLevelReaders validate BVM and go first
        if (topLevelReaderStarted === false) {
          // start top-level-worker
          bsr_toplevel.setBufferSize(bytesToBuffer);
          console.log(`bsr_toplevel fillBuffer ${event.data.offset} (!topLevelReaderStarted)`);
          bsr_toplevel.fillBuffer(4, event.data.offset).then(value => {
            let buf = bsr_toplevel.biBuffer;
            sendBufferToWorker(topLevelWorker, buf, event.data.offset, {"context": "unknown"});
          });
          topLevelReaderStarted = true;
        }*/
      } else if (event.data.action === "done") {
        workerOffsets.push({
                              "workerNum": i,
                              "offsetStart": event.data.offset,
                              "offsetFinish": event.data.offset + event.data.size,
                              "processed": false
                            });

        stats.combineStats(event.data.stats);

        let currentPointer = 0;
        while (currentPointer !== workerOffsets.length) {
          if (workerOffsets[currentPointer].offsetStart === lastProcessed) {

            // add symbol usages

            //let symbolUsages = workerOffsets[currentPointer].symbolUsages;
            //for (let j = 0; j < symbolUsages; ++j) {

            //}

            // clear arrays and set processed
            workerOffsets[currentPointer].symbolsToAdd = null;
            workerOffsets[currentPointer].processed = true;

            lastProcessed = workerOffsets[currentPointer].offsetFinish;
            currentPointer = 0;
          } else {
            currentPointer++;
          }
        }

        postMessage({'action': 'workerReaderFinishedBuffer', 'offset': event.data.offset, 'size': event.data.size,
                     'stats': stats.stats });

        availableWorkers.push(self);
        checkReaderWorkers();
      }
    };
    workers[i].onerror = (error) => {
      console.log(`worker-coordinator: received error from worker pool ${JSON.stringify(error)}`);
    };
    workers[i].postMessage({'action': 'number', 'value': i});
    availableWorkers.push(workers[i]);
  }
}
createReaderWorkers(numWorkers, bytesToBuffer);

function checkReaderWorkers(offsetToStart, buffer) {
  //if (topLevelReaderDone === false) {
  //  return;
  //}
  if (availableWorkers.length > 0 && readerSliceOffsets.length > 0) {
    let readerWorker;
    let sliceOffset;
    let inLargeContainer = false;
    let sliceLongElements;
    let sliceLongStack = null;
    let sliceLongNext = null;
    let context;
    /* TODO: Does reusing a buffer (as below) save any appreciable time?
    if (offsetToStart !== undefined && buffer !== undefined) {
      console.log(`checkReaderWorkers_b ${availableWorkers} ${readerSliceOffsets}`);
      readerWorker = availableWorkers.shift();
      sliceOffset = readerSliceOffsets.shift(); 
      sliceLongElements = readerSliceLongElements.shift();
      if (sliceOffset !== offsetToStart) {
        throw new Error(`worker-coordinator: expected sliceOffset ${sliceOffset} to equal offsetToStart ${offsetToStart}`);
      }
      // set the buffer size to the exact size between top level values
      let exactSize;
      if (readerSliceOffsets.length > 0 || (fileStats - sliceOffset) < BYTES_TO_BUFFER) {
        exactSize = readerSliceOffsets[0] - sliceOffset;
      } else {
        //exactSize = fileStats - sliceOffset;
        return;
      }
      if (exactSize < 0) {
        throw new Error(`worker-coordinator: checkReaderWorkers buffer size is ${exactSize}`);
      }
      if (exactSize > BYTES_TO_BUFFER) {
        throw new Error(`worker-coordinator: checkReaderWorkers buffer size is ${exactSize}`);
      }
      if (sliceLongElements && sliceLongElements[0] !== null) {
        inLargeContainer = true;
      }
      if (inLargeContainer === true) {
        sliceLongStack = sliceLongElements[0];
        sliceLongNext = sliceLongElements[1];
      }
      context = contextForOffset(sliceOffset);
      sendBufferToWorker(readerWorker, buffer, sliceOffset, {'context': context, 'inLargeContainer': inLargeContainer, 
                                                             'longElementStack': sliceLongStack,
                                                             'longElementStackNext': sliceLongNext,
                                                             'exactSize': exactSize});
    } else*/ 
    if (bsr.isReady === true) {
      console.log(`checkReaderWorkers_r ${availableWorkers} ${readerSliceOffsets}`);
      readerWorker = availableWorkers.shift();
      sliceOffset = readerSliceOffsets.shift();
      sliceLongElements = readerSliceLongElements.shift();
      context = contextForOffset(sliceOffset);
      // set the buffer size to the exact size between top level values
      let exactSize;
      if (readerSliceOffsets.length > 0) {
        exactSize = readerSliceOffsets[0] - sliceOffset;
      } else {
        if (fileStats - sliceOffset > BYTES_TO_BUFFER) {
          availableWorkers.unshift(readerWorker);
          readerSliceOffsets.unshift(sliceOffset);
          readerSliceLongElements.unshift(sliceLongElements);
          return;
        }
        exactSize = fileStats - sliceOffset;
      }
      if (exactSize < 0) {
        throw new Error(`worker-coordinator: checkReaderWorkers buffer size is ${exactSize}`);
      }
      if (exactSize > BYTES_TO_BUFFER) {
        throw new Error(`worker-coordinator: checkReaderWorkers buffer size is ${exactSize}`);
      }
      if (sliceLongElements && sliceLongElements[0] !== null) {
        inLargeContainer = true;
      }
      if (inLargeContainer === true) {
        sliceLongStack = sliceLongElements[0];
        sliceLongNext = sliceLongElements[1];
      }
      bsr.setBufferSize(exactSize);
      //console.log(`## ${sliceOffset} + ${exactSize} = ${sliceOffset+exactSize}`);
      bsr.fillBuffer(4, sliceOffset).then(value => {
        let buf = bsr.biBuffer;
        let options = {
          'verify': VERIFY,
          'inspect': false,
          'context': context,
          'inLargeContainer': inLargeContainer, 
          'longElementStack': sliceLongStack,
          'longElementStackNext': sliceLongNext
        };
        sendBufferToWorker(readerWorker, buf, sliceOffset, options);
        checkReaderWorkers();
      });
    } else if (bsr.isReady === false) {
      console.log(`checkReaderWorkers bsr.isReady is false!!!`);
    }
  }
  else if (readerSliceOffsets.length === 0 && availableWorkers.length === numWorkers) {
    t2 = performance.now();
    let msTaken = t2-t0;
    if (readingFinished === false) {
      let symbols = [];
      let offsets = [];
      let uses = [];
      for (let i = 0; i < symbolTables.length; ++i) {
        symbols.push(symbolTables[i].table.symbols);
        offsets.push(symbolTables[i].table.meta);
        uses.push(symbolTables[i].table.usageCounts);
      }
      postMessage({'action': 'workerReaderTiming', 'msTaken': msTaken, 'stats': stats.stats, 'symbolTables': symbols, 'symbolOffsets': offsets, 'symbolUses': uses});
      readingFinished = true;
    }
  }
}

function callbackCheckReaderWorkers(e) {
  //checkReaderWorkers();
}

function sendBufferToWorker (worker, buffer, offsetInFile, options) {
  if (buffer === undefined || buffer === null) {
    throw new Error(`sendBufferToWorker error: buffer === ${buffer}`);
  }
  // Uses "transferables"
  worker.postMessage({'action': 'read', 'buffer': buffer, 'offsetInFile': offsetInFile, 'totalFileSize': fileStats, 'options': options },
                      [buffer]);
}

// Set up event handlers for events from the main thread. 
onmessage = (event) => {
  switch (event.data.action) {
    case 'loadFile':
      topLevelOffsets = [0];
      checkpoints = [];
      readerSliceOffsets = [];
      readerSliceLongElements = [];
      workerOffsets = [];
      lastProcessed = 0;
      t0 = performance.now();
      topLevelReaderStarted = false;
      topLevelReaderDone = false;
      let file = event.data.file;
      fileStats = bsr.loadFile(file);
      bsr_toplevel.loadFile(file);
      bsr_inspect.loadFile(file);
      readingFinished = false;
    
      bsr.readerOnLoadEndCallback = callbackCheckReaderWorkers;
    
      // notify the main thread of the size of the file
      postMessage({'action': 'loaded', 'fileStats': fileStats});

      addCheckpoint(new Checkpoint(0, null));

      bsr_toplevel.setBufferSize(bytesToBuffer);

      console.log(`bsr_toplevel fillBuffer 0 (loadFile)`);
      bsr_toplevel.fillBuffer(4, 0).then(value => {
        let buf = bsr_toplevel.biBuffer;
        sendBufferToWorker(topLevelWorker, buf, 0, {"context": "unknown"});
      });

      // start worker-reader
      /*
      bsr.setBufferSize(INSPECT_BYTES_TO_BUFFER);
      bsr.fillBuffer(4, 0).then(value => {
        let buf = bsr.biBuffer;
        let readerWorker = availableWorkers.shift();
        let options = {
          'inspect': true,
          'suppressSymbolTables': false,
          'validateBVMExists': true
        };
        sendBufferToWorker(readerWorker, buf, 0, options);
      });*/
      break;
    // takes an array of symbol ids
    case 'exploreSymbols':
      for (let i=0; i < event.data.symbolIDs.length; ++i) {
        //let symbolTable = getSymbolTable(event.data.symbolIDs[i].offset);
        //console.log(`exploreSymbols ${symbolTable.getSymbolValue(event.data.symbolIDs[i])}`);
      }
      break;
    // takes an offset in bytes, a target number of bytes before the offset to find the nearest top level value,
    // and a total number of bytes to return
    case 'exploreBinary':
      let nearestCheckpoint = findNearestCheckpoint(event.data.offset);
      let nearestOffsetIndex = nearestCheckpoint.offset;
      let isInLargeContainer = !!nearestCheckpoint.elementStack && nearestCheckpoint.elementStack.length !== 0;

      if (bsr_inspect.isReady === false) {
        throw new Error(`worker-coordinator: exploreBinary - bsr_inspect.isReady === false`);
      }
      bsr_inspect.setBufferSize(BYTES_TO_BUFFER);
      bsr_inspect.fillBuffer(4, nearestOffsetIndex).then(value => {
        let buf = bsr_inspect.biBuffer;
        let options = {
          'verify': VERIFY,
          'context': contextForOffset(nearestOffsetIndex),
          'rangeStart': event.data.offset,
          'rangeEnd': event.data.offset + INSPECT_BYTES,
          'inLargeContainer': isInLargeContainer,
          'longElementStack': (nearestCheckpoint.elementStack !== null) ? 
                                nearestCheckpoint.elementStack.toArrays() :
                                undefined
        };
        sendBufferToWorker(inspectWorker, buf, nearestOffsetIndex, options);
      });
      break;
    case 'setNumWorkers':
      numWorkers = event.data.numWorkers;
      createReaderWorkers(numWorkers, bytesToBuffer);
      break;
    case 'setWorkerSize':
      bytesToBuffer = event.data.workerSize;
      createReaderWorkers(numWorkers, bytesToBuffer);
      break;
    default:
      console.log(`worker-coordinator: unknown event ${JSON.stringify(event.data)}`);
  }
};
