"use strict";

/* Object utilities. */
var objects = {
  keys: function(object) {
    var result = [], key;

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        result.push(key);
      }
    }

    return result;
  },

  values: function(object) {
    var result = [], key;

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        result.push(object[key]);
      }
    }

    return result;
  },

  clone: function(object) {
    var result = {}, key;

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        result[key] = object[key];
      }
    }

    return result;
  },

  defaults: function(object, defaults) {
    var key;

    for (key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        if (!(key in object)) {
          object[key] = defaults[key];
        }
      }
    }
  },

  // http://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
  construct: function(constructor, args) {
    function F() {
      return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
  }
};

module.exports = objects;
