"use strict";

let asts = require("../asts");
let visitor = require("../visitor");

// Reports expressions that don't consume any input inside |*| or |+| in the
// grammar, which prevents infinite loops in the generated parser.
function reportInfiniteRepetition(ast, options) {
  let emitError = options.collector.emitError;
  let check = visitor.build({
    zero_or_more(node) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        emitError(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        );
      }
    },

    one_or_more(node) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        emitError(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportInfiniteRepetition;
