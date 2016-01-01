"use strict";

let GrammarError = require("../../grammar-error");
let asts = require("../asts");
let visitor = require("../visitor");

// Reports expressions that don't consume any input inside |*| or |+| in the
// grammar, which prevents infinite loops in the generated parser.
function reportInfiniteRepetition(ast) {
  let check = visitor.build({
    rule(node, rule, args) {
      check(node.expression, node, args);
    },

    zero_or_more(node, rule, args) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression, rule, args)) {
        throw new GrammarError(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        );
      }
    },

    one_or_more(node, rule, args) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression, rule, args)) {
        throw new GrammarError(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportInfiniteRepetition;
