"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../lib/compiler/passes/include-grammars");
let Resolver = require("../../../../lib/compiler/resolver.js");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |includeGrammars|", function() {
  describe("add rules from imported grammar to grammar AST", function() {
    let options = {
      resolver: new Resolver(function() {
        return {
          path: "",
          data: [
            "rule1 = 'a'",
            "rule2 = 'b'",
            "rule3 = 'c'"
          ].join("\n")
        };
      })
    };
    it("with default rule ref", function() {
      expect(pass).to.changeAST(
        [
          "#inc = ''",
          "start = #inc"
        ].join("\n"),
        {
          rules: [
            {
              name:       "inc$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "inc$rule3",
              expression: { type: "literal", value: "c" }
            },
            {
              name:       "start",
              expression: { type: "rule_ref", namespace: null, name: "inc$rule1" }
            }
          ]
        },
        options
      );
    });
    it("with explicit specified rule ref", function() {
      expect(pass).to.changeAST(
        [
          "#inc = ''",
          "start = #inc:rule2"
        ].join("\n"),
        {
          rules: [
            {
              name:       "inc$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "inc$rule3",
              expression: { type: "literal", value: "c" }
            },
            {
              name:       "start",
              expression: { type: "rule_ref", namespace: null, name: "inc$rule2" }
            }
          ]
        },
        options
      );
    });
  });

  describe("allow import one grammar multiply times with distinct aliases", function() {
    it("with default rule ref", function() {
      expect(pass).to.changeAST(
        [
          "#inc1 = ''",
          "#inc2 = ''",
          "start = #inc1 #inc2"
        ].join("\n"),
        {
          rules: [
            {
              name:       "inc1$rule",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc2$rule",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "start",
              expression: {
                elements: [
                  { type: "rule_ref", namespace: null, name: "inc1$rule" },
                  { type: "rule_ref", namespace: null, name: "inc2$rule" }
                ]
              }
            }
          ]
        },
        { resolver: new Resolver(function() { return { path: "", data: "rule = 'a'" }; }) }
      );
    });
    it("with explicit specified rule ref", function() {
      expect(pass).to.changeAST(
        [
          "#inc1 = ''",
          "#inc2 = ''",
          "start = #inc1:rule1 #inc2:rule2"
        ].join("\n"),
        {
          rules: [
            {
              name:       "inc1$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc1$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "inc2$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc2$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "start",
              expression: {
                elements: [
                  { type: "rule_ref", namespace: null, name: "inc1$rule1" },
                  { type: "rule_ref", namespace: null, name: "inc2$rule2" }
                ]
              }
            }
          ]
        },
        { resolver: new Resolver(function() { return { path: "", data: "rule1 = 'a';rule2 = 'b'" }; }) }
      );
    });
  });

  describe("recursive include rules from included grammars", function() {
    let options = {
      resolver: new Resolver(function(ast, importNode) {
        return {
          path: importNode.path,
          data: [
            path.length === 0 ? "#inc = 'second'" : "",
            "rule1 = 'a'",
            "rule2 = 'b'"
          ].join("\n")
        };
      })
    };
    it("with default rule ref", function() {
      expect(pass).to.changeAST(
        [
          "#inc = ''",
          "start = #inc"
        ].join("\n"),
        {
          rules: [
            {
              name:       "inc$inc$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc$inc$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "inc$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "start",
              expression: { type: "rule_ref", namespace: null, name: "inc$rule1" }
            }
          ]
        },
        options
      );
    });
    it("with explicit specified rule ref", function() {
      expect(pass).to.changeAST(
        [
          "#inc = ''",
          "start = #inc:rule2"
        ].join("\n"),
        {
          rules: [
            {
              name:       "inc$inc$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc$inc$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "inc$rule1",
              expression: { type: "literal", value: "a" }
            },
            {
              name:       "inc$rule2",
              expression: { type: "literal", value: "b" }
            },
            {
              name:       "start",
              expression: { type: "rule_ref", namespace: null, name: "inc$rule2" }
            }
          ]
        },
        options
      );
    });
  });
});
