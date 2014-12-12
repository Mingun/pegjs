"use strict";

let GrammarError = require("../../grammar-error");
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
function reportInfiniteRecursion(ast) {
  let visitedRules = [];

  // Each visitor function returns |true|, if some input will be consumed in any case,
  // and |false| otherwize. In last case left recursion is possible.
  function notAlwaysConsume() { return false; }
  function visitExpressionAndNotAlwaysConsume(node) {
    alwaysConsumeSomething(node.expression);

    return false;
  }

  let alwaysConsumeSomething = visitor.build({
    rule(node) {
      visitedRules.push(node.name);
      let result = alwaysConsumeSomething(node.expression);
      visitedRules.pop();

      return result;
    },
    choice(node) {
      if (node.alternatives.length > 0) {
        // If all alternatives consume some input, than, if has any alternative,
        // |choice| consume input.
        return node.alternatives.every(alwaysConsumeSomething);
      }

      return false;
    },
    sequence(node) {
      return node.elements.some(alwaysConsumeSomething);
    },
    simple_and:   visitExpressionAndNotAlwaysConsume,
    simple_not:   visitExpressionAndNotAlwaysConsume,
    optional:     visitExpressionAndNotAlwaysConsume,
    zero_or_more: visitExpressionAndNotAlwaysConsume,
    semantic_and: notAlwaysConsume,
    semantic_not: notAlwaysConsume,
    rule_ref(node) {
      if (visitedRules.indexOf(node.name) >= 0) {
        visitedRules.push(node.name);

        throw new GrammarError(
          "Possible infinite loop when parsing (left recursion: "
            + visitedRules.join(" -> ")
            + ").",
          node.location
        );
      }

      return alwaysConsumeSomething(asts.findRule(ast, node.name));
    },
    literal(n) { return n.value.length > 0; },
    class(n)   { return n.parts.length > 0; },
    any()      { return true; }
  });

  alwaysConsumeSomething(ast);
}

module.exports = reportInfiniteRecursion;
