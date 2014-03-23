"use strict";

let visitor = require("../visitor");

// Checks that each rule is defined only once.
function reportDuplicateRules(ast, options) {
  let emitError = options.collector.emitError;
  let rules = {};

  let check = visitor.build({
    rule(node) {
      if (Object.prototype.hasOwnProperty.call(rules, node.name)) {
        emitError(
          "Rule \"" + node.name + "\" is already defined "
            + "at line " + rules[node.name].start.line + ", "
            + "column " + rules[node.name].start.column + ".",
          node.location
        );
      }

      rules[node.name] = node.location;
    }
  });

  check(ast);
}

module.exports = reportDuplicateRules;
