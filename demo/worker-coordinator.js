'use strict';

importScripts('js/bite.js');

const BYTES_TO_BUFFER = 35000000;
const INSPECT_BYTES_TO_BUFFER = 100000;
const NUMBER_OF_WORKERS = 3;

const bsr = new BITE.ByteSliceReader(BYTES_TO_BUFFER);
const bsr_toplevel = new BITE.ByteSliceReader(BYTES_TO_BUFFER);
const SymbolTable = BITE.SymbolTable;
const IonTypes = BITE.IonTypes;
const Analyzer = BITE.Analyzer;

let fileStats = 0;
let t0;
let t1;
let t2;

let topLevelOffsets = [0];
let readerSliceOffsets = [];
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

// The top-level worker completes the first pass of the file
let topLevelWorker = new Worker('top-level-worker.js');
topLevelWorker.onmessage = (event) => {
  switch (event.data.action) {
    case 'topLevelSlice':
      console.log(`worker-coordinator topLevelSlice ${JSON.stringify(event.data)}`);
      let bytesRead = event.data.topLevelOffsets[event.data.topLevelOffsets.length - 1] - event.data.offsetInFile;
      //addTopLevelOffsets(event.data.topLevelOffsets);
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
      }

      if (event.data.atEnd === true) {
        t1 = performance.now();
        let msTaken = t1 - t0;
        postMessage({'action': 'topLevelValuesRead', 'numValues': topLevelOffsets.length, 
                     'numSymbolTables': symbolTableOffsets.length, 'msTaken': msTaken});

        topLevelReaderDone = true;
        bsr.setBufferSize(bytesToBuffer);
        //checkReaderWorkers();

      } else {
        // next set of top level values
        let offsetToStart;
        let options = {};
        if (event.data.longElementOffset !== null) {
          offsetToStart = event.data.longElementOffset;
          options.inLargeContainer = true;
          options.longElementStack = event.data.longElementStack;
        } else {
          offsetToStart = event.data.topLevelOffsets[event.data.topLevelOffsets.length-1];
        }
        let context = contextForOffset(offsetToStart);
        readerSliceOffsets.push(offsetToStart);
        options.context = context;

        // read the next buffer and then send that buffer to the top-level-worker to read all
        // top-level values in the file
        //                      +- minimum bytes needed (bvm size)
        //                      |  +- offset to start
        //                      V  v
        bsr_toplevel.fillBuffer(4, offsetToStart).then(value => {
          let buf = bsr_toplevel.biBuffer;
          sendBufferToWorker(topLevelWorker, buf, offsetToStart, options);
        });
      }

      if (availableWorkers.length > 0) {
        //checkReaderWorkers(event.data.offsetInFile, event.data.buffer);
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

        if (topLevelReaderStarted === false) {
          // start top-level-worker
          bsr_toplevel.setBufferSize(bytesToBuffer);
          bsr_toplevel.fillBuffer(4, event.data.offset).then(value => {
            let buf = bsr_toplevel.biBuffer;
            sendBufferToWorker(topLevelWorker, buf, event.data.offset, {"context": "unknown"});
          });
          topLevelReaderStarted = true;
        }
      } else if (event.data.action === "done") {
        workerOffsets.push({
                              "workerNum": i,
                              "offsetStart": event.data.offset,
                              "offsetFinish": event.data.offset + event.data.size,
                              "symbolTables": event.data.symbolTables,
                              "symbolsToAdd": event.data.symbolsToAdd,
                              "processed": false
                            });

        stats.combineStats(event.data.stats);

        let currentPointer = 0;
        while (currentPointer !== workerOffsets.length) {
          if (workerOffsets[currentPointer].offsetStart === lastProcessed) {
            // add symbol tables
            for (let j = 0; j < event.data.symbolTables.length; ++j) {
              if (event.data.symbolTables[j].append === false) {
                addSymbolTable(event.data.symbolTables[j]);
              }
              stats.addSymbolTable(event.data.symbolTables[j]);
            }

            // add symbols
            let symbolsToAdd = workerOffsets[currentPointer].symbolsToAdd;
            
            for (let j = 0; j < symbolsToAdd.length; ++j) {
              let symbolTable = getSymbolTable(symbolsToAdd[j].position+workerOffsets[currentPointer].offsetStart);
              if (symbolTable !== null) {
                let symbolID = symbolTable.addSymbol(symbolsToAdd[j].symbolString, 
                                                    symbolsToAdd[j].position+workerOffsets[currentPointer].offsetStart);
              } else {
                // TODO: ERROR - no symbol table
              }
            }

            // add symbol usages

            //let symbolUsages = workerOffsets[currentPointer].symbolUsages;
            //for (let j = 0; j < symbolUsages; ++j) {

            //}

            // clear arrays and set processed
            workerOffsets[currentPointer].symbolTables = null;
            workerOffsets[currentPointer].symbolsToAdd = null;
            workerOffsets[currentPointer].processed = true;

            lastProcessed = workerOffsets[currentPointer].offsetFinish;
            currentPointer = 0;
          } else {
            currentPointer++;
          }
        }

        let symbols = [];
        let offsets = [];
        let uses = [];
        for (let i = 0; i < symbolTables.length; ++i) {
          symbols.push(symbolTables[i].table.symbols);
          offsets.push(symbolTables[i].table.meta);
          uses.push(symbolTables[i].table.usageCounts);
        }
        postMessage({'action': 'workerReaderFinishedBuffer', 'offset': event.data.offset, 'size': event.data.size,
                     'stats': stats.stats, 'symbolTables': symbols, 'symbolOffsets': offsets, 'symbolUses': uses });

        availableWorkers.push(self);
        checkReaderWorkers();
      } else if (event.data.action === "nibbles") {
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
    let context;
    if (offsetToStart !== undefined && buffer !== undefined) {
      readerWorker = availableWorkers.shift();
      sliceOffset = readerSliceOffsets.shift(); 
      if (sliceOffset !== offsetToStart) {
        throw new Error(`worker-coordinator: expected sliceOffset ${sliceOffset} to equal offsetToStart ${offsetToStart}`);
      }
      context = contextForOffset(sliceOffset);
      sendBufferToWorker(readerWorker, buffer, sliceOffset, {'context': context});
    } else if (bsr.isReady === true) {
      readerWorker = availableWorkers.shift();
      sliceOffset = readerSliceOffsets.shift();
      context = contextForOffset(sliceOffset);
      // set the buffer size to the exact size between top level values
      let exactSize;
      if (readerSliceOffsets.length > 0) {
        exactSize = readerSliceOffsets[0] - sliceOffset;
      } else {
        exactSize = fileStats - sliceOffset;
      }
      if (exactSize < 0) {
        throw new Error(`worker-coordinator: checkReaderWorkers buffer size is ${exactSize}`);
      }
      if (exactSize > BYTES_TO_BUFFER) {
        throw new Error(`worker-coordinator: checkReaderWorkers buffer size is ${exactSize}`);
      }
      bsr.setBufferSize(exactSize);
      console.log(`## ${sliceOffset} + ${exactSize} = ${sliceOffset+exactSize}`);
      bsr.fillBuffer(4, sliceOffset).then(value => {
        let buf = bsr.biBuffer;
        let options = {
          'inspect': false,
          'suppressSymbolTables': false,
          'context': context
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
      readerSliceOffsets = [];
      workerOffsets = [];
      lastProcessed = 0;
      t0 = performance.now();
      topLevelReaderStarted = false;
      topLevelReaderDone = false;
      let file = event.data.file;
      fileStats = bsr.loadFile(file);
      bsr_toplevel.loadFile(file);
      readingFinished = false;
    
      bsr.readerOnLoadEndCallback = callbackCheckReaderWorkers;
    
      // notify the main thread of the size of the file
      postMessage({'action': 'loaded', 'fileStats': fileStats});

      bsr_toplevel.setBufferSize(bytesToBuffer);
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
      let nearestOffsetIndex = findNearestTopLevelOffset(event.data.offset);
      if (availableWorkers.length === 0) {
        console.log(`worker-coordinator: no readerWorkers available.`);
        break;
      }
      if (bsr.isReady === false) {
        throw new Error(`worker-coordinator: exploreBinary - bsr.isReady === false`);
      }
      bsr.setBufferSize(INSPECT_BYTES_TO_BUFFER);
      bsr.fillBuffer(4, nearestOffsetIndex).then(value => {
        let buf = bsr.biBuffer;
        let readerWorker = availableWorkers.shift();
        let options = {
          'inspect': true,
          'suppressSymbolTables': true,
          'context': contextForOffset(nearestOffsetIndex)
        };
        sendBufferToWorker(readerWorker, buf, nearestOffsetIndex, options);
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