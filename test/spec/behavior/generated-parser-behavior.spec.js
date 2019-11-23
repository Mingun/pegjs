"use strict";

/* global console */

let chai = require("chai");
let peg = require("../../../lib/peg");
let sinon = require("sinon");

let expect = chai.expect;

describe("generated parser behavior", function() {
  function varyOptimizationOptions(block) {
    let optionsVariants = [
      { cache: false, trace: false },
      { cache: false, trace: true  },
      { cache: true,  trace: false },
      { cache: true,  trace: true  },
    ];

    optionsVariants.forEach(variant => {
      describe(
        "with options " + chai.util.inspect(variant),
        function() { block(Object.assign({}, variant)); }
      );
    });
  }

  function withConsoleStub(block) {
    if (typeof console === "object") {
      sinon.stub(console, "log");
    }

    try {
      return block();
    } finally {
      if (typeof console === "object") {
        console.log.restore();
      }
    }
  }

  function helpers(chai, utils) {
    let Assertion = chai.Assertion;

    Assertion.addMethod("parse", function(input, expected, options) {
      options = options !== undefined ? options : {};

      let result = withConsoleStub(() =>
        utils.flag(this, "object").parse(input, options)
      );

      if (expected !== undefined) {
        this.assert(
          utils.eql(result, expected),
          "expected #{this} to parse input as #{exp} but got #{act}",
          "expected #{this} to not parse input as #{exp}",
          expected,
          result,
          !utils.flag(this, "negate")
        );
      }
    });

    Assertion.addMethod("failToParse", function(input, props, options) {
      options = options !== undefined ? options : {};

      let passed, result;

      try {
        result = withConsoleStub(() =>
          utils.flag(this, "object").parse(input, options)
        );
        passed = true;
      } catch (e) {
        result = e;
        passed = false;
      }

      this.assert(
        !passed,
        "expected #{this} to fail to parse input but got #{act}",
        "expected #{this} to not fail to parse input but #{act} was thrown",
        null,
        result
      );

      if (!passed && props !== undefined) {
        Object.keys(props).forEach(key => {
          new Assertion(result).to.have.property(key)
            .that.is.deep.equal(props[key]);
        });
      }
    });
  }

  // Helper activation needs to put inside a |beforeEach| block because the
  // helpers conflict with the ones in test/unit/parser.spec.js.
  beforeEach(function() {
    chai.use(helpers);
  });

  varyOptimizationOptions(function(options) {
    describe("initializer", function() {
      it("executes the code before parsing starts", function() {
        let parser = peg.generate([
          "{ var result = 42; }",
          "start = 'a' { return result; }"
        ].join("\n"), options);

        expect(parser).to.parse("a", 42);
      });

      describe("available variables and functions", function() {
        it("|options| contains options", function() {
          let parser = peg.generate([
            "{ var result = options; }",
            "start = 'a' { return result; }"
          ].join("\n"), options);

          expect(parser).to.parse("a", { a: 42 }, { a: 42 });
        });
      });
    });

    describe("rule", function() {
      if (options.cache) {
        it("caches rule match results", function() {
          let parser = peg.generate([
            "{ var n = 0; }",
            "start = (a 'b') / (a 'c') { return n; }",
            "a = 'a' { n++; }"
          ].join("\n"), options);

          expect(parser).to.parse("ac", 1);
        });
      } else {
        it("doesn't cache rule match results", function() {
          let parser = peg.generate([
            "{ var n = 0; }",
            "start = (a 'b') / (a 'c') { return n; }",
            "a = 'a' { n++; }"
          ].join("\n"), options);

          expect(parser).to.parse("ac", 2);
        });
      }

      describe("when the expression matches", function() {
        it("returns its match result", function() {
          let parser = peg.generate("start = 'a'");

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when the expression doesn't match", function() {
        describe("without display name", function() {
          it("reports match failure and doesn't record any expectation", function() {
            let parser = peg.generate("start = 'a'");

            expect(parser).to.failToParse("b", {
              expected: [{ type: "literal", text: "a", ignoreCase: false }]
            });
          });
        });

        describe("with display name", function() {
          it("reports match failure and records an expectation of type \"rule\"", function() {
            let parser = peg.generate("start 'start' = 'a'");

            expect(parser).to.failToParse("b", {
              expected: [{ type: "rule", description: "start" }]
            });
          });

          it("discards any expectations recorded when matching the expression", function() {
            let parser = peg.generate("start 'start' = 'a'");

            expect(parser).to.failToParse("b", {
              expected: [{ type: "rule", description: "start" }]
            });
          });
        });
      });
    });

    describe("literal", function() {
      describe("matching", function() {
        it("matches empty literals", function() {
          let parser = peg.generate("start = ''", options);

          expect(parser).to.parse("");
        });

        it("matches one-character literals", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.parse("a");
          expect(parser).to.failToParse("b");
        });

        it("matches multi-character literals", function() {
          let parser = peg.generate("start = 'abcd'", options);

          expect(parser).to.parse("abcd");
          expect(parser).to.failToParse("efgh");
        });

        it("is case sensitive without the \"i\" flag", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.parse("a");
          expect(parser).to.failToParse("A");
        });

        it("is case insensitive with the \"i\" flag", function() {
          let parser = peg.generate("start = 'a'i", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("A");
        });
      });

      describe("when it matches", function() {
        it("returns the matched text", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.parse("a", "a");
        });

        it("consumes the matched text", function() {
          let parser = peg.generate("start = 'a' .", options);

          expect(parser).to.parse("ab");
        });
      });

      describe("when it doesn't match", function() {
        it("reports match failure and records an expectation of type \"literal\"", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            expected: [{ type: "literal", text: "a", ignoreCase: false }]
          });
        });
      });
    });

    describe("character class", function() {
      describe("matching", function() {
        it("matches empty classes", function() {
          let parser = peg.generate("start = []", options);

          expect(parser).to.failToParse("a");
        });

        it("matches classes with a character list", function() {
          let parser = peg.generate("start = [abc]", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("b");
          expect(parser).to.parse("c");
          expect(parser).to.failToParse("d");
        });

        it("matches classes with a character range", function() {
          let parser = peg.generate("start = [a-c]", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("b");
          expect(parser).to.parse("c");
          expect(parser).to.failToParse("d");
        });

        it("matches inverted classes", function() {
          let parser = peg.generate("start = [^a]", options);

          expect(parser).to.failToParse("a");
          expect(parser).to.parse("b");
        });

        it("is case sensitive without the \"i\" flag", function() {
          let parser = peg.generate("start = [a]", options);

          expect(parser).to.parse("a");
          expect(parser).to.failToParse("A");
        });

        it("is case insensitive with the \"i\" flag", function() {
          let parser = peg.generate("start = [a]i", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("A");
        });
      });

      describe("when it matches", function() {
        it("returns the matched character", function() {
          let parser = peg.generate("start = [a]", options);

          expect(parser).to.parse("a", "a");
        });

        it("consumes the matched character", function() {
          let parser = peg.generate("start = [a] .", options);

          expect(parser).to.parse("ab");
        });
      });

      describe("when it doesn't match", function() {
        it("reports match failure and records an expectation of type \"class\"", function() {
          let parser = peg.generate("start = [a]", options);

          expect(parser).to.failToParse("b", {
            expected: [{ type: "class", parts: ["a"], inverted: false, ignoreCase: false }]
          });
        });
      });
    });

    describe("dot", function() {
      describe("matching", function() {
        it("matches any character", function() {
          let parser = peg.generate("start = .", options);

          expect(parser).to.parse("a");
          expect(parser).to.parse("b");
          expect(parser).to.parse("c");
        });
      });

      describe("when it matches", function() {
        it("returns the matched character", function() {
          let parser = peg.generate("start = .", options);

          expect(parser).to.parse("a", "a");
        });

        it("consumes the matched character", function() {
          let parser = peg.generate("start = . .", options);

          expect(parser).to.parse("ab");
        });
      });

      describe("when it doesn't match", function() {
        it("reports match failure and records an expectation of type \"any\"", function() {
          let parser = peg.generate("start = .", options);

          expect(parser).to.failToParse("", {
            expected: [{ type: "any" }]
          });
        });
      });
    });

    describe("rule reference", function() {
      describe("when referenced rule's expression matches", function() {
        it("returns its result", function() {
          let parser = peg.generate([
            "start = a",
            "a = 'a'"
          ].join("\n"), options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when referenced rule's expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate([
            "start = a",
            "a = 'a'"
          ].join("\n"), options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("positive semantic predicate", function() {
      describe("when the code returns a truthy value", function() {
        it("returns |undefined|", function() {
          // The |""| is needed so that the parser doesn't return just
          // |undefined| which we can't compare against in |toParse| due to the
          // way optional parameters work.
          let parser = peg.generate("start = &{ return true; } ''", options);

          expect(parser).to.parse("", [undefined, ""]);
        });
      });

      describe("when the code returns a falsey value", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = &{ return false; }", options);

          expect(parser).to.failToParse("");
        });
      });

      describe("label variables", function() {
        describe("in containing sequence", function() {
          it("can access variables defined by preceding labeled elements", function() {
            let parser = peg.generate(
              "start = a:'a' &{ return a === 'a'; }",
              options
            );

            expect(parser).to.parse("a");
          });

          it("cannot access variable defined by labeled predicate element", function() {
            let parser = peg.generate(
              "start = 'a' b:&{ return b === undefined; } 'c'",
              options
            );

            expect(parser).to.failToParse("ac");
          });

          it("cannot access variables defined by following labeled elements", function() {
            let parser = peg.generate(
              "start = &{ return a === 'a'; } a:'a'",
              options
            );

            expect(parser).to.failToParse("a");
          });

          it("cannot access variables defined by subexpressions", function() {
            let testcases = [
              {
                grammar: "start = (a:'a') &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')? &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')* &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')+ &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')| .. | &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|0.. | &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|1.. | &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|2.. | &{ return a === 'a'; }",
                input: "aa"
              },
              {
                grammar: "start = (a:'a')| ..1| &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')| ..3| &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|2..3| &{ return a === 'a'; }",
                input: "aa"
              },
              {
                grammar: "start = (a:'a')|3| &{ return a === 'a'; }",
                input: "aaa"
              },
              {
                grammar: "start = $(a:'a') &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = &(a:'a') 'a' &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = !(a:'a') 'b' &{ return a === 'a'; }",
                input: "b"
              },
              {
                grammar: "start = b:(a:'a') &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = ('a' b:'b' 'c') &{ return b === 'b'; }",
                input: "abc"
              },
              {
                grammar: "start = (a:'a' { return a; }) &{ return a === 'a'; }",
                input: "a"
              },
              {
                grammar: "start = ('a' / b:'b' / 'c') &{ return b === 'b'; }",
                input: "b"
              }
            ];

            testcases.forEach(testcase => {
              let parser = peg.generate(testcase.grammar, options);
              expect(parser).to.failToParse(testcase.input);
            });
          });
        });

        describe("in outer sequence", function() {
          it("can access variables defined by preceding labeled elements", function() {
            let parser = peg.generate(
              "start = a:'a' ('b' &{ return a === 'a'; })",
              options
            );

            expect(parser).to.parse("ab");
          });

          it("cannot access variable defined by labeled predicate element", function() {
            let parser = peg.generate(
              "start = 'a' b:('b' &{ return b === undefined; }) 'c'",
              options
            );

            expect(parser).to.failToParse("abc");
          });

          it("cannot access variables defined by following labeled elements", function() {
            let parser = peg.generate(
              "start = ('a' &{ return b === 'b'; }) b:'b'",
              options
            );

            expect(parser).to.failToParse("ab");
          });
        });
      });

      describe("initializer variables & functions", function() {
        it("can access variables defined in the initializer", function() {
          let parser = peg.generate([
            "{ var v = 42 }",
            "start = &{ return v === 42; }"
          ].join("\n"), options);

          expect(parser).to.parse("");
        });

        it("can access functions defined in the initializer", function() {
          let parser = peg.generate([
            "{ function f() { return 42; } }",
            "start = &{ return f() === 42; }"
          ].join("\n"), options);

          expect(parser).to.parse("");
        });
      });

      describe("available variables & functions", function() {
        it("|options| contains options", function() {
          let parser = peg.generate([
            "{ var result; }",
            "start = &{ result = options; return true; } { return result; }"
          ].join("\n"), options);

          expect(parser).to.parse("", { a: 42 }, { a: 42 });
        });

        it("|location| returns current location info", function() {
          let parser = peg.generate([
            "{ var result; }",
            "start = line (nl+ line)* { return result; }",
            "line = thing (' '+ thing)*",
            "thing = digit / mark",
            "digit = [0-9]",
            "mark = &{ result = state.location(); return true; } 'x'",
            "nl = '\\r'? '\\n'"
          ].join("\n"), options);

          expect(parser).to.parse("1\n2\n\n3\n\n\n4 5 x", {
            source: undefined,
            start: { offset: 13, line: 7, column: 5 },
            end: { offset: 13, line: 7, column: 5 }
          });

          // Newline representations
          expect(parser).to.parse("1\nx", {     // Unix
            source: undefined,
            start: { offset: 2, line: 2, column: 1 },
            end: { offset: 2, line: 2, column: 1 }
          });
          expect(parser).to.parse("1\r\nx", {   // Windows
            source: undefined,
            start: { offset: 3, line: 2, column: 1 },
            end: { offset: 3, line: 2, column: 1 }
          });
        });

        it("|offset| returns current start offset", function() {
          let parser = peg.generate([
            "start = [0-9]+ val:mark { return val; }",
            "mark = 'xx' { return state.offset(); }"
          ].join("\n"), options);

          expect(parser).to.parse("0123456xx", 7);
        });

        it("|range| returns current range", function() {
          let parser = peg.generate([
            "start = [0-9]+ val:mark { return val; }",
            "mark = 'xx' { return state.range(); }"
          ].join("\n"), options);

          expect(parser).to.parse("0123456xx", [7, 9]);
        });
      });
    });

    describe("negative semantic predicate", function() {
      describe("when the code returns a falsey value", function() {
        it("returns |undefined|", function() {
          // The |""| is needed so that the parser doesn't return just
          // |undefined| which we can't compare against in |toParse| due to the
          // way optional parameters work.
          let parser = peg.generate("start = !{ return false; } ''", options);

          expect(parser).to.parse("", [undefined, ""]);
        });
      });

      describe("when the code returns a truthy value", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = !{ return true; }", options);

          expect(parser).to.failToParse("");
        });
      });

      describe("label variables", function() {
        describe("in containing sequence", function() {
          it("can access variables defined by preceding labeled elements", function() {
            let parser = peg.generate(
              "start = a:'a' !{ return a !== 'a'; }",
              options
            );

            expect(parser).to.parse("a");
          });

          it("cannot access variable defined by labeled predicate element", function() {
            let parser = peg.generate(
              "start = 'a' b:!{ return b !== undefined; } 'c'",
              options
            );

            expect(parser).to.failToParse("ac");
          });

          it("cannot access variables defined by following labeled elements", function() {
            let parser = peg.generate(
              "start = !{ return a !== 'a'; } a:'a'",
              options
            );

            expect(parser).to.failToParse("a");
          });

          it("cannot access variables defined by subexpressions", function() {
            let testcases = [
              {
                grammar: "start = (a:'a') !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')? !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')* !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')+ !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')| .. | !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|0.. | !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|1.. | !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|2.. | !{ return a !== 'a'; }",
                input: "aa"
              },
              {
                grammar: "start = (a:'a')| ..1| !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')| ..3| !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = (a:'a')|2..3| !{ return a !== 'a'; }",
                input: "aa"
              },
              {
                grammar: "start = (a:'a')|3| !{ return a !== 'a'; }",
                input: "aaa"
              },
              {
                grammar: "start = $(a:'a') !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = &(a:'a') 'a' !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = !(a:'a') 'b' !{ return a !== 'a'; }",
                input: "b"
              },
              {
                grammar: "start = b:(a:'a') !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = ('a' b:'b' 'c') !{ return b !== 'b'; }",
                input: "abc"
              },
              {
                grammar: "start = (a:'a' { return a; }) !{ return a !== 'a'; }",
                input: "a"
              },
              {
                grammar: "start = ('a' / b:'b' / 'c') !{ return b !== 'b'; }",
                input: "b"
              }
            ];

            testcases.forEach(testcase => {
              let parser = peg.generate(testcase.grammar, options);
              expect(parser).to.failToParse(testcase.input);
            });
          });
        });

        describe("in outer sequence", function() {
          it("can access variables defined by preceding labeled elements", function() {
            let parser = peg.generate(
              "start = a:'a' ('b' !{ return a !== 'a'; })",
              options
            );

            expect(parser).to.parse("ab");
          });

          it("cannot access variable defined by labeled predicate element", function() {
            let parser = peg.generate(
              "start = 'a' b:('b' !{ return b !== undefined; }) 'c'",
              options
            );

            expect(parser).to.failToParse("abc");
          });

          it("cannot access variables defined by following labeled elements", function() {
            let parser = peg.generate(
              "start = ('a' !{ return b !== 'b'; }) b:'b'",
              options
            );

            expect(parser).to.failToParse("ab");
          });
        });
      });

      describe("initializer variables & functions", function() {
        it("can access variables defined in the initializer", function() {
          let parser = peg.generate([
            "{ var v = 42 }",
            "start = !{ return v !== 42; }"
          ].join("\n"), options);

          expect(parser).to.parse("");
        });

        it("can access functions defined in the initializer", function() {
          let parser = peg.generate([
            "{ function f() { return 42; } }",
            "start = !{ return f() !== 42; }"
          ].join("\n"), options);

          expect(parser).to.parse("");
        });
      });

      describe("available variables & functions", function() {
        it("|options| contains options", function() {
          let parser = peg.generate([
            "{ var result; }",
            "start = !{ result = options; return false; } { return result; }"
          ].join("\n"), options);

          expect(parser).to.parse("", { a: 42 }, { a: 42 });
        });

        it("|location| returns current location info", function() {
          let parser = peg.generate([
            "{ var result; }",
            "start = line (nl+ line)* { return result; }",
            "line = thing (' '+ thing)*",
            "thing = digit / mark",
            "digit = [0-9]",
            "mark = !{ result = state.location(); return false; } 'x'",
            "nl = '\\r'? '\\n'"
          ].join("\n"), options);

          expect(parser).to.parse("1\n2\n\n3\n\n\n4 5 x", {
            source: undefined,
            start: { offset: 13, line: 7, column: 5 },
            end: { offset: 13, line: 7, column: 5 }
          });

          // Newline representations
          expect(parser).to.parse("1\nx", {     // Unix
            source: undefined,
            start: { offset: 2, line: 2, column: 1 },
            end: { offset: 2, line: 2, column: 1 }
          });
          expect(parser).to.parse("1\r\nx", {   // Windows
            source: undefined,
            start: { offset: 3, line: 2, column: 1 },
            end: { offset: 3, line: 2, column: 1 }
          });
        });
      });
    });

    describe("group", function() {
      describe("when the expression matches", function() {
        it("returns its match result", function() {
          let parser = peg.generate("start = ('a')", options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when the expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = ('a')", options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("optional", function() {
      describe("when the expression matches", function() {
        it("returns its match result", function() {
          let parser = peg.generate("start = 'a'?", options);

          expect(parser).to.parse("a", "a");
        });
      });

      describe("when the expression doesn't match", function() {
        it("returns |null|", function() {
          let parser = peg.generate("start = 'a'?", options);

          expect(parser).to.parse("", null);
        });
      });
    });

    describe("zero or more", function() {
      describe("when the expression matches zero or more times", function() {
        it("returns an array of its match results", function() {
          let parser = peg.generate("start = 'a'*", options);

          expect(parser).to.parse("",    []);
          expect(parser).to.parse("a",   ["a"]);
          expect(parser).to.parse("aaa", ["a", "a", "a"]);
        });
      });
    });

    describe("one or more", function() {
      describe("when the expression matches one or more times", function() {
        it("returns an array of its match results", function() {
          let parser = peg.generate("start = 'a'+", options);

          expect(parser).to.parse("a",   ["a"]);
          expect(parser).to.parse("aaa", ["a", "a", "a"]);
        });
      });

      describe("when the expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = 'a'+", options);

          expect(parser).to.failToParse("");
        });
      });
    });

    describe("range", function() {
      function buildParser(boundary) {
        let start = [];
        for (let i = 1; i <= 4; ++i) {
          for (let j = 1; j <= 4; ++j) {
            start[start.length] = "start" + String(i) + j;
          }
        }
        let opt = Object.assign({}, options);
        opt.allowedStartRules = start;

        let parser = peg.generate([
          "start11 =         val:n1      x|" + boundary + "|      $.*",
          "start12 =         val:n1 data:x|" + boundary + "|      $.*",
          "start13 =         val:n1      x|" + boundary + "| rest:$.*",
          "start14 =         val:n1 data:x|" + boundary + "| rest:$.*",

          "start21 = .       val:n1      x|" + boundary + "|      $.*",
          "start22 = .       val:n1 data:x|" + boundary + "|      $.*",
          "start23 = .       val:n1      x|" + boundary + "| rest:$.*",
          "start24 = .       val:n1 data:x|" + boundary + "| rest:$.*",

          "start31 = a:.     val:n1      x|" + boundary + "|      $.*",
          "start32 = a:.     val:n1 data:x|" + boundary + "|      $.*",
          "start33 = a:.     val:n1      x|" + boundary + "| rest:$.*",
          "start34 = a:.     val:n1 data:x|" + boundary + "| rest:$.*",

          "start41 = a:. b:. val:n1      x|" + boundary + "|      $.*",
          "start42 = a:. b:. val:n1 data:x|" + boundary + "|      $.*",
          "start43 = a:. b:. val:n1      x|" + boundary + "| rest:$.*",
          "start44 = a:. b:. val:n1 data:x|" + boundary + "| rest:$.*",

          "n1 = n:$[0-9] { return parseInt(n, 10); }",
          "x = '='"
        ].join(";\n"), opt);

        return parser;
      }

      describe("without delimiter", function() {
        describe("with constant boundaries", function() {
          it("| .. | matches correctly", function() {
            let parser = peg.generate("start = 'a'|..|", options);

            expect(parser).to.parse("",    []);
            expect(parser).to.parse("a",   ["a"]);
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.parse("aaa", ["a", "a", "a"]);
          });

          it("|0.. | matches correctly", function() {
            let parser = peg.generate("start = 'a'|0..|", options);

            expect(parser).to.parse("",    []);
            expect(parser).to.parse("a",   ["a"]);
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.parse("aaa", ["a", "a", "a"]);
          });

          it("|1.. | matches correctly", function() {
            let parser = peg.generate("start = 'a'|1..|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.parse("a",   ["a"]);
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.parse("aaa", ["a", "a", "a"]);
          });

          it("|2.. | matches correctly", function() {
            let parser = peg.generate("start = 'a'|2..|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.parse("aaa", ["a", "a", "a"]);
          });

          it("| ..1| matches correctly", function() {
            let parser = peg.generate("start = 'a'|..1|", options);

            expect(parser).to.parse("",    []);
            expect(parser).to.parse("a",   ["a"]);
            expect(parser).to.failToParse("aa");
            expect(parser).to.failToParse("aaa");
          });

          it("| ..2| matches correctly", function() {
            let parser = peg.generate("start = 'a'|..2|", options);

            expect(parser).to.parse("",    []);
            expect(parser).to.parse("a",   ["a"]);
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.failToParse("aaa");
          });

          it("|2..3| matches correctly", function() {
            let parser = peg.generate("start = 'a'|2..3|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.parse("aaa", ["a", "a", "a"]);
            expect(parser).to.failToParse("aaaa");
          });

          it("|2..2| matches correctly", function() {
            let parser = peg.generate("start = 'a'|2..2|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.failToParse("aaa");
          });

          it("| 2  | matches correctly", function() {
            let parser = peg.generate("start = 'a'|2|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("aa",  ["a", "a"]);
            expect(parser).to.failToParse("aaa");
          });

          it("|3..2| matches correctly", function() {
            let parser = peg.generate("start = 'a'|3..2|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.failToParse("aa");
            expect(parser).to.failToParse("aaa");
          });

          it("does not consume input on failure", function() {
            let parser = peg.generate("start = 'a'|3| / 'a'|2| { return 42; }", options);

            expect(parser).to.parse("aa", 42);
          });
        });

        describe("with variable boundaries", function() {
          this.timeout(10000);// default 2000ms not enouth

          it("|min..   | matches correctly", function() {
            let parser = buildParser("val..");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("1", undefined, opt);
              expect(parser).to.failToParse("2=", undefined, opt);
              expect(parser).to.parse("2==", [2, ["=", "="], ""], opt);
              expect(parser).to.parse("2=====", [2, ["=", "=", "=", "=", "="], ""], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("-1", undefined, opt);
              expect(parser).to.failToParse("-2=", undefined, opt);
              expect(parser).to.parse("-2==", ["-", 2, ["=", "="], ""], opt);
              expect(parser).to.parse("-2=====", ["-", 2, ["=", "=", "=", "=", "="], ""], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("-1", undefined, opt);
              expect(parser).to.failToParse("-2=", undefined, opt);
              expect(parser).to.parse("-2==", ["-", 2, ["=", "="], ""], opt);
              expect(parser).to.parse("-2=====", ["-", 2, ["=", "=", "=", "=", "="], ""], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("--1", undefined, opt);
              expect(parser).to.failToParse("--2=", undefined, opt);
              expect(parser).to.parse("--2==", ["-", "-", 2, ["=", "="], ""], opt);
              expect(parser).to.parse("--2=====", ["-", "-", 2, ["=", "=", "=", "=", "="], ""], opt);
            }
          });

          it("|   ..max| matches correctly", function() {
            let parser = buildParser("..val");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, [], "=="], opt);
              expect(parser).to.parse("3", [3, [], ""], opt);
              expect(parser).to.parse("3=", [3, ["="], ""], opt);
              expect(parser).to.parse("3===", [3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("3=====", [3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-3", ["-", 3, [], ""], opt);
              expect(parser).to.parse("-3=", ["-", 3, ["="], ""], opt);
              expect(parser).to.parse("-3===", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=====", ["-", 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-3", ["-", 3, [], ""], opt);
              expect(parser).to.parse("-3=", ["-", 3, ["="], ""], opt);
              expect(parser).to.parse("-3===", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=====", ["-", 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, [], "=="], opt);
              expect(parser).to.parse("--3", ["-", "-", 3, [], ""], opt);
              expect(parser).to.parse("--3=", ["-", "-", 3, ["="], ""], opt);
              expect(parser).to.parse("--3===", ["-", "-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--3=====", ["-", "-", 3, ["=", "=", "="], "=="], opt);
            }
          });

          it("|min..max| matches correctly", function() {
            function buildRangeParser() {
              let start = [];
              for (let i = 1; i <= 4; ++i) {
                for (let j = 1; j <= 4; ++j) {
                  start[start.length] = "start" + String(i) + j;
                }
              }
              let opt = Object.assign({}, options);
              opt.allowedStartRules = start;

              let parser = peg.generate([
                "start11 =         min:n1 max:n1      .|min..max|      $.*",
                "start12 =         min:n1 max:n1 data:.|min..max|      $.*",
                "start13 =         min:n1 max:n1      .|min..max| rest:$.*",
                "start14 =         min:n1 max:n1 data:.|min..max| rest:$.*",

                "start21 = .       min:n1 max:n1      .|min..max|      $.*",
                "start22 = .       min:n1 max:n1 data:.|min..max|      $.*",
                "start23 = .       min:n1 max:n1      .|min..max| rest:$.*",
                "start24 = .       min:n1 max:n1 data:.|min..max| rest:$.*",

                "start31 = a:.     min:n1 max:n1      .|min..max|      $.*",
                "start32 = a:.     min:n1 max:n1 data:.|min..max|      $.*",
                "start33 = a:.     min:n1 max:n1      .|min..max| rest:$.*",
                "start34 = a:.     min:n1 max:n1 data:.|min..max| rest:$.*",

                "start41 = a:. b:. min:n1 max:n1      .|min..max|      $.*",
                "start42 = a:. b:. min:n1 max:n1 data:.|min..max|      $.*",
                "start43 = a:. b:. min:n1 max:n1      .|min..max| rest:$.*",
                "start44 = a:. b:. min:n1 max:n1 data:.|min..max| rest:$.*",

                "n1 = n:$[0-9] { return parseInt(n, 10); }"
              ].join(";\n"), opt);

              return parser;
            }

            let parser = buildRangeParser();

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("00", [0, 0, [], ""], opt);
              expect(parser).to.parse("00==", [0, 0, [], "=="], opt);
              expect(parser).to.failToParse("23", undefined, opt);
              expect(parser).to.failToParse("23=", undefined, opt);
              expect(parser).to.parse("23==", [2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("23===", [2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("23=====", [2, 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-00", ["-", 0, 0, [], ""], opt);
              expect(parser).to.parse("-00==", ["-", 0, 0, [], "=="], opt);
              expect(parser).to.failToParse("-23", undefined, opt);
              expect(parser).to.failToParse("-23=", undefined, opt);
              expect(parser).to.parse("-23==", ["-", 2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("-23===", ["-", 2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-23=====", ["-", 2, 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-00", ["-", 0, 0, [], ""], opt);
              expect(parser).to.parse("-00==", ["-", 0, 0, [], "=="], opt);
              expect(parser).to.failToParse("-23", undefined, opt);
              expect(parser).to.failToParse("-23=", undefined, opt);
              expect(parser).to.parse("-23==", ["-", 2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("-23===", ["-", 2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-23=====", ["-", 2, 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--00", ["-", "-", 0, 0, [], ""], opt);
              expect(parser).to.parse("--00==", ["-", "-", 0, 0, [], "=="], opt);
              expect(parser).to.failToParse("--23", undefined, opt);
              expect(parser).to.failToParse("--23=", undefined, opt);
              expect(parser).to.parse("--23==", ["-", "-", 2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("--23===", ["-", "-", 2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--23=====", ["-", "-", 2, 3, ["=", "=", "="], "=="], opt);
            }
          });

          it("|val..val| matches correctly", function() {
            let parser = buildParser("val");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, [], "=="], opt);
              expect(parser).to.failToParse("3", undefined, opt);
              expect(parser).to.failToParse("3=", undefined, opt);
              expect(parser).to.parse("3===", [3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("3=====", [3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.parse("-3===", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=====", ["-", 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.parse("-3===", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=====", ["-", 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, [], "=="], opt);
              expect(parser).to.failToParse("--3", undefined, opt);
              expect(parser).to.failToParse("--3=", undefined, opt);
              expect(parser).to.parse("--3===", ["-", "-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--3=====", ["-", "-", 3, ["=", "=", "="], "=="], opt);
            }
          });

          it("| exact  | matches correctly", function() {
            let parser = buildParser("val");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, [], "=="], opt);
              expect(parser).to.failToParse("3", undefined, opt);
              expect(parser).to.failToParse("3=", undefined, opt);
              expect(parser).to.parse("3===", [3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("3=====", [3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.parse("-3===", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=====", ["-", 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.parse("-3===", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=====", ["-", 3, ["=", "=", "="], "=="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, [], "=="], opt);
              expect(parser).to.failToParse("--3", undefined, opt);
              expect(parser).to.failToParse("--3=", undefined, opt);
              expect(parser).to.parse("--3===", ["-", "-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--3=====", ["-", "-", 3, ["=", "=", "="], "=="], opt);
            }
          });
        });
      });

      describe("with delimiter", function() {
        describe("with constant boundaries", function() {
          it("| .. , delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|.., '~'|", options);

            expect(parser).to.parse("",      []);
            expect(parser).to.parse("a",     ["a"]);
            expect(parser).to.parse("a~a",   ["a", "a"]);
            expect(parser).to.parse("a~a~a", ["a", "a", "a"]);
          });

          it("|0.. , delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|0.., '~'|", options);

            expect(parser).to.parse("",      []);
            expect(parser).to.parse("a",     ["a"]);
            expect(parser).to.parse("a~a",   ["a", "a"]);
            expect(parser).to.parse("a~a~a", ["a", "a", "a"]);
          });

          it("|1.. , delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|1.., '~'|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.parse("a",     ["a"]);
            expect(parser).to.parse("a~a",   ["a", "a"]);
            expect(parser).to.parse("a~a~a", ["a", "a", "a"]);
          });

          it("|2.. , delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|2.., '~'|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("a~a",   ["a", "a"]);
            expect(parser).to.parse("a~a~a", ["a", "a", "a"]);
          });

          it("| ..1, delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|..1, '~'|", options);

            expect(parser).to.parse("",    []);
            expect(parser).to.parse("a",   ["a"]);
            expect(parser).to.failToParse("a~a");
            expect(parser).to.failToParse("a~a~a");
          });

          it("| ..2, delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|..2, '~'|", options);

            expect(parser).to.parse("",     []);
            expect(parser).to.parse("a",    ["a"]);
            expect(parser).to.parse("a~a",  ["a", "a"]);
            expect(parser).to.failToParse("a~a~a");
          });

          it("|2..3, delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|2..3, '~'|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("a~a",   ["a", "a"]);
            expect(parser).to.parse("a~a~a", ["a", "a", "a"]);
            expect(parser).to.failToParse("a~a~a~a");
          });

          it("|2..2, delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|2..2, '~'|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("a~a",  ["a", "a"]);
            expect(parser).to.failToParse("a~a~a");
          });

          it("|2   , delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|2, '~'|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.parse("a~a",  ["a", "a"]);
            expect(parser).to.failToParse("a~a~a");
          });

          it("|3..2, delimiter| matches correctly", function() {
            let parser = peg.generate("start = 'a'|3..2, '~'|", options);

            expect(parser).to.failToParse("");
            expect(parser).to.failToParse("a");
            expect(parser).to.failToParse("a~a");
            expect(parser).to.failToParse("a~a~a");
          });
        });

        describe("with variable boundaries", function() {
          this.timeout(10000);// default 2000ms not enouth

          it("|min..   , delimiter| matches correctly", function() {
            let parser = buildParser("val.., '~'");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, ["="], "="], opt);
              expect(parser).to.parse("0=~=", [0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("1", undefined, opt);
              expect(parser).to.failToParse("1~", undefined, opt);
              expect(parser).to.failToParse("2=", undefined, opt);
              expect(parser).to.failToParse("2=~", undefined, opt);
              expect(parser).to.failToParse("2==", undefined, opt);
              expect(parser).to.parse("2=~=", [2, ["=", "="], ""], opt);
              expect(parser).to.parse("2=~=~", [2, ["=", "="], "~"], opt);
              expect(parser).to.parse("2=~=~=~=~=", [2, ["=", "=", "=", "=", "="], ""], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, ["="], "="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("-1", undefined, opt);
              expect(parser).to.failToParse("-1~", undefined, opt);
              expect(parser).to.failToParse("-2=", undefined, opt);
              expect(parser).to.failToParse("-2=~", undefined, opt);
              expect(parser).to.failToParse("-2==", undefined, opt);
              expect(parser).to.parse("-2=~=", ["-", 2, ["=", "="], ""], opt);
              expect(parser).to.parse("-2=~=~", ["-", 2, ["=", "="], "~"], opt);
              expect(parser).to.parse("-2=~=~=~=~=", ["-", 2, ["=", "=", "=", "=", "="], ""], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, ["="], "="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("-1", undefined, opt);
              expect(parser).to.failToParse("-1~", undefined, opt);
              expect(parser).to.failToParse("-2=", undefined, opt);
              expect(parser).to.failToParse("-2=~", undefined, opt);
              expect(parser).to.failToParse("-2==", undefined, opt);
              expect(parser).to.parse("-2=~=", ["-", 2, ["=", "="], ""], opt);
              expect(parser).to.parse("-2=~=~", ["-", 2, ["=", "="], "~"], opt);
              expect(parser).to.parse("-2=~=~=~=~=", ["-", 2, ["=", "=", "=", "=", "="], ""], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, ["="], "="], opt);
              expect(parser).to.parse("--0=~=", ["-", "-", 0, ["=", "="], ""], opt);
              expect(parser).to.failToParse("--1", undefined, opt);
              expect(parser).to.failToParse("--1~", undefined, opt);
              expect(parser).to.failToParse("--2=", undefined, opt);
              expect(parser).to.failToParse("--2=~", undefined, opt);
              expect(parser).to.failToParse("--2==", undefined, opt);
              expect(parser).to.parse("--2=~=", ["-", "-", 2, ["=", "="], ""], opt);
              expect(parser).to.parse("--2=~=~", ["-", "-", 2, ["=", "="], "~"], opt);
              expect(parser).to.parse("--2=~=~=~=~=", ["-", "-", 2, ["=", "=", "=", "=", "="], ""], opt);
            }
          });

          it("|   ..max, delimiter| matches correctly", function() {
            let parser = buildParser("..val, '~'");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, [], "=="], opt);
              expect(parser).to.parse("0=~=", [0, [], "=~="], opt);
              expect(parser).to.parse("3", [3, [], ""], opt);
              expect(parser).to.parse("3=", [3, ["="], ""], opt);
              expect(parser).to.parse("3===", [3, ["="], "=="], opt);
              expect(parser).to.parse("3=~=~", [3, ["=", "="], "~"], opt);
              expect(parser).to.parse("3=~=~=", [3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("3=~=~=~=~=", [3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, [], "=~="], opt);
              expect(parser).to.parse("-3", ["-", 3, [], ""], opt);
              expect(parser).to.parse("-3=", ["-", 3, ["="], ""], opt);
              expect(parser).to.parse("-3===", ["-", 3, ["="], "=="], opt);
              expect(parser).to.parse("-3=~=~", ["-", 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("-3=~=~=", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=~=~=~=~=", ["-", 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, [], "=~="], opt);
              expect(parser).to.parse("-3", ["-", 3, [], ""], opt);
              expect(parser).to.parse("-3=", ["-", 3, ["="], ""], opt);
              expect(parser).to.parse("-3===", ["-", 3, ["="], "=="], opt);
              expect(parser).to.parse("-3=~=~", ["-", 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("-3=~=~=", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=~=~=~=~=", ["-", 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, [], "=="], opt);
              expect(parser).to.parse("--0=~=", ["-", "-", 0, [], "=~="], opt);
              expect(parser).to.parse("--3", ["-", "-", 3, [], ""], opt);
              expect(parser).to.parse("--3=", ["-", "-", 3, ["="], ""], opt);
              expect(parser).to.parse("--3===", ["-", "-", 3, ["="], "=="], opt);
              expect(parser).to.parse("--3=~=~", ["-", "-", 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("--3=~=~=", ["-", "-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--3=~=~=~=~=", ["-", "-", 3, ["=", "=", "="], "~=~="], opt);
            }
          });

          it("|min..max, delimiter| matches correctly", function() {
            function buildRangeParser() {
              let start = [];
              for (let i = 1; i <= 4; ++i) {
                for (let j = 1; j <= 4; ++j) {
                  start[start.length] = "start" + String(i) + j;
                }
              }
              let opt = Object.assign({}, options);
              opt.allowedStartRules = start;

              let parser = peg.generate([
                "start11 =         min:n1 max:n1      .|min..max, '~'|      $.*",
                "start12 =         min:n1 max:n1 data:.|min..max, '~'|      $.*",
                "start13 =         min:n1 max:n1      .|min..max, '~'| rest:$.*",
                "start14 =         min:n1 max:n1 data:.|min..max, '~'| rest:$.*",

                "start21 = .       min:n1 max:n1      .|min..max, '~'|      $.*",
                "start22 = .       min:n1 max:n1 data:.|min..max, '~'|      $.*",
                "start23 = .       min:n1 max:n1      .|min..max, '~'| rest:$.*",
                "start24 = .       min:n1 max:n1 data:.|min..max, '~'| rest:$.*",

                "start31 = a:.     min:n1 max:n1      .|min..max, '~'|      $.*",
                "start32 = a:.     min:n1 max:n1 data:.|min..max, '~'|      $.*",
                "start33 = a:.     min:n1 max:n1      .|min..max, '~'| rest:$.*",
                "start34 = a:.     min:n1 max:n1 data:.|min..max, '~'| rest:$.*",

                "start41 = a:. b:. min:n1 max:n1      .|min..max, '~'|      $.*",
                "start42 = a:. b:. min:n1 max:n1 data:.|min..max, '~'|      $.*",
                "start43 = a:. b:. min:n1 max:n1      .|min..max, '~'| rest:$.*",
                "start44 = a:. b:. min:n1 max:n1 data:.|min..max, '~'| rest:$.*",

                "n1 = n:$[0-9] { return parseInt(n, 10); }"
              ].join(";\n"), opt);

              return parser;
            }

            let parser = buildRangeParser();

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("00", [0, 0, [], ""], opt);
              expect(parser).to.parse("00==", [0, 0, [], "=="], opt);
              expect(parser).to.parse("00=~=", [0, 0, [], "=~="], opt);
              expect(parser).to.failToParse("23", undefined, opt);
              expect(parser).to.failToParse("23=", undefined, opt);
              expect(parser).to.failToParse("23=~", undefined, opt);
              expect(parser).to.failToParse("23==", undefined, opt);
              expect(parser).to.parse("23=~=", [2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("23=~=~", [2, 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("23=~=~=", [2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("23=~=~=~=~=", [2, 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-00", ["-", 0, 0, [], ""], opt);
              expect(parser).to.parse("-00==", ["-", 0, 0, [], "=="], opt);
              expect(parser).to.parse("-00=~=", ["-", 0, 0, [], "=~="], opt);
              expect(parser).to.failToParse("-23", undefined, opt);
              expect(parser).to.failToParse("-23=", undefined, opt);
              expect(parser).to.failToParse("-23=~", undefined, opt);
              expect(parser).to.failToParse("-23==", undefined, opt);
              expect(parser).to.parse("-23=~=", ["-", 2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("-23=~=~", ["-", 2, 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("-23=~=~=", ["-", 2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-23=~=~=~=~=", ["-", 2, 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-00", ["-", 0, 0, [], ""], opt);
              expect(parser).to.parse("-00==", ["-", 0, 0, [], "=="], opt);
              expect(parser).to.parse("-00=~=", ["-", 0, 0, [], "=~="], opt);
              expect(parser).to.failToParse("-23", undefined, opt);
              expect(parser).to.failToParse("-23=", undefined, opt);
              expect(parser).to.failToParse("-23=~", undefined, opt);
              expect(parser).to.failToParse("-23==", undefined, opt);
              expect(parser).to.parse("-23=~=", ["-", 2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("-23=~=~", ["-", 2, 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("-23=~=~=", ["-", 2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-23=~=~=~=~=", ["-", 2, 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--00", ["-", "-", 0, 0, [], ""], opt);
              expect(parser).to.parse("--00==", ["-", "-", 0, 0, [], "=="], opt);
              expect(parser).to.parse("--00=~=", ["-", "-", 0, 0, [], "=~="], opt);
              expect(parser).to.failToParse("--23", undefined, opt);
              expect(parser).to.failToParse("--23=", undefined, opt);
              expect(parser).to.failToParse("--23=~", undefined, opt);
              expect(parser).to.failToParse("--23==", undefined, opt);
              expect(parser).to.parse("--23=~=", ["-", "-", 2, 3, ["=", "="], ""], opt);
              expect(parser).to.parse("--23=~=~", ["-", "-", 2, 3, ["=", "="], "~"], opt);
              expect(parser).to.parse("--23=~=~=", ["-", "-", 2, 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--23=~=~=~=~=", ["-", "-", 2, 3, ["=", "=", "="], "~=~="], opt);
            }
          });

          it("|val..val, delimiter| matches correctly", function() {
            let parser = buildParser("val, '~'");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, [], "=="], opt);
              expect(parser).to.parse("0=~=", [0, [], "=~="], opt);
              expect(parser).to.failToParse("3", undefined, opt);
              expect(parser).to.failToParse("3=", undefined, opt);
              expect(parser).to.failToParse("3=~", undefined, opt);
              expect(parser).to.parse("3=~=~=", [3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("3=~=~=~", [3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("3=~=~=~=~=", [3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, [], "=~="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.failToParse("-3=~", undefined, opt);
              expect(parser).to.parse("-3=~=~=", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=~=~=~", ["-", 3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("-3=~=~=~=~=", ["-", 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, [], "=~="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.failToParse("-3=~", undefined, opt);
              expect(parser).to.parse("-3=~=~=", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=~=~=~", ["-", 3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("-3=~=~=~=~=", ["-", 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, [], "=="], opt);
              expect(parser).to.parse("--0=~=", ["-", "-", 0, [], "=~="], opt);
              expect(parser).to.failToParse("--3", undefined, opt);
              expect(parser).to.failToParse("--3=", undefined, opt);
              expect(parser).to.failToParse("--3=~", undefined, opt);
              expect(parser).to.parse("--3=~=~=", ["-", "-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--3=~=~=~", ["-", "-", 3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("--3=~=~=~=~=", ["-", "-", 3, ["=", "=", "="], "~=~="], opt);
            }
          });

          it("| exact  , delimiter| matches correctly", function() {
            let parser = buildParser("val, '~'");

            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start1" + i };
              expect(parser).to.failToParse("", undefined, opt);
              expect(parser).to.parse("0", [0, [], ""], opt);
              expect(parser).to.parse("0==", [0, [], "=="], opt);
              expect(parser).to.parse("0=~=", [0, [], "=~="], opt);
              expect(parser).to.failToParse("3", undefined, opt);
              expect(parser).to.failToParse("3=", undefined, opt);
              expect(parser).to.failToParse("3=~", undefined, opt);
              expect(parser).to.parse("3=~=~=", [3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("3=~=~=~", [3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("3=~=~=~=~=", [3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start2" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, [], "=~="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.failToParse("-3=~", undefined, opt);
              expect(parser).to.parse("-3=~=~=", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=~=~=~", ["-", 3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("-3=~=~=~=~=", ["-", 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start3" + i };
              expect(parser).to.failToParse("-", undefined, opt);
              expect(parser).to.parse("-0", ["-", 0, [], ""], opt);
              expect(parser).to.parse("-0==", ["-", 0, [], "=="], opt);
              expect(parser).to.parse("-0=~=", ["-", 0, [], "=~="], opt);
              expect(parser).to.failToParse("-3", undefined, opt);
              expect(parser).to.failToParse("-3=", undefined, opt);
              expect(parser).to.failToParse("-3=~", undefined, opt);
              expect(parser).to.parse("-3=~=~=", ["-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("-3=~=~=~", ["-", 3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("-3=~=~=~=~=", ["-", 3, ["=", "=", "="], "~=~="], opt);
            }
            for (let i = 1; i <= 4; ++i) {
              let opt = { startRule: "start4" + i };
              expect(parser).to.failToParse("--", undefined, opt);
              expect(parser).to.parse("--0", ["-", "-", 0, [], ""], opt);
              expect(parser).to.parse("--0==", ["-", "-", 0, [], "=="], opt);
              expect(parser).to.parse("--0=~=", ["-", "-", 0, [], "=~="], opt);
              expect(parser).to.failToParse("--3", undefined, opt);
              expect(parser).to.failToParse("--3=", undefined, opt);
              expect(parser).to.failToParse("--3=~", undefined, opt);
              expect(parser).to.parse("--3=~=~=", ["-", "-", 3, ["=", "=", "="], ""], opt);
              expect(parser).to.parse("--3=~=~=~", ["-", "-", 3, ["=", "=", "="], "~"], opt);
              expect(parser).to.parse("--3=~=~=~=~=", ["-", "-", 3, ["=", "=", "="], "~=~="], opt);
            }
          });
        });
      });

      describe("handle delimiter correctly", function() {
        it("with constant boundaries", function() {
          let parser = peg.generate("start = 'a'|2..3, '~'|", options);

          expect(parser).to.failToParse("");
          expect(parser).to.failToParse("a");
          expect(parser).to.failToParse("aa");
          expect(parser).to.failToParse("a~");
          expect(parser).to.parse("a~a",   ["a", "a"]);
          expect(parser).to.failToParse("a~a~");
          expect(parser).to.parse("a~a~a", ["a", "a", "a"]);
          expect(parser).to.failToParse("a~a~a~");
          expect(parser).to.failToParse("a~a~a~a");
        });

        it("with variable boundaries", function() {
          let parser = peg.generate([
            "start = min:n1 max:n1 'a'|min..max, '~'|",
            "n1 = n:$[0-9] { return parseInt(n, 10); }"
          ].join(";\n"), options);

          expect(parser).to.failToParse("23");
          expect(parser).to.failToParse("23a");
          expect(parser).to.failToParse("23aa");
          expect(parser).to.failToParse("23a~");
          expect(parser).to.parse("23a~a",   [2, 3, ["a", "a"]]);
          expect(parser).to.failToParse("a~a~");
          expect(parser).to.parse("23a~a~a", [2, 3, ["a", "a", "a"]]);
          expect(parser).to.failToParse("23a~a~a~");
          expect(parser).to.failToParse("23a~a~a~a");
        });
      });
    });

    describe("text", function() {
      describe("when the expression matches", function() {
        it("returns the matched text", function() {
          let parser = peg.generate("start = $('a' 'b' 'c')", options);

          expect(parser).to.parse("abc", "abc");
        });
      });

      describe("when the expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = $('a')", options);

          expect(parser).to.failToParse("b");
        });
      });
    });

    describe("positive simple predicate", function() {
      describe("when the expression matches", function() {
        it("returns |undefined|", function() {
          let parser = peg.generate("start = &'a' 'a'", options);

          expect(parser).to.parse("a", [undefined, "a"]);
        });

        it("resets parse position", function() {
          let parser = peg.generate("start = &'a' 'a'", options);

          expect(parser).to.parse("a");
        });
      });

      describe("when the expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = &'a'", options);

          expect(parser).to.failToParse("b");
        });

        it("not discards any expectations recorded when matching the expression", function() {
          let parser = peg.generate("start = 'a' / &'b' / 'c'", options);

          expect(parser).to.failToParse("d", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false },
              { type: "literal", text: "b", ignoreCase: false },
              { type: "literal", text: "c", ignoreCase: false }
            ]
          });
        });
      });
    });

    describe("negative simple predicate", function() {
      describe("when the expression matches", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = !'a'", options);

          expect(parser).to.failToParse("a");
        });
      });

      describe("when the expression doesn't match", function() {
        it("returns |undefined|", function() {
          let parser = peg.generate("start = !'a' 'b'", options);

          expect(parser).to.parse("b", [undefined, "b"]);
        });

        it("resets parse position", function() {
          let parser = peg.generate("start = !'a' 'b'", options);

          expect(parser).to.parse("b");
        });

        it("inverts any expectations recorded when matching the expression", function() {
          let parser = peg.generate("start = 'a' / !'b' / 'c'", options);

          expect(parser).to.failToParse("b", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false },
              { type: "not", expected: { type: "literal", text: "b", ignoreCase: false } },
              { type: "literal", text: "c", ignoreCase: false }
            ]
          });
        });
      });

      describe("when the expression inverted twice", function() {
        it("reports not inverted expectations", function() {
          let parser = peg.generate("start = !(!'a')", options);

          expect(parser).to.failToParse("b", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false }
            ]
          });
        });
      });
    });

    describe("label", function() {
      describe("when the expression matches", function() {
        it("returns its match result", function() {
          let testcases = [
            "start = a:'a'",
            "start = @'a'",
            "start = @a:'a'"
          ];

          testcases.forEach(testcase => {
            let parser = peg.generate(testcase, options);
            expect(parser).to.parse("a", "a");
          });
        });
      });

      describe("when the expression doesn't match", function() {
        it("reports match failure", function() {
          let testcases = [
            "start = a:'a'",
            "start = @'a'",
            "start = @a:'a'"
          ];

          testcases.forEach(testcase => {
            let parser = peg.generate(testcase, options);
            expect(parser).to.failToParse("b");
          });
        });
      });
    });

    describe("sequence", function() {
      describe("when all expressions match", function() {
        it("returns an array of their match results", function() {
          let parser = peg.generate("start = 'a' 'b' 'c'", options);

          expect(parser).to.parse("abc", ["a", "b", "c"]);
        });

        describe("with only one auto-label", function() {
          it("returns one element", function() {
            let testcases = [
              "start =   'a'   @'b' 'c'",
              "start = a:'a'   @'b' 'c'",
              "start =   'a' @b:'b' 'c'",
              "start = a:'a' @b:'b' 'c'"
            ];

            testcases.forEach(testcase => {
              let parser = peg.generate(testcase, options);
              expect(parser).to.parse("abc", "b");
            });
          });
        });

        describe("with multiply auto-labels", function() {
          it("returns an array with their values", function() {
            let testcases = [
              "start = @'a'   @'b'   'c'",
              "start = @'a'   @'b' c:'c'",
              "start = @'a' @b:'b'   'c'",
              "start = @'a' @b:'b' c:'c'"
            ];

            testcases.forEach(testcase => {
              let parser = peg.generate(testcase, options);
              expect(parser).to.parse("abc", ["a", "b"]);
            });
          });
        });
      });

      describe("when any expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = 'a' 'b' 'c'", options);

          expect(parser).to.failToParse("dbc");
          expect(parser).to.failToParse("adc");
          expect(parser).to.failToParse("abd");
        });

        it("resets parse position", function() {
          let parser = peg.generate("start = 'a' 'b' / 'a'", options);

          expect(parser).to.parse("a", "a");
        });
      });
    });

    describe("action", function() {
      describe("when the expression matches", function() {
        it("returns the value returned by the code", function() {
          let parser = peg.generate("start = 'a' { return 42; }", options);

          expect(parser).to.parse("a", 42);
        });

        describe("label variables", function() {
          describe("in the expression", function() {
            it("can access variable defined by labeled expression", function() {
              let parser = peg.generate("start = a:'a' { return a; }", options);

              expect(parser).to.parse("a", "a");
            });

            it("can access variables defined by labeled sequence elements", function() {
              let parser = peg.generate(
                "start = a:'a' b:'b' c:'c' { return [a, b, c]; }",
                options
              );

              expect(parser).to.parse("abc", ["a", "b", "c"]);
            });

            it("cannot access variables defined by subexpressions", function() {
              let testcases = [
                {
                  grammar: "start = (a:'a') { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')? { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')* { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')+ { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')| .. | { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')|0.. | { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')|1.. | { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')|2.. | { return a; }",
                  input: "aa"
                },
                {
                  grammar: "start = (a:'a')| ..1| { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')| ..3| { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = (a:'a')|2..3| { return a; }",
                  input: "aa"
                },
                {
                  grammar: "start = (a:'a')|3| { return a; }",
                  input: "aaa"
                },
                {
                  grammar: "start = $(a:'a') { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = &(a:'a') 'a' { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = !(a:'a') 'b' { return a; }",
                  input: "b"
                },
                {
                  grammar: "start = b:(a:'a') { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = ('a' b:'b' 'c') { return b; }",
                  input: "abc"
                },
                {
                  grammar: "start = (a:'a' { return a; }) { return a; }",
                  input: "a"
                },
                {
                  grammar: "start = ('a' / b:'b' / 'c') { return b; }",
                  input: "b"
                }
              ];

              testcases.forEach(testcase => {
                let parser = peg.generate(testcase.grammar, options);
                expect(parser).to.failToParse(testcase.input);
              });
            });
          });

          describe("in outer sequence", function() {
            it("can access variables defined by preceding labeled elements", function() {
              let parser = peg.generate(
                "start = a:'a' ('b' { return a; })",
                options
              );

              expect(parser).to.parse("ab", ["a", "a"]);
            });

            it("cannot access variable defined by labeled action element", function() {
              let parser = peg.generate(
                "start = 'a' b:('b' { return b; }) c:'c'",
                options
              );

              expect(parser).to.failToParse("abc");
            });

            it("cannot access variables defined by following labeled elements", function() {
              let parser = peg.generate(
                "start = ('a' { return b; }) b:'b'",
                options
              );

              expect(parser).to.failToParse("ab");
            });
          });
        });

        describe("initializer variables & functions", function() {
          it("can access variables defined in the initializer", function() {
            let parser = peg.generate([
              "{ var v = 42 }",
              "start = 'a' { return v; }"
            ].join("\n"), options);

            expect(parser).to.parse("a", 42);
          });

          it("can access functions defined in the initializer", function() {
            let parser = peg.generate([
              "{ function f() { return 42; } }",
              "start = 'a' { return f(); }"
            ].join("\n"), options);

            expect(parser).to.parse("a", 42);
          });
        });

        describe("available variables & functions", function() {
          it("|options| contains options", function() {
            let parser = peg.generate(
              "start = 'a' { return options; }",
              options
            );

            expect(parser).to.parse("a", { a: 42 }, { a: 42 });
          });

          it("|text| returns text matched by the expression", function() {
            let parser = peg.generate(
              "start = 'a' { return state.text(); }",
              options
            );

            expect(parser).to.parse("a", "a");
          });

          it("|location| returns location info of the expression", function() {
            let parser = peg.generate([
              "{ var result; }",
              "start = line (nl+ line)* { return result; }",
              "line = thing (' '+ thing)*",
              "thing = digit / mark",
              "digit = [0-9]",
              "mark = 'x' { result = state.location(); }",
              "nl = '\\r'? '\\n'"
            ].join("\n"), options);

            expect(parser).to.parse("1\n2\n\n3\n\n\n4 5 x", {
              source: undefined,
              start: { offset: 13, line: 7, column: 5 },
              end: { offset: 14, line: 7, column: 6 }
            });

            // Newline representations
            expect(parser).to.parse("1\nx", {     // Unix
              source: undefined,
              start: { offset: 2, line: 2, column: 1 },
              end: { offset: 3, line: 2, column: 2 }
            });
            expect(parser).to.parse("1\r\nx", {   // Windows
              source: undefined,
              start: { offset: 3, line: 2, column: 1 },
              end: { offset: 4, line: 2, column: 2 }
            });
          });

          describe("|expected|", function() {
            it("terminates parsing and throws an exception", function() {
              let parser = peg.generate(
                "start = 'a' { state.expected('a'); }",
                options
              );

              expect(parser).to.failToParse("a", {
                message: "Expected a but \"a\" found.",
                expected: [{ type: "user", description: "a" }],
                found: "a",
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 }
                }
              });
            });

            it("allows to set custom location info", function() {
              let parser = peg.generate([
                "start = 'a' {",
                "  state.expected('a', {",
                "    start: { offset: 1, line: 1, column: 2 },",
                "    end: { offset: 2, line: 1, column: 3 }",
                "  });",
                "}"
              ].join("\n"), options);

              expect(parser).to.failToParse("a", {
                message: "Expected a but \"a\" found.",
                expected: [{ type: "user", description: "a" }],
                found: "a",
                location: {
                  start: { offset: 1, line: 1, column: 2 },
                  end: { offset: 2, line: 1, column: 3 }
                }
              });
            });
          });

          describe("|error|", function() {
            it("terminates parsing and throws an exception", function() {
              let parser = peg.generate(
                "start = 'a' { state.error('a'); }",
                options
              );

              expect(parser).to.failToParse("a", {
                message: "a",
                found: null,
                expected: null,
                location: {
                  source: undefined,
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 }
                }
              });
            });

            it("allows to set custom location info", function() {
              let parser = peg.generate([
                "start = 'a' {",
                "  state.error('a', {",
                "    start: { offset: 1, line: 1, column: 2 },",
                "    end: { offset: 2, line: 1, column: 3 }",
                "  });",
                "}"
              ].join("\n"), options);

              expect(parser).to.failToParse("a", {
                message: "a",
                expected: null,
                found: null,
                location: {
                  start: { offset: 1, line: 1, column: 2 },
                  end: { offset: 2, line: 1, column: 3 }
                }
              });
            });
          });
        });
      });

      describe("when the expression doesn't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = 'a' { return 42; }", options);

          expect(parser).to.failToParse("b");
        });

        it("doesn't execute the code", function() {
          let parser = peg.generate(
            "start = 'a' { throw 'Boom!'; } / 'b'",
            options
          );

          expect(parser).to.parse("b");
        });
      });
    });

    describe("choice", function() {
      describe("when any expression matches", function() {
        it("returns its match result", function() {
          let parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.parse("a", "a");
          expect(parser).to.parse("b", "b");
          expect(parser).to.parse("c", "c");
        });
      });

      describe("when all expressions don't match", function() {
        it("reports match failure", function() {
          let parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.failToParse("d");
        });
      });
    });

    describe("error reporting", function() {
      describe("behavior", function() {
        it("reports only the rightmost error", function() {
          let parser = peg.generate("start = 'a' 'b' / 'a' 'c' 'd'", options);

          expect(parser).to.failToParse("ace", {
            expected: [{ type: "literal", text: "d", ignoreCase: false }]
          });
        });
      });

      describe("expectations reporting", function() {
        it("reports expectations correctly with no alternative", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("ab", {
            expected: [{ type: "end" }]
          });
        });

        it("reports expectations correctly with one alternative", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            expected: [{ type: "literal", text: "a", ignoreCase: false }]
          });
        });

        it("reports expectations correctly with multiple alternatives", function() {
          let parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.failToParse("d", {
            expected: [
              { type: "literal", text: "a", ignoreCase: false },
              { type: "literal", text: "b", ignoreCase: false },
              { type: "literal", text: "c", ignoreCase: false }
            ]
          });
        });
      });

      describe("found string reporting", function() {
        it("reports found string correctly at the end of input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("", { found: null });
        });

        it("reports found string correctly in the middle of input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", { found: "b" });
        });
      });

      describe("message building", function() {
        it("builds message correctly with no alternative", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("ab", {
            message: "Expected end of input but \"b\" found."
          });
        });

        it("builds message correctly with one alternative", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            message: "Expected \"a\" but \"b\" found."
          });
        });

        it("builds message correctly with multiple alternatives", function() {
          let parser = peg.generate("start = 'a' / 'b' / 'c'", options);

          expect(parser).to.failToParse("d", {
            message: "Expected \"a\", \"b\", or \"c\" but \"d\" found."
          });
        });

        it("builds message correctly at the end of input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("", {
            message: "Expected \"a\" but end of input found."
          });
        });

        it("builds message correctly in the middle of input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            message: "Expected \"a\" but \"b\" found."
          });
        });

        it("removes duplicates from expectations", function() {
          let parser = peg.generate("start = 'a' / 'a'", options);

          expect(parser).to.failToParse("b", {
            message: "Expected \"a\" but \"b\" found."
          });
        });

        it("sorts expectations", function() {
          let parser = peg.generate("start = 'c' / 'b' / 'a'", options);

          expect(parser).to.failToParse("d", {
            message: "Expected \"a\", \"b\", or \"c\" but \"d\" found."
          });
        });
      });

      describe("position reporting", function() {
        it("reports position correctly at the end of input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("", {
            location: {
              source: undefined,
              start: { offset: 0, line: 1, column: 1 },
              end: { offset: 0, line: 1, column: 1 }
            }
          });
        });

        it("reports position correctly in the middle of input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("b", {
            location: {
              source: undefined,
              start: { offset: 0, line: 1, column: 1 },
              end: { offset: 1, line: 1, column: 2 }
            }
          });
        });

        it("reports position correctly with trailing input", function() {
          let parser = peg.generate("start = 'a'", options);

          expect(parser).to.failToParse("aa", {
            location: {
              source: undefined,
              start: { offset: 1, line: 1, column: 2 },
              end: { offset: 2, line: 1, column: 3 }
            }
          });
        });

        it("reports position correctly in complex cases", function() {
          let parser = peg.generate([
            "start = line (nl+ line)*",
            "line = digit (' '+ digit)*",
            "digit = [0-9]",
            "nl = '\\r'? '\\n'"
          ].join("\n"), options);

          expect(parser).to.failToParse("1\n2\n\n3\n\n\n4 5 x", {
            location: {
              source: undefined,
              start: { offset: 13, line: 7, column: 5 },
              end: { offset: 14, line: 7, column: 6 }
            }
          });

          // Newline representations
          expect(parser).to.failToParse("1\nx", {     // Old Mac
            location: {
              source: undefined,
              start: { offset: 2, line: 2, column: 1 },
              end: { offset: 3, line: 2, column: 2 }
            }
          });
          expect(parser).to.failToParse("1\r\nx", {   // Windows
            location: {
              source: undefined,
              start: { offset: 3, line: 2, column: 1 },
              end: { offset: 4, line: 2, column: 2 }
            }
          });
        });

        it("reports location source correctly", function() {
          let source = { source: "object" };
          let parser = peg.generate([
            "start = line (nl+ line)*",
            "line = digit (' '+ digit)*",
            "digit = [0-9]",
            "nl = '\\r'? '\\n'"
          ].join("\n"), options);

          expect(parser).to.failToParse("1\n2\n\n3\n\n\n4 5 x", {
            location: {
              source,
              start: { offset: 13, line: 7, column: 5 },
              end: { offset: 14, line: 7, column: 6 }
            }
          }, { source });
        });
      });
    });

    // Following examples are from Wikipedia, see
    // http://en.wikipedia.org/w/index.php?title=Parsing_expression_grammar&oldid=335106938.
    describe("complex examples", function() {
      it("handles arithmetics example correctly", function() {
        // Value   ← [0-9]+ / '(' Expr ')'
        // Product ← Value (('*' / '/') Value)*
        // Sum     ← Product (('+' / '-') Product)*
        // Expr    ← Sum
        let parser = peg.generate([
          "Expr = Sum",
          "Sum = head:Product tail:(('+' / '-') Product)* {",
          "        return tail.reduce(function(result, element) {",
          "          if (element[0] === '+') { return result + element[1]; }",
          "          if (element[0] === '-') { return result - element[1]; }",
          "        }, head);",
          "      }",
          "Product = head:Value tail:(('*' / '/') Value)* {",
          "            return tail.reduce(function(result, element) {",
          "              if (element[0] === '*') { return result * element[1]; }",
          "              if (element[0] === '/') { return result / element[1]; }",
          "            }, head);",
          "          }",
          "Value = digits:[0-9]+     { return parseInt(digits.join(''), 10); }",
          "      / '(' expr:Expr ')' { return expr; }"
        ].join("\n"), options);

        // The "value" rule
        expect(parser).to.parse("0",       0);
        expect(parser).to.parse("123",     123);
        expect(parser).to.parse("(42+43)", 42 + 43);

        // The "product" rule
        expect(parser).to.parse("42",          42);
        expect(parser).to.parse("42*43",       42 * 43);
        expect(parser).to.parse("42*43*44*45", 42 * 43 * 44 * 45);
        expect(parser).to.parse("42/43",       42 / 43);
        expect(parser).to.parse("42/43/44/45", 42 / 43 / 44 / 45);

        // The "sum" rule
        expect(parser).to.parse("42*43",                   42 * 43);
        expect(parser).to.parse("42*43+44*45",             42 * 43 + 44 * 45);
        expect(parser).to.parse("42*43+44*45+46*47+48*49", 42 * 43 + 44 * 45 + 46 * 47 + 48 * 49);
        expect(parser).to.parse("42*43-44*45",             42 * 43 - 44 * 45);
        expect(parser).to.parse("42*43-44*45-46*47-48*49", 42 * 43 - 44 * 45 - 46 * 47 - 48 * 49);

        // The "expr" rule
        expect(parser).to.parse("42+43", 42 + 43);

        // Complex test
        expect(parser).to.parse("(1+2)*(3+4)", (1 + 2) * (3 + 4));
      });

      it("handles non-context-free language correctly", function() {
        // The following parsing expression grammar describes the classic
        // non-context-free language { a^n b^n c^n : n >= 1 }:
        //
        // S ← &(A c) a+ B !(a/b/c)
        // A ← a A? b
        // B ← b B? c
        let parser = peg.generate([
          "S = &(A 'c') a:'a'+ B:B !('a' / 'b' / 'c') { return a.join('') + B; }",
          "A = a:'a' A:A? b:'b' { return [a, A, b].join(''); }",
          "B = b:'b' B:B? c:'c' { return [b, B, c].join(''); }"
        ].join("\n"), options);

        expect(parser).to.parse("abc",       "abc");
        expect(parser).to.parse("aaabbbccc", "aaabbbccc");
        expect(parser).to.failToParse("aabbbccc");
        expect(parser).to.failToParse("aaaabbbccc");
        expect(parser).to.failToParse("aaabbccc");
        expect(parser).to.failToParse("aaabbbbccc");
        expect(parser).to.failToParse("aaabbbcc");
        expect(parser).to.failToParse("aaabbbcccc");
      });

      it("handles nested comments example correctly", function() {
        // Begin ← "(*"
        // End ← "*)"
        // C ← Begin N* End
        // N ← C / (!Begin !End Z)
        // Z ← any single character
        let parser = peg.generate([
          "C = begin:Begin ns:N* end:End { return begin + ns.join('') + end; }",
          "N = C",
          "  / !Begin !End z:Z { return z; }",
          "Z = .",
          "Begin = '(*'",
          "End = '*)'"
        ].join("\n"), options);

        expect(parser).to.parse("(**)",     "(**)");
        expect(parser).to.parse("(*abc*)",  "(*abc*)");
        expect(parser).to.parse("(*(**)*)", "(*(**)*)");
        expect(parser).to.parse(
          "(*abc(*def*)ghi(*(*(*jkl*)*)*)mno*)",
          "(*abc(*def*)ghi(*(*(*jkl*)*)*)mno*)"
        );
      });
    });
  });
});
