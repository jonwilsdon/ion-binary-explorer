'use strict';

const br = require('./ByteReader');

/**
 * Reads bytes from a buffer.
 * Extends ByteReader interface.
 */
class ByteBufferReader extends br.ByteReader {

  #sourceBuffer = null;
  #uint8Buffer = null;

  /**
   * The current position to read from in the buffer
   */
  #positionInBuffer = 0;
  
  constructor () {
    super();
  }

  /**
   * Loads a buffer into the ByteBufferReader.
   * 
   * @param {ArrayBuffer | Uint8Array} buffer
   * @throws Error if the buffer does not exist.
   * @returns {Number} the number of bytes in the buffer
   */
  loadBuffer (buffer) {
    this.#sourceBuffer = buffer;

    if (this.#sourceBuffer === null || this.#sourceBuffer === undefined) {
      // TODO: pass the error to the caller
      const err = new Error(`called with a ${this.#sourceBuffer} buffer.`);
      throw err;
    }

    if (this.#sourceBuffer instanceof ArrayBuffer) {
      this.#uint8Buffer = new Uint8Array(this.#sourceBuffer);
    } else if (this.#sourceBuffer instanceof Uint8Array) {
      this.#uint8Buffer = this.#sourceBuffer;
    } else {
      // TODO: pass the error to the caller
      const err = new Error(`ByteBufferReader loadBuffer() called with an unsupported buffer type.`);
      throw err;
    }

    return this.#uint8Buffer.length;
  }

  /**
   * Reads the nextByte from the current position in the buffer.
   * Moves the current position forward by 1 byte.
   * 
   * @returns {null | UInt8}
   * - null if the current position is currently at the end of the buffer
   * - the UInt8 at that position in the buffer
   */
  nextByte () {
    if (this.atEnd()) {
      return null;
    }

    if (typeof this.#positionInBuffer === 'bigint') {
      if (this.#positionInBuffer+1n > this.#uint8Buffer.length) {
        return null;
      }
    } else {
      if (this.#positionInBuffer+1 > this.#uint8Buffer.length) {
        return null;
      }
    }

    const byte = this.#uint8Buffer[this.#positionInBuffer];
    this.#positionInBuffer++;

    return byte;
  }

  /**
   * Skips forward the specified number of bytes.
   * Note: This function does not check if the number of bytes to skip are valid.
   * 
   * @param {Number} numBytesToSkip The number of bytes for the reader to skip over.
   */
  skipBytes (numBytesToSkip) {
    this.#positionInBuffer += numBytesToSkip;
  }

  /**
   * Sets the position in the buffer to be the byte number passed in.
   * Note: This function does not check if the position to set is valid.
   * 
   * @param {Number} positionToSet The new position to set the reader to.
   */
  setPosition (positionToSet) {
    this.#positionInBuffer = positionToSet;
  }

  /**
   * Checks if the specified position is exactly at the end of the buffer.
   * Throws an error if the position is beyond the end of the buffer.
   * @param {Number} position The position to check.
   * @returns {Boolean}
   * - true if the position is at the end of the buffer
   * - false if the position is still within the buffer
   */
  atEnd (position) {
    if (typeof position === "bigint") {
      if (position === BigInt(this.#uint8Buffer.length)) {
        return true;
      }

      if (position > BigInt(this.#uint8Buffer.length)) {
        return null;
      }
    } else {
      if (position === this.#uint8Buffer.length) {
        return true;
      }
      
      if (position > this.#uint8Buffer.length) {
        return null;
      }
    }

    return false;
  }

  /**
   * Returns a specified amount of raw bytes from the buffer at a specified offset. 
   * 
   * @param {Number} offset The offset to start from.
   * @param {Number} length The number of bytes to pull from the buffer.
   * @returns {Uint8Array}
   */
  rawBytes(offset, length) {
    return this.#uint8Buffer.slice(offset, offset+length);
  }

  /**
   * Returns the current position in the buffer
   * 
   * @returns {Number}
   */
  get positionInBuffer() {
    return this.#positionInBuffer;
  }

  /**
   * Returns the size (length) of the buffer.
   * 
   * @returns {Number}
   */
  get size() {
    return this.#uint8Buffer.length;
  }
}

exports.ByteBufferReader = ByteBufferReader;