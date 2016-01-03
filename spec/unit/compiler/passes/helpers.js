/* jshint jasmine:true */
/* global PEG */

"use strict";

beforeEach(function() {
  function Err(message, location) {
    this.message = message;
    this.location = location;
  }

  var errorCollector = {
    emitFatalError: function(message, location) {
      throw new Err(message, location);
    },
    emitError: function(message, location) {
      throw new Err(message, location);
    },
    emitWarning: function() {},
    emitInfo: function() {}
  };
  var warningCollector = {
    emitFatalError: function(message, location) {},
    emitError: function(message, location) {},
    emitWarning: function(message, location) {
      throw new Err(message, location);
    },
    emitInfo: function() {}
  };

  function createMatcher(name, collector) {
    return function(grammar, details, options) {
      var ast = PEG.parser.parse(grammar);
      options = options || {};
      options.collector = collector;

      try {
        this.actual(ast, options);

        this.message = function() {
          return "Expected the pass "
               + "with options " + jasmine.pp(options) + " "
               + "to report " + name + " "
               + (details ? "with details " + jasmine.pp(details) + " ": "")
               + "for grammar " + jasmine.pp(grammar) + ", "
               + "but it didn't.";
        };

        return false;
      } catch (e) {
        /*
         * Should be at the top level but then JSHint complains about bad for
         * in variable.
         */
        var key;

        if (this.isNot) {
          this.message = function() {
            return "Expected the pass "
                 + "with options " + jasmine.pp(options) + " "
                 + "not to report " + name + " "
                 + "for grammar " + jasmine.pp(grammar) + ", "
                 + "but it did: " + jasmine.pp(e.message) + ".";
          };
        } else {
          if (details) {
            for (key in details) {
              if (details.hasOwnProperty(key)) {
                if (!this.env.equals_(e[key], details[key])) {
                  this.message = function() {
                    return "Expected the pass "
                         + "with options " + jasmine.pp(options) + " "
                         + "to report " + name + " "
                         + "with details " + jasmine.pp(details) + " "
                         + "for grammar " + jasmine.pp(grammar) + ", "
                         + "but " + jasmine.pp(key) + " "
                         + "is " + jasmine.pp(e[key]) + ".";
                  };

                  return false;
                }
              }
            }
          }
        }

        return true;
      }
    }
  }

  this.addMatchers({
    toChangeAST: function(grammar) {
      function matchDetails(value, details) {
        function isArray(value) {
          return Object.prototype.toString.apply(value) === "[object Array]";
        }

        function isObject(value) {
          return value !== null && typeof value === "object";
        }

        var i, key;

        if (isArray(details)) {
          if (!isArray(value)) { return false; }

          if (value.length !== details.length) { return false; }
          for (i = 0; i < details.length; i++) {
            if (!matchDetails(value[i], details[i])) { return false; }
          }

          return true;
        } else if (isObject(details)) {
          if (!isObject(value)) { return false; }

          for (key in details) {
            if (details.hasOwnProperty(key)) {
              if (!(key in value)) { return false; }

              if (!matchDetails(value[key], details[key])) { return false; }
            }
          }

          return true;
        } else {
          return value === details;
        }
      }

      var options = arguments.length > 2 ? arguments[1] : {},
          details = arguments[arguments.length - 1],
          ast     = PEG.parser.parse(grammar);

      options.collector = errorCollector;
      this.actual(ast, options);

      this.message = function() {
        return "Expected the pass "
             + "with options " + jasmine.pp(options) + " "
             + (this.isNot ? "not " : "")
             + "to change the AST " + jasmine.pp(ast) + " "
             + "to match " + jasmine.pp(details) + ", "
             + "but it " + (this.isNot ? "did" : "didn't") + ".";
      };

      return matchDetails(ast, details);
    },

    toReportError:   createMatcher('an error',  errorCollector),
    toReportWarning: createMatcher('a warning', warningCollector)
  });
});
