const { assert } = require('chai');
const er = require("../../src/core/ElementReference");

describe('ElementReference', function() {
  describe("createElementReference()", function () {
    it('should return an array with the element reference properties', function() {
      let ref = er.createElementReference();
      const refEmpty = [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined ];
      assert.deepEqual(ref, refEmpty);
      ref = er.createElementReference(0, 1, 2, 3, 4, 5, 6);
      const refNotEmpty = [
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ];
      assert.deepEqual(ref, refNotEmpty);
    });
  });
  describe("isElementReference()", function () {
    it('should return false for non element references', function() {
      const refEmptyObject = {};
      assert.isFalse(er.isElementReference(refEmptyObject));
      const refNumber = 4;
      assert.isFalse(er.isElementReference(refNumber));
      const refEmptyArray = [];
      assert.isFalse(er.isElementReference(refEmptyArray));
      const refArrayWith3Elements = [0, 1, 2];
      assert.isFalse(er.isElementReference(refArrayWith3Elements));
      const refArrayWith6Elements = [0, 1, 2, 3, 4, 5];
      assert.isFalse(er.isElementReference(refArrayWith6Elements));
      const refArrayWith8Elements = [0, 1, 2, 3, 4, 5, 6, 7];
      assert.isFalse(er.isElementReference(refArrayWith8Elements));
    });
    it('should return true for element references', function () {
      const refHandCraftedUndefined = [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      ];
      const refHandCraftedNumbers = [
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ];
      const refHelperCreatedUndefined = er.createElementReference();
      const refHelperCreatedPartial = er.createElementReference(0, 1, 2);
      const refHelperCreatedComplete = er.createElementReference(0, 1, 2, 3, 4, 5, 6);
      assert.isTrue(er.isElementReference(refHandCraftedUndefined));
      assert.isTrue(er.isElementReference(refHandCraftedNumbers));
      assert.isTrue(er.isElementReference(refHelperCreatedUndefined));
      assert.isTrue(er.isElementReference(refHelperCreatedPartial));
      assert.isTrue(er.isElementReference(refHelperCreatedComplete));
    });
  });
  describe("nextElementReference()", function () {
    it('should return null or undefined if there is no next element', function () {
      const refUndefined = er.createElementReference();
      const refUndefinedNext = er.createElementReference(0, 1, 2, 3, 4, 5);
      const refNullNext = er.createElementReference(0, 1, 2, 3, 4, 5, null);
      assert.deepEqual(er.nextElementReference(refUndefined), undefined);
      assert.deepEqual(er.nextElementReference(refUndefinedNext), undefined);
      assert.deepEqual(er.nextElementReference(refNullNext), null);
    });
    it('should throw if next absolute offset is at or before stream offset', function () {
      const erNextAt2Depth0 = er.createElementReference(0, 5, 0, 2, undefined, undefined, 2);
      assert.throws(() => { er.nextElementReference(erNextAt2Depth0); }, 
                          "ElementReference nextElementReference absolute next offset (2) <= stream offset + relative offset (0 + 5)" );
    });
    it('should return an ElementReference if there is a next element', function () {
      const erNextAt6Depth0 = er.createElementReference(0, 5, 0, 2, undefined, undefined, 6);
      const refNextAt6Depth0 = er.nextElementReference(erNextAt6Depth0);
      const erPos6Depth0 = [
        0, 6, 0, 1, undefined, undefined, undefined
      ];
      assert.deepEqual(refNextAt6Depth0, erPos6Depth0);
      assert.isTrue(er.isElementReference(refNextAt6Depth0));

      const erNextAt6Depth2 = er.createElementReference(123, 5, 2, 100, 80, 11, 129);
      const refNextAt6Depth2 = er.nextElementReference(erNextAt6Depth2);
      const erPos6Depth2 = [
        123, 6, 2, 99, 80, 11, undefined
      ];
      assert.deepEqual(refNextAt6Depth2, erPos6Depth2);
      assert.isTrue(er.isElementReference(refNextAt6Depth2));
    });
  });
  describe("absoluteOffset()", function () {
    it('should return a number that is the fileOffset + relativeOffset', function () {
      const erOffset5 = er.createElementReference(0, 5, undefined, undefined, undefined, undefined, undefined);
      assert.strictEqual(er.absoluteOffset(erOffset5), 5);
      
      const erOffset128 = er.createElementReference(123, 5, undefined, undefined, undefined, undefined, undefined);
      assert.strictEqual(er.absoluteOffset(erOffset128), 128);
    });
  });
});