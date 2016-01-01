"use strict";

let GrammarError = require("../../grammar-error");
let asts         = require("../asts");
let visitor      = require("../visitor");

function checkTemplateArgs(ast) {
  let check = visitor.build({
    rule(node) {
      check(node.expression, node);
    },

    rule_ref(node, ownerRule) {
      let rule = asts.findRule(ast, node.name);
      if (rule.params.length !== node.args.length) {
        throw new GrammarError(
          "Insufficient count of template arguments for rule \"" + node.name + "\". Expected "
            + rule.params.length + ", found " + node.args.length,
          node.location
        );
      }
      node.args.forEach(n => check(n, ownerRule));
    },

    param_ref(node, ownerRule) {
      // Parameters cann't have arguments
      if (node.args.length !== 0) {
        throw new GrammarError(
          "Template paramater \"" + node.name + "\" of rule \"" + ownerRule.name + "\" can't accept template arguments",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = checkTemplateArgs;
