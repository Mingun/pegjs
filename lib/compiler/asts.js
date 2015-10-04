"use strict";

let visitor = require("./visitor");

// AST utilities.
let asts = {
  findRule(ast, name) {
    for (let i = 0; i < ast.rules.length; i++) {
      if (ast.rules[i].name === name) {
        return ast.rules[i];
      }
    }

    return undefined;
  },

  indexOfRule(ast, name) {
    for (let i = 0; i < ast.rules.length; i++) {
      if (ast.rules[i].name === name) {
        return i;
      }
    }

    return -1;
  },

  alwaysConsumesOnSuccess(ast, node) {
    function consumesTrue()  { return true;  }
    function consumesFalse() { return false; }

    let consumes = visitor.build({
      choice(node) {
        return node.alternatives.every(consumes);
      },

      sequence(node) {
        return node.elements.some(consumes);
      },

      simple_and: consumesFalse,
      simple_not: consumesFalse,
      optional: consumesFalse,
      zero_or_more: consumesFalse,
      range(node) {
        // If minumum not restricted then range always match empty input and may consume nothing
        if (!node.min.constant || node.min.value === 0) {
          return false;
        }
        if (consumes(node.expression)) {
          return true;
        }
        // |node.delimiter| used only when |node.expression| match at least two times
        // In the first if variable minimums will be filtered, so in this place |value| always constant
        if (node.min.value > 1 && node.delimiter && consumes(node.delimiter)) {
          return true;
        }
        return false;
      },
      semantic_and: consumesFalse,
      semantic_not: consumesFalse,

      rule_ref(node) {
        return consumes(asts.findRule(ast, node.name));
      },

      literal(node) {
        return node.value !== "";
      },

      class: consumesTrue,
      any: consumesTrue
    });

    return consumes(node);
  }
};

module.exports = asts;
