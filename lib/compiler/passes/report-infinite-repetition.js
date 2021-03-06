"use strict";

let asts = require("../asts");
let visitor = require("../visitor");

// Reports expressions that don't consume any input inside |*|, |+| or range in the
// grammar, which prevents infinite loops in the generated parser.
function reportInfiniteRepetition(ast, options) {
  let emitError   = options.collector.emitError;
  let emitWarning = options.collector.emitWarning;
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
    },

    range(node) {
      if (asts.alwaysConsumesOnSuccess(ast, node.expression)
       || node.delimiter && asts.alwaysConsumesOnSuccess(ast, node.delimiter)
      ) {
        return;
      }
      if (node.max.value === null) {
        emitError(
          "Possible infinite loop when parsing (unbounded range repetition used with an expression that may not consume any input).",
          node.location
        );
      } else {
        emitWarning(
          node.min.constant && node.max.constant
            ? "This expression always matched with maximum repetition count, because expression not consume any input."
            : "This expression when matched always matched with maximum repetition count, because expression not consume any input.",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportInfiniteRepetition;
