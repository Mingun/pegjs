"use strict";

let visitor = require("../visitor");

function ruleRef2ParamRef(ast) {
  let convert = visitor.build({
    rule(node) {
      convert(node.expression, node);
    },

    rule_ref(node, ownerRule) {
      // This is template parameter reference
      if (ownerRule.params.indexOf(node.name) >= 0) {
        node.type = "param_ref";
      }
    }
  });

  convert(ast);
}

module.exports = ruleRef2ParamRef;
