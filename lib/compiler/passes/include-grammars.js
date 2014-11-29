"use strict";

let GrammarError = require("../../grammar-error");
let Resolver     = require("../resolver");
let visitor      = require("../visitor");

// Include one grammar to another recursively. Cyclic includes not supported.
function includeGrammars(ast, options) {
  options = Object.assign({}, options, { output: "ast" });
  let resolver = options.resolver || new Resolver();

  function doInclude(ast, aliases) {
    // Mapping from alias to default rule of imported grammar
    let defaultRules = {};
    // Arrays with initializers and rules from all imported grammars in order of import
    let initializers = [];
    let rules = [];

    function appendFrom(ast) {
      if (ast.initializers) {
        Array.prototype.push.apply(initializers, ast.initializers);
      }
      Array.prototype.push.apply(rules, ast.rules);
    }

    function fixCode(node, prefix) {
      if (node.namespace) {
        prefix = prefix.concat(node.namespace);
      }
      node.namespace = prefix.join(".");
      if (node.expression) {
        renameRulesAndNamespaces(node.expression, prefix);
      }
    }
    // Append to each rule name prefix and rename
    // namespaces of code for eliminate collisions
    let renameRulesAndNamespaces = visitor.build({
      initializer:  fixCode,
      action:       fixCode,
      semantic_and: fixCode,
      semantic_not: fixCode,

      rule(node, prefix) {
        node.name = prefix.concat(node.name).join("$");
        renameRulesAndNamespaces(node.expression, prefix);
      },
      rule_ref(node, prefix) {
        let name = node.name;
        // If referred rule not from this grammar.
        if (node.namespace) {
          // If |name| not set, use default rule of grammar
          name = name || defaultRules[node.namespace];
          prefix = prefix.concat(node.namespace);

          // Make rule be part of this grammar -- for preventing of repeated processing.
          node.namespace = null;
        }
        if (!name) {
          throw new GrammarError("Cann't determine referenced node name", node.location);
        }
        node.name = prefix.concat(name).join("$");
      }
    });
    let include = visitor.build({
      grammar(node) {
        if (node.imports) {
          // Fill |rules| and |initializers| arrays
          node.imports.forEach(include);
          // Mark that all imports resolved.
          node.imports.length = 0;
        }

        renameRulesAndNamespaces(node, aliases);

        // Append included rules and initializers first -- this need for generating action functions
        // and initializers call in correct order.
        appendFrom(node);

        // Update AST
        node.initializers = initializers;
        node.rules = rules;
      },
      import(node) {
        let importedAst = resolver.resolve(node.path, node.alias, options);

        if (importedAst.rules.length > 0) {
          // Resolve default names before they changed in |doInclude|
          defaultRules[node.alias] = importedAst.rules[0].name;
        }

        doInclude(importedAst, aliases.concat(node.alias));

        appendFrom(importedAst);
        if (resolver.done) {
          resolver.done(node.path, node.alias, options);
        }
      }
    });

    include(ast);
  }
  doInclude(ast, []);
}

module.exports = includeGrammars;
