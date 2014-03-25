"use strict";

var arrays = require("../../utils/arrays");

/* Warning, if some rules redefined. */
var reportRedefinedRules = function(ast, options) {
  var emitWarning = options.collector.emitWarning;
  // Map node name to node itself.
  var names = {};
  arrays.each(ast.rules, function(rule) {
    if (names.hasOwnProperty(rule.name)) {
      emitWarning(
        'Rule "' + rule.name + '" redefined.',
        rule.location
      );
    } else {
      names[rule.name] = rule;
    }
  });
};

module.exports = reportRedefinedRules;
