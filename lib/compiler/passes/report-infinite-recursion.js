"use strict";

let asts = require("../asts");
let visitor = require("../visitor");

// Reports left recursion in the grammar, which prevents infinite recursion in
// the generated parser.
//
// Both direct and indirect recursion is detected. The pass also correctly
// reports cases like this:
//
//   start = "a"? start
//
// In general, if a rule reference can be reached without consuming any input,
// it can lead to left recursion.
function reportInfiniteRecursion(ast, options) {
  let emitError = options.collector.emitError;
  let visitedRules = [];

  let check = visitor.build({
    rule(node) {
      visitedRules.push(node.name);
      check(node.expression);
      visitedRules.pop(node.name);
    },

    sequence(node) {
      node.elements.every(element => {
        check(element);

        return !asts.alwaysConsumesOnSuccess(ast, element);
      });
    },

    range(node) {
      check(node.expression);

      if (node.delimiter !== null && !asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        check(node.delimiter);
      }
    },

    rule_ref(node) {
      // Check left recursion only for rules, defined in this grammar.
      // Left recursion via imported rules is impossible, because cyclic
      // dependencies is forbidden.
      if (node.namespace) {
        return;
      }

      if (visitedRules.indexOf(node.name) !== -1) {
        visitedRules.push(node.name);

        emitError(
          "Possible infinite loop when parsing (left recursion: "
            + visitedRules.join(" -> ")
            + ").",
          node.location
        );
      } else {
        // As |collector.emitError| isn't obliged to throw an exception,
        // there are no warranties that the rule exists (pass |report-undefined-rules|
        // use this function to report problem).
        let rule = asts.findRule(ast, node.name);
        if (rule) {
          check(rule);
        }
      }
    }
  });

  check(ast);
}

module.exports = reportInfiniteRecursion;
