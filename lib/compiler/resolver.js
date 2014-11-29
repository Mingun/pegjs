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
  read(path) {
    let fullPath = require("path").resolve(path);

    return {
      path: fullPath,
      data: require("fs").readFileSync(fullPath, "utf-8")
    };
  },
  resolve(path, alias, options) {
    let data = this.read(path, alias, options);
    let has = imported.find(e => e.path === data.path);
    imported.push({ path: data.path, alias: alias });
    if (has) {
      let message = imported.map(e => e.path + ' as "' + e.alias + '"');
      throw new GrammarError(
        "Cyclic include dependence for included grammars!:\n"
        + message.join("\n")
      );
    }

    return parser.parse(data.data, options);
  },
  done() {
    imported.pop();
  }
};

module.exports = Resolver;
