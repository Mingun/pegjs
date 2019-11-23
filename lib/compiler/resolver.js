"use strict";

let GrammarError = require("../grammar-error");
let parser       = require("../parser");

let imported = [];

function Resolver(...args) {
  if (args.length > 0) {
    let read = args[0];
    if (typeof read !== "function") {
      throw new GrammarError(
        "Expected function for Resolver argument, but got " + (typeof read)
      );
    }
    this.read = read;
  }
}

Resolver.prototype = {
  read(ast, importNode) {
    let path = require("path");
    let basePath = path.dirname(ast.location.source.path);
    let fullPath = path.resolve(basePath, importNode.path);

    return {
      path: fullPath,
      data: require("fs").readFileSync(fullPath, "utf-8")
    };
  },
  resolve(ast, importNode, options) {
    let source = this.read(ast, importNode, options);
    let has = imported.find(e => e.path === source.path);
    imported.push({ path: source.path, alias: importNode.alias });
    if (has) {
      let message = imported.map(e => e.path + ' as "' + e.alias + '"');
      throw new GrammarError(
        "Cyclic include dependence for included grammars!:\n"
        + message.join("\n")
      );
    }

    return parser.parse(source.data, Object.assign({}, options, { source }));
  },
  done() {
    imported.pop();
  }
};

module.exports = Resolver;
