"use strict";

var arrays  = require("../../utils/arrays"),
    asts    = require("../asts"),
    visitor = require("../visitor");

/*
 * Reports left recursion in the grammar, which prevents infinite recursion in
 * the generated parser.
 *
 * Both direct and indirect recursion is detected. The pass also correctly
 * reports cases like this:
 *
 *   start = "a"? start
 *
 * In general, if a rule reference can be reached without consuming any input,
 * it can lead to left recursion.
 */
function reportLeftRecursion(ast, options) {
  var emitError = options.collector.emitError,
      visitedRules = [];

  var check = visitor.build({
    rule: function(node) {
      visitedRules.push(node.name);
      check(node.expression);
      visitedRules.pop(node.name);
    },

    sequence: function(node) {
      arrays.every(node.elements, function(element) {
        check(element);

        return !asts.alwaysConsumesOnSuccess(ast, element);
      });
    },

    rule_ref: function(node) {
      if (arrays.contains(visitedRules, node.name)) {
        visitedRules.push(node.name);

        emitError(
          "Possible left recursion detected ("
            + visitedRules.join(" -> ")
            + ").",
          node.location
        );
      } else {
        // As |collector.emitError| isn't obliged to throw an exception,
        // there are no warranties that the rule exists (pass |report-missing-rules|
        // use this function to report problem).
        var rule = asts.findRule(ast, node.name);
        if (rule) {
          check(rule);
        }
      }
    }
  });

  check(ast);
}

module.exports = reportLeftRecursion;
