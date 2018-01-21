"use strict";

let visitor = require("../visitor");

// Checks that each label is defined only once within each scope.
function reportAmbiguousLabels(ast, options) {
  let emitError = options.collector.emitError;

  function scope(node) {
    check(node.expression);
  }

  let check = visitor.build({
    choice(node) {
      node.alternatives.forEach(alternative => check(alternative));
    },

    action(node) {
      check(node.expression, node);
    },

    labeled(node, action) {
      check(node.expression);

      if (node.auto && action) {
        let label = node.label ? `"${node.label}" ` : "";

        emitError(
          `Automatic label ${label}can not be used together with an action.`,
          node.location
        );
      }
    },

    text: scope,
    simple_and: scope,
    simple_not: scope,
    optional: scope,
    zero_or_more: scope,
    one_or_more: scope,
    range(node) {
      if (node.delimiter) {
        check(node.delimiter);
      }
      check(node.expression);
    },
    group: scope
  });

  check(ast);
}

module.exports = reportAmbiguousLabels;
