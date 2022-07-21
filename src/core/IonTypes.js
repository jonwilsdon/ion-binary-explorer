'use strict';

/**
 * All of the Ion types plus internal tyoes.
 */
const IonTypes = {
  "null": 0,
  "bool": 1,
  "int+": 2,
  "int-": 3,
  "float": 4,
  "decimal": 5,
  "timestamp": 6,
  "symbol": 7,
  "string": 8,
  "clob": 9,
  "blob": 10,
  "list": 11,
  "sexp": 12,
  "struct": 13,
  "annotation": 14,
  "reserved": 15,
  "bvm": 16,
  "nop": 17,
  "numTypes": 18,

  /**
   * Returns whether the specified type is a container type
   * 
   * @param {Number} type 
   * @returns {Boolean}
   */
  isContainer: function (type) {
    return (type === this["list"] || type === this["sexp"] || type === this["struct"]) ? true : false;
  },
  /**
   * Returns whether the specified type is a scalar type
   * 
   * @param {Number} type 
   * @returns {Boolean}
   */
  isScalar: function (type) {
    return (type === this["null"] || type === this["bool"] || type === this["int+"] || type === this["int-"] ||
            type === this["float"] || type === this["decimal"] || type === this["timestamp"] || 
            type === this["symbol"] || type === this["string"] || type === this["clob"] || type === this["blob"]
           ) ? true : false;
  },
  /**
   * Returns the name of the specified type
   * 
   * @param {Number} type 
   * @returns {String}
   */
  nameFromType: function (type) {
    return IonTypesReverse[type];
  }
};

/**
 * A reverse mapping of the IonTypes defined above.
 * ie. IonTypesReverse[0] = "null"
 */
const IonTypesReverse = new Array(IonTypes["numTypes"]);
for (let [key, value] of Object.entries(IonTypes)) {
  if (key === "numTypes") { continue; }
  IonTypesReverse[value] = key;
}

exports.IonTypes = IonTypes;