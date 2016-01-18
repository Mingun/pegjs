"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../../lib/compiler/passes/calc-report-failures");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |calcReportFailures|", function() {
  const CASES = [
    { type: "choice",       rule: "'a' / rule2"     },
    { type: "action",       rule: "rule2 { code }"  },
    { type: "sequence",     rule: "'a' rule2"       },
    { type: "labeled",      rule: "label:rule2"     },
    { type: "text",         rule: "$rule2"          },
    { type: "simple_and",   rule: "&rule2"          },
    { type: "simple_not",   rule: "!rule2"          },
    { type: "optional",     rule: "rule2?"          },
    { type: "zero_or_more", rule: "rule2*"          },
    { type: "one_or_more",  rule: "rule2+"          },
    { type: "group",        rule: "(rule2 'a')"     },
    { type: "rule_ref",     rule: "rule2"           }
  ];

  describe("calculate |reportFailure=true|", function() {
    it("for rules listed in |allowedStartRules|", function() {
      expect(pass).to.changeAST(
        [
          "rule1 = 'a'",
          "rule2 = 'b'"
        ].join("\n"),
        {
          rules: [
            { name: "rule1", reportFailures: true  },
            { name: "rule2", reportFailures: false }
          ]
        },
        { allowedStartRules: ["rule1"] }
      );
    });

    describe("for rules referenced from rules with |reportFailure=true|", function() {
      for (let case_ of CASES) {
        it("in |" + case_.type + "|", function() {
          expect(pass).to.changeAST(
            [
              "rule1 = " + case_.rule,
              "rule2 = 'b'"
            ].join("\n"),
            {
              rules: [
                { name: "rule1", reportFailures: true, expression: { type: case_.type } },
                { name: "rule2", reportFailures: true }
              ]
            },
            { allowedStartRules: ["rule1"] }
          );
        });
      }

      it("not only from |named| rules", function() {
        // rule1 (named) -> rule3
        // rule2 -> rule3
        expect(pass).to.changeAST(
          [
            "rule1 'named' = 'a' rule3",
            "rule2 = 'b' rule3",
            "rule3 = 'c'"
          ].join("\n"),
          {
            rules: [
              { name: "rule1", reportFailures: true },
              { name: "rule2", reportFailures: true },
              { name: "rule3", reportFailures: true }
            ]
          },
          { allowedStartRules: ["rule1", "rule2"] }
        );
      });
    });
  });

  describe("calculate |reportFailure=false|", function() {
    it("for rules not listed in |allowedStartRules|", function() {
      expect(pass).to.changeAST(
        [
          "rule1 = 'a'",
          "rule2 = 'b'"
        ].join("\n"),
        {
          rules: [
            { name: "rule1", reportFailures: false },
            { name: "rule2", reportFailures: false }
          ]
        },
        { allowedStartRules: [] }
      );
    });

    describe("for rules referenced only from named rules", function() {
      for (let case_ of CASES) {
        it("in |" + case_.type + "|", function() {
          // rule1 (named) -> rule3 -> rule2
          expect(pass).to.changeAST(
            [
              "rule1 'named' = rule3",
              "rule3 = " + case_.rule,
              "rule2 = 'c'"
            ].join("\n"),
            {
              rules: [
                { name: "rule1", reportFailures: true },
                { name: "rule3", reportFailures: false, expression: { type: case_.type } },
                { name: "rule2", reportFailures: false }
              ]
            }
          );
          // rule1 (named) -> rule2
          // rule3 (named) -> rule2
          expect(pass).to.changeAST(
            [
              "rule1 'named' = rule2",
              "rule3 'named' = " + case_.rule,
              "rule2 = 'c'"
            ].join("\n"),
            {
              rules: [
                { name: "rule1", reportFailures: true },
                { name: "rule3", reportFailures: true,
                  expression: { type: "named", expression: { type: case_.type } }
                },
                { name: "rule2", reportFailures: false }
              ]
            },
            { allowedStartRules: ["rule1", "rule3"] }
          );
        });
      }
    });
  });
});
