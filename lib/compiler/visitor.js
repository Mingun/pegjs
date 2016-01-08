"use strict";

// Simple AST node visitor builder.
let visitor = {
  build(functions) {
    function visit(node, ...args) {
      // istanbul ignore if
      if (!node) {
        throw new Error("Visitor function called with no or `null` node");
      }

      let func = functions[node.type];
      // istanbul ignore if
      if (!func) {
        throw new Error("Visitor function for node type `" + node.type + "` not defined");
      }

      return func(node, ...args);
    }

    function visitNop() {
      // Do nothing.
    }

    function visitAttributes(node, ...args) {
      if (node.attributes) {
        node.attributes.forEach(child => visit(child, ...args));
      }
    }

    function visitExpression(node, ...args) {
      visitAttributes(node, ...args);

      return visit(node.expression, ...args);
    }

    function visitChildren(property) {
      return function(node, ...args) {
        node[property].forEach(child => {
          visit(child, ...args);
        });
      };
    }

    const DEFAULT_FUNCTIONS = {
      grammar(node, ...args) {
        if (node.initializer) {
          visit(node.initializer, ...args);
        }

        node.rules.forEach(rule => visit(rule, ...args));
      },

      attribute: visitNop,
      initializer: visitAttributes,
      rule: visitExpression,
      named: visitExpression,
      choice: visitChildren("alternatives"),
      action: visitExpression,
      sequence: visitChildren("elements"),
      labeled: visitExpression,
      text: visitExpression,
      simple_and: visitExpression,
      simple_not: visitExpression,
      optional: visitExpression,
      zero_or_more: visitExpression,
      one_or_more: visitExpression,
      range(node, ...args) {
        if (node.delimiter) {
          visit(node.delimiter, ...args);
        }

        return visit(node.expression, ...args);
      },
      group: visitExpression,
      semantic_and: visitAttributes,
      semantic_not: visitAttributes,
      rule_ref: visitNop,
      literal: visitNop,
      class: visitNop,
      any: visitNop
    };

    Object.keys(DEFAULT_FUNCTIONS).forEach(type => {
      if (!Object.prototype.hasOwnProperty.call(functions, type)) {
        functions[type] = DEFAULT_FUNCTIONS[type];
      }
    });

    return visit;
  }
};

module.exports = visitor;
