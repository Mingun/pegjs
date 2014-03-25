"use strict";

var visitor = require("../visitor"),
    arrays  = require("../../utils/arrays");

/* Checks that all rules referenced by another. */
var reportUnusedRules = function(ast, options) {
  var emitWarning = options.collector.emitWarning;

  var used = {};

  var check = visitor.build({
    grammar:  function(node) {
      if (options.allowedStartRules) {
        arrays.each(options.allowedStartRules, function(name) {
          used[name] = true;
        });
      }
      arrays.each(node.rules, check);

      arrays.each(node.rules, function(rule) {
        if (!used[rule.name]) {
          emitWarning(
            'Rule "' + rule.name + '" not used.',
            rule.location
          );
        }
      });
    },
    rule_ref: function(node) { used[node.name] = true; },
  });

  check(ast);
};

module.exports = reportUnusedRules;
