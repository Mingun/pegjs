"use strict";

let chai = require("chai");
let peg = require("../../../lib/peg");
let sinon = require("sinon");

chai.use(require("chai-like"));

let expect = chai.expect;

describe("PEG.js API", function() {
  describe("generate", function() {
    it("generates a parser", function() {
      let parser = peg.generate("start = 'a'");

      expect(parser).to.be.an("object");
      expect(parser.parse("a")).to.equal("a");
    });

    it("throws an exception on syntax error", function() {
      expect(() => { peg.generate("start = @"); }).to.throw();
    });

    it("throws an exception on semantic error", function() {
      expect(() => { peg.generate("start = undefined"); }).to.throw();
    });

    describe("allowed start rules", function() {
      let grammar = [
        "a = 'x'",
        "b = 'x'",
        "c = 'x'"
      ].join("\n");

      it("throws an error on missing rule", function() {
        expect(() => peg.generate(grammar, {
          allowedStartRules: ["missing"]
        })).to.throw();
      });

      describe("when |allowedStartRules| is not set", function() {
        it("generated parser can start only from the first rule", function() {
          let parser = peg.generate(grammar);

          expect(parser.parse("x", { startRule: "a" })).to.equal("x");
          expect(() => { parser.parse("x", { startRule: "b" }); }).to.throw();
          expect(() => { parser.parse("x", { startRule: "c" }); }).to.throw();
        });
      });

      describe("when |allowedStartRules| is set", function() {
        it("generated parser can start only from specified rules", function() {
          let parser = peg.generate(grammar, {
            allowedStartRules: ["b", "c"]
          });

          expect(() => { parser.parse("x", { startRule: "a" }); }).to.throw();
          expect(parser.parse("x", { startRule: "b" })).to.equal("x");
          expect(parser.parse("x", { startRule: "c" })).to.equal("x");
        });
      });
    });

    describe("intermediate results caching", function() {
      let grammar = [
        "{ var n = 0; }",
        "start = (a 'b') / (a 'c') { return n; }",
        "a = 'a' { n++; }"
      ].join("\n");

      describe("when |cache| is not set", function() {
        it("generated parser doesn't cache intermediate parse results", function() {
          let parser = peg.generate(grammar);

          expect(parser.parse("ac")).to.equal(2);
        });
      });

      describe("when |cache| is set to |false|", function() {
        it("generated parser doesn't cache intermediate parse results", function() {
          let parser = peg.generate(grammar, { cache: false });

          expect(parser.parse("ac")).to.equal(2);
        });
      });

      describe("when |cache| is set to |true|", function() {
        it("generated parser caches intermediate parse results", function() {
          let parser = peg.generate(grammar, { cache: true });

          expect(parser.parse("ac")).to.equal(1);
        });
      });
    });

    describe("tracing", function() {
      let grammar = "start = 'a'";

      describe("when |trace| is not set", function() {
        it("generated parser doesn't trace", function() {
          let parser = peg.generate(grammar);
          let tracer = { trace: sinon.spy() };

          parser.parse("a", { tracer: tracer });

          expect(tracer.trace.called).to.equal(false);
        });
      });

      describe("when |trace| is set to |false|", function() {
        it("generated parser doesn't trace", function() {
          let parser = peg.generate(grammar, { trace: false });
          let tracer = { trace: sinon.spy() };

          parser.parse("a", { tracer: tracer });

          expect(tracer.trace.called).to.equal(false);
        });
      });

      describe("when |trace| is set to |true|", function() {
        it("generated parser traces", function() {
          let parser = peg.generate(grammar, { trace: true });
          let tracer = { trace: sinon.spy() };

          parser.parse("a", { tracer: tracer });

          expect(tracer.trace.called).to.equal(true);
        });
      });
    });

    describe("output", function() {
      let grammar = "start = 'a'";

      describe("when |output| is not set", function() {
        it("returns generated parser object", function() {
          let parser = peg.generate(grammar);

          expect(parser).to.be.an("object");
          expect(parser.parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"parser\"|", function() {
        it("returns generated parser object", function() {
          let parser = peg.generate(grammar, { output: "parser" });

          expect(parser).to.be.an("object");
          expect(parser.parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"source\"|", function() {
        it("returns generated parser source code", function() {
          let source = peg.generate(grammar, { output: "source" });

          expect(source).to.be.a("string");
          expect(eval(source).parse("a")).to.equal("a");
        });
      });

      describe("when |output| is set to |\"ast\"|", function() {
        it("returns generated parser AST", function() {
          let ast = peg.generate(grammar, { output: "ast" });

          expect(ast).to.be.an("object");
          expect(ast).to.be.like(peg.parser.parse(grammar));
        });
      });

      describe("when |output| is set to array of outputs", function() {
        it("returns object with keys of array", function() {
          let result = peg.generate(grammar, { output: ["parser", "source", "ast"] });

          expect(result).to.be.an("object").that.have.all.keys("parser", "source", "ast");

          expect(result.parser).to.be.an("object");
          expect(result.parser.parse("a")).to.equal("a");

          expect(result.source).to.be.a("string");
          expect(eval(result.source).parse("a")).to.equal("a");

          expect(result.ast).to.be.an("object");
          expect(result.ast).to.be.like(peg.parser.parse(grammar));
        });
      });
    });

    // The |format|, |exportVars|, and |dependencies| options are not tested
    // becasue there is no meaningful way to thest their effects without turning
    // this into an integration test.

    // The |plugins| option is tested in plugin API tests.

    describe("reserved words", function() {
      const RESERVED_WORDS_JS = [
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "debugger",
        "default",
        "delete",
        "do",
        "else",
        "enum",
        "export",
        "extends",
        "false",
        "finally",
        "for",
        "function",
        "if",
        "import",
        "instanceof",
        "in",
        "new",
        "null",
        "return",
        "super",
        "switch",
        "this",
        "throw",
        "true",
        "try",
        "typeof",
        "var",
        "void",
        "while",
        "with"
      ];

      describe("throws an exception on reserved JS words used as labels", function() {
        for (let label of RESERVED_WORDS_JS) {
          it(label, function() {
            expect(() => {
              peg.generate([
                "start = " + label + ":end",
                "end = 'a'"
              ].join("\n"), { output: "source" });
            }).to.throw(peg.parser.SyntaxError);
          });
        }
      });

      describe("not throws an exception on reserved JS words used as rule name", function() {
        for (let rule of RESERVED_WORDS_JS) {
          it(rule, function() {
            expect(() => {
              peg.generate([
                "start = " + rule,
                rule + " = 'a'"
              ].join("\n"), { output: "source" });
            }).to.not.throw(peg.parser.SyntaxError);
          });
        }
      });
    });

    it("accepts custom options", function() {
      peg.generate("start = 'a'", { foo: 42 });
    });
  });
});
