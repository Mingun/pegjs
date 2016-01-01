"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../lib/compiler/passes/report-infinite-recursion");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |reportInfiniteRecursion|", function() {
  it("reports direct left recursion", function() {
    expect(pass).to.reportError("start = start", {
      message: "Possible infinite loop when parsing (left recursion: start -> start).",
      location: {
        start: { offset: 8, line: 1, column: 9 },
        end: { offset: 13, line: 1, column: 14 }
      }
    });
  });

  it("reports indirect left recursion", function() {
    expect(pass).to.reportError([
      "start = stop",
      "stop = start"
    ].join("\n"), {
      message: "Possible infinite loop when parsing (left recursion: start -> stop -> start).",
      location: {
        start: { offset: 20, line: 2, column: 8 },
        end: { offset: 25, line: 2, column: 13 }
      }
    });
  });

  describe("in sequences", function() {
    it("reports left recursion if all preceding elements match empty string", function() {
      expect(pass).to.reportError("start = '' '' '' start");
    });

    it("doesn't report left recursion if some preceding element doesn't match empty string", function() {
      expect(pass).to.not.reportError("start = 'a' '' '' start");
      expect(pass).to.not.reportError("start = '' 'a' '' start");
      expect(pass).to.not.reportError("start = '' '' 'a' start");
    });

    // Regression test for #359.
    it("reports left recursion when rule reference is wrapped in an expression", function() {
      expect(pass).to.reportError("start = '' start?");
    });

    it("computes expressions that always consume input on success correctly", function() {
      expect(pass).to.reportError([
        "start = a start",
        "a 'a' = ''"
      ].join("\n"));
      expect(pass).to.not.reportError([
        "start = a start",
        "a 'a' = 'a'"
      ].join("\n"));

      expect(pass).to.reportError("start = ('' / 'a' / 'b') start");
      expect(pass).to.reportError("start = ('a' / '' / 'b') start");
      expect(pass).to.reportError("start = ('a' / 'b' / '') start");
      expect(pass).to.not.reportError("start = ('a' / 'b' / 'c') start");

      expect(pass).to.reportError("start = ('' { }) start");
      expect(pass).to.not.reportError("start = ('a' { }) start");

      expect(pass).to.reportError("start = ('' '' '') start");
      expect(pass).to.not.reportError("start = ('a' '' '') start");
      expect(pass).to.not.reportError("start = ('' 'a' '') start");
      expect(pass).to.not.reportError("start = ('' '' 'a') start");

      expect(pass).to.reportError("start = a:'' start");
      expect(pass).to.not.reportError("start = a:'a' start");

      expect(pass).to.reportError("start = $'' start");
      expect(pass).to.not.reportError("start = $'a' start");

      expect(pass).to.reportError("start = &'' start");
      expect(pass).to.reportError("start = &'a' start");

      expect(pass).to.reportError("start = !'' start");
      expect(pass).to.reportError("start = !'a' start");

      expect(pass).to.reportError("start = ''? start");
      expect(pass).to.reportError("start = 'a'? start");

      expect(pass).to.reportError("start = ''* start");
      expect(pass).to.reportError("start = 'a'* start");

      expect(pass).to.reportError("start = ''+ start");
      expect(pass).to.not.reportError("start = 'a'+ start");

      expect(pass).to.reportError("start = ('') start");
      expect(pass).to.not.reportError("start = ('a') start");

      expect(pass).to.reportError("start = &{ } start");

      expect(pass).to.reportError("start = !{ } start");

      expect(pass).to.reportError([
        "start = a start",
        "a = ''"
      ].join("\n"));
      expect(pass).to.not.reportError([
        "start = a start",
        "a = 'a'"
      ].join("\n"));

      expect(pass).to.reportError("start = '' start");
      expect(pass).to.not.reportError("start = 'a' start");

      expect(pass).to.not.reportError("start = [a-d] start");

      expect(pass).to.not.reportError("start = . start");
    });
  });

  describe("in templates", function() {
    it("reports left recursion for template argument", function() {
      expect(pass).to.reportError("start<A> = start<A> 'a' 'b'", {
        message: "Possible infinite loop when parsing (left recursion: start -> start).",
        location: {
          start: { offset: 11, line: 1, column: 12 },
          end:   { offset: 19, line: 1, column: 20 }
        }
      });
      expect(pass).to.reportError([
        "start = template<start> 'a'",
        "template<A> = A 'b'"
      ].join("\n"), {
        message: "Possible infinite loop when parsing (left recursion: start -> template -> start).",
        location: {
          start: { offset: 17, line: 1, column: 18 },
          end:   { offset: 22, line: 1, column: 23 }
        }
      });
      expect(pass).to.reportError([
        "start = T1<T2<start>>",
        "T1<A> = A 'a'",
        "T2<B> = B 'b'"
      ].join("\n"), {
        message: "Possible infinite loop when parsing (left recursion: start -> T1 -> T2 -> start).",
        location: {
          start: { offset: 14, line: 1, column: 15 },
          end:   { offset: 19, line: 1, column: 20 }
        }
      });

      expect(pass).to.not.reportError([
        "start = template<start> 'a'",
        "template<A> = 'b' A"
      ].join("\n"));
      expect(pass).to.not.reportError([
        "start = template<'b' start> 'a'",
        "template<A> = A 'b'"
      ].join("\n"));
    });
  });
});
