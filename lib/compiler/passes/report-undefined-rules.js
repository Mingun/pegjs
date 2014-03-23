"use strict";

let asts = require("../asts");
let visitor = require("../visitor");

// Checks that all referenced rules exist.
function reportUndefinedRules(ast, options) {
  let emitError = options.collector.emitError;
  let check = visitor.build({
    rule_ref(node) {
      if (!asts.findRule(ast, node.name)) {
        emitError(
          "Rule \"" + node.name + "\" is not defined.",
          node.location
        );
      }
    }
  });

  check(ast);

  options.allowedStartRules.forEach(rule => {
    if (!asts.findRule(ast, rule)) {
      emitError("Start rule \"" + rule + "\" is not defined.");
    }
  });
}

module.exports = reportUndefinedRules;
