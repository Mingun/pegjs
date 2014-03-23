"use strict";

var asts    = require("../asts"),
    visitor = require("../visitor");

/* Checks that all referenced rules exist. */
function reportMissingRules(ast, options) {
  var emitError = options.collector.emitError;

  var check = visitor.build({
    rule_ref: function(node) {
      if (!asts.findRule(ast, node.name)) {
        emitError(
          "Referenced rule \"" + node.name + "\" does not exist.",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportMissingRules;
