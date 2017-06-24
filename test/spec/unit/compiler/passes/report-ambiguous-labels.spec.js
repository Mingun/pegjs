"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../../lib/compiler/passes/report-ambiguous-labels");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |reportAmbiguousLabels|", function() {
  describe("in a sequence", function() {
    it("reports error if auto-labels is mixed with action", function() {
      expect(pass).to.reportError("start = @'a' 'b' {}", {
        message: "Automatic label can not be used together with an action.",
        location: {
          start: { offset: 8, line: 1, column: 9 },
          end: { offset: 12, line: 1, column: 13 }
        }
      });
      expect(pass).to.reportError("start = @a:'a' 'b' {}", {
        message: 'Automatic label "a" can not be used together with an action.',
        location: {
          start: { offset: 8, line: 1, column: 9 },
          end: { offset: 14, line: 1, column: 15 }
        }
      });
    });

    describe("doesn't report error when auto-labels in subexpressions", function() {
      const TEST_CASES = [
        { name: "choice",             grammar: "start = ('a' / @'a' / 'a') {}" },
        { name: "sequence",           grammar: "start = ('a' @'a' 'a') {}"     },
        { name: "labeled",            grammar: "start = b:(@'a') {}"           },
        { name: "text",               grammar: "start = $(@'a') {}"            },
        { name: "simple_and",         grammar: "start = &(@'a') {}"            },
        { name: "simple_or",          grammar: "start = !(@'a') {}"            },
        { name: "optional",           grammar: "start = (@'a')? {}"            },
        { name: "zero_or_more",       grammar: "start = (@'a')* {}"            },
        { name: "one_or_more",        grammar: "start = (@'a')+ {}"            },
        { name: "range (expression)", grammar: "start = (@'a')|2| {}"          },
        { name: "range (delimiter)",  grammar: "start = .|2, @'a'| {}"         },
        { name: "group",              grammar: "start = (@'a') {}"             },
      ];

      for (let testcase of TEST_CASES) {
        it("- |" + testcase.name + "|", function() {
          expect(pass).to.not.reportError(testcase.grammar);
          expect(pass).to.not.reportError(testcase.grammar.replace("@", "@label:"));
        });
      }
    });
  });

  describe("in a choice", function() {
    it("doesn't report error when auto-label and action in different arms", function() {
      expect(pass).to.not.reportError("start = @'a' / {}");
      expect(pass).to.not.reportError("start = {} / @'a'");

      expect(pass).to.not.reportError("start = @a:'a' / {}");
      expect(pass).to.not.reportError("start = {} / @a:'a'");
    });
  });
});
