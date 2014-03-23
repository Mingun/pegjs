"use strict";

var arrays  = require("../../utils/arrays"),
    visitor = require("../visitor");

/*
 * Removes proxy rules -- that is, rules that only delegate to other rule.
 */
function removeProxyRules(ast, options) {
  var emitInfo = options.collector.emitInfo;

  function isProxyRule(node) {
    return node.type === "rule" && node.expression.type === "rule_ref";
  }

  function replaceRuleRefs(ast, from, to) {
    var replace = visitor.build({
      rule_ref: function(node) {
        if (node.name === from) {
          node.name = to;
          emitInfo(
            "Proxy rule " + from + " replaced to rule " + to + ".",
            node.location
          );
        }
      }
    });

    replace(ast);
  }

  var indices = [];

  arrays.each(ast.rules, function(rule, i) {
    if (isProxyRule(rule)) {
      replaceRuleRefs(ast, rule.name, rule.expression.name);
      if (!arrays.contains(options.allowedStartRules, rule.name)) {
        indices.push(i);
      }
    }
  });

  indices.reverse();

  arrays.each(indices, function(i) { ast.rules.splice(i, 1); });
}

module.exports = removeProxyRules;
