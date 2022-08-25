'use strict';

/**
 * An ElementReference contains the structural information about an element.
 * The structure of an ElementReference is as follows:  
 * 0 - the offset in the stream for the current part of the stream  
 * 1 - the relative offset beyond the start of the current part of the stream  
 * 2 - the depth of the element  
 * 3 - the number of bytes remaining at this depth  
 * 4 - the absolute offset in the stream of the container  
 * 5 - the type of the container  
 * 6 - the absolute offset in the stream of the next element  
 * Note: createElementReference does not require all of the parameters to be set.
 * 
 * @param {Number} streamOffset (uint)
 * @param {Number} relativeOffset (uint)
 * @param {Number} depth (uint)
 * @param {Number} bytesRemainingAtDepth (uint)
 * @param {Number} absoluteContainerOffset (uint)
 * @param {IonType} containerType 
 * @param {Number} absoluteNextOffset (uint)
 * @returns {ElementReference} An Element Reference array initialized to the parameters passed in.
 */
function createElementReference(streamOffset, relativeOffset, depth, bytesRemainingAtDepth, absoluteContainerOffset,
                                containerType, absoluteNextOffset) {
  return [streamOffset,
          relativeOffset,
          depth,
          bytesRemainingAtDepth,
          absoluteContainerOffset,
          containerType,
          absoluteNextOffset ];
}

/**
 * Checks if the parameter passed in is an ElementReference.
 * 
 * @param {ElementReference} elementReference 
 * @returns {Boolean} returns true if the passed in parameter is an ElementReference array, false otherwise.
 */
function isElementReference(elementReference) {
  if (Array.isArray(elementReference) && elementReference.length === 7) {
    return true;
  }
  return false;
}

/**
 * Calculates and returns the next element from the passed in ElementReference.
 * 
 * @param {ElementReference} elementReference  
 * @throws {Error} when absolute next offset is less than or equal to the stream offset + relative offset
 * @returns {ElementReference} 
 * - `ElementReference` to the next element
 * - `undefined` or `null` if there is no next element
 */
function nextElementReference(elementReference) {
  if (elementReference[6] === undefined || elementReference[6] === null) {
    return elementReference[6];
  }

  if (elementReference[6] <= (elementReference[0]+elementReference[1])) {
    const err = new Error(`ElementReference nextElementReference absolute next offset (${elementReference[6]}) <= stream offset + relative offset (${elementReference[0]} + ${elementReference[1]})`);
    throw err;
  }

  // next ElementReference:
  //      fileOffset,          relativeOffset (nextOffset - fileOffset),  depth,
  return [elementReference[0], elementReference[6] - elementReference[0], elementReference[2],
  //      bytesRemainingAtDepth (bytesRemainingAtDepth - (nextOffset-relativeOffset-fileOffset)),
          elementReference[3] - (elementReference[6]-elementReference[1]-elementReference[0]),
  //      containerOffset,     containerType,       nextOffset
          elementReference[4], elementReference[5], undefined];
}

/**
 * Calculates and returns the absolute offset of the passed in ElementReference.
 * 
 * @param {ElementReference} elementReference 
 * @returns {Number}
 */
function absoluteOffset(elementReference) {
  //     fileOffset + relativeOffset
  return elementReference[0] + elementReference[1];
}

exports.createElementReference = createElementReference;
exports.isElementReference = isElementReference;
exports.nextElementReference = nextElementReference;
exports.absoluteOffset = absoluteOffset;