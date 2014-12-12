"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../../lib/compiler/passes/report-infinite-recursion");

chai.use(helpers);

let expect = chai.expect;

function check(test, message) {
  let offset = test.offset;
  expect(pass).to.reportError(test.grammar, {
    message: message,
    location: {
      start: { offset: offset,     line: 1, column: offset + 1     },
      end:   { offset: offset + 5, line: 1, column: offset + 1 + 5 }
    }
  });
}

describe("compiler pass |reportInfiniteRecursion|", function() {
  it("reports direct left recursion", function() {
    let tests = [
      { grammar: "start = start;",      offset: 8 },  // rule_ref
      { grammar: "start 'a' = start;",  offset: 12 }, // named
      { grammar: "start = 'a'? start;", offset: 13 }, // optional
      { grammar: "start = 'a'* start;", offset: 13 }, // zero_or_more
      { grammar: "start = !'a' start;", offset: 13 }, // simple_not
      { grammar: "start = &'a' start;", offset: 13 }, // simple_and
      { grammar: "start = !{} start;",  offset: 12 }, // semantic_not
      { grammar: "start = &{} start;",  offset: 12 }, // semantic_and
      { grammar: "start = '' start;",   offset: 11 }, // empty literal match empty input
      { grammar: "start = ![] start;",  offset: 12 }, // empty class not math anything, negation match empty input
      { grammar: "start = !. start;",   offset: 11 }  // not any match empty input
    ];
    for (let i = 0; i < tests.length; ++i) {
      check(tests[i], "Possible infinite loop when parsing (left recursion: start -> start).");
    }
  });

  it("reports indirect left recursion", function() {
    let tests = [
      { grammar: "start = stop; stop = start;",      offset: 21 },  // rule_ref
      { grammar: "start 'a' = stop; stop = start;",  offset: 25 }, // named
      { grammar: "start = stop; stop = 'a'? start;", offset: 26 }, // optional
      { grammar: "start = stop; stop = 'a'* start;", offset: 26 }, // zero_or_more
      { grammar: "start = stop; stop = !'a' start;", offset: 26 }, // simple_not
      { grammar: "start = stop; stop = &'a' start;", offset: 26 }, // simple_and
      { grammar: "start = stop; stop = !{} start;",  offset: 25 }, // semantic_not
      { grammar: "start = stop; stop = &{} start;",  offset: 25 }, // semantic_and
      { grammar: "start = stop; stop = '' start;",   offset: 24 }, // empty literal match empty input
      { grammar: "start = stop; stop = ![] start;",  offset: 25 }, // empty class not math anything, negation match empty input
      { grammar: "start = stop; stop = !. start;",   offset: 24 }  // not any match empty input
    ];
    for (let i = 0; i < tests.length; ++i) {
      check(tests[i], "Possible infinite loop when parsing (left recursion: start -> stop -> start).");
    }
  });

  describe("in sequences", function() {
    it("doesn't report left recursion if some preceding element consume input", function() {
      let tests = [
        "start = 'a' start 'b'",
        "start = 'a' 'b' start",
        "start = 'a'+ start",
        "start = [a] start",
        "start = [a-d] start",
        "start = $'a' start",
        "start = . start",
        "start = stop; stop = 'a' start",
        "start = (. {}) start",
        "start = (!{} .) start",
        "start = (&{} .) start"
      ];
      for (let i = 0; i < tests.length; ++i) {
        expect(pass).to.not.reportError(tests[i]);
      }
    });

    // Regression test for #359.
    it("reports left recursion when rule reference is wrapped in an expression", function() {
      let tests = [
        { grammar: "start = start 'a';",   offset:  8 }, // sequence
        { grammar: "start = start {};",    offset:  8 }, // action
        { grammar: "start = (start .) .;", offset:  9 }, // group
        { grammar: "start = a:start;",     offset: 10 }, // label
        { grammar: "start = start?;",      offset:  8 }, // optional
        { grammar: "start = start*;",      offset:  8 }, // zero_or_more
        { grammar: "start = start+;",      offset:  8 }, // one_or_more
        { grammar: "start = $start;",      offset:  9 }, // text
        { grammar: "start = !start;",      offset:  9 }, // simple_not
        { grammar: "start = &start;",      offset:  9 }, // simple_and
        { grammar: "start = start / 'a';", offset:  8 }, // choice - first
        { grammar: "start = 'a' / start;", offset: 14 }  // choice - not first
      ];
      for (let i = 0; i < tests.length; ++i) {
        check(tests[i], "Possible infinite loop when parsing (left recursion: start -> start).");
      }
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

      expect(pass).to.reportError("start = ''| .. | start");
      expect(pass).to.reportError("start = ''|0.. | start");
      expect(pass).to.reportError("start = ''|1.. | start");
      expect(pass).to.reportError("start = ''|2.. | start");
      expect(pass).to.reportError("start = ''| ..1| start");
      expect(pass).to.reportError("start = ''| ..3| start");
      expect(pass).to.reportError("start = ''|2..3| start");
      expect(pass).to.reportError("start = ''| 42 | start");

      expect(pass).to.reportError("start = 'a'| .. | start");
      expect(pass).to.reportError("start = 'a'|0.. | start");
      expect(pass).to.not.reportError("start = 'a'|1.. | start");
      expect(pass).to.not.reportError("start = 'a'|2.. | start");
      expect(pass).to.reportError("start = 'a'| ..1| start");
      expect(pass).to.reportError("start = 'a'| ..3| start");
      expect(pass).to.not.reportError("start = 'a'|2..3| start");
      expect(pass).to.not.reportError("start = 'a'| 42 | start");

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

  describe("in range with delimiter", function() {
    it("doesn't report left recursion for delimiter if expression not match empty string", function() {
      expect(pass).to.not.reportError("start = 'a'| .. , start|");
      expect(pass).to.not.reportError("start = 'a'|0.. , start|");
      expect(pass).to.not.reportError("start = 'a'|1.. , start|");
      expect(pass).to.not.reportError("start = 'a'|2.. , start|");
      expect(pass).to.not.reportError("start = 'a'| ..3, start|");
      expect(pass).to.not.reportError("start = 'a'|2..3, start|");
      expect(pass).to.not.reportError("start = 'a'| 42 , start|");
    });

    it("reports left recursion for delimiter if expression match empty string", function() {
      expect(pass).to.reportError("start = ''| .. , start|");
      expect(pass).to.reportError("start = ''|0.. , start|");
      expect(pass).to.reportError("start = ''|1.. , start|");
      expect(pass).to.reportError("start = ''|2.. , start|");
      expect(pass).to.reportError("start = ''| ..3, start|");
      expect(pass).to.reportError("start = ''|2..3, start|");
      expect(pass).to.reportError("start = ''| 42 , start|");
    });
  });

  it("not check imported rules", function() {
    expect(pass).to.not.reportError("start = #start");
    expect(pass).to.not.reportError("start = #start:start");

    expect(pass).to.not.reportError([
      "start = stop",
      "stop = #start"
    ].join("\n"));
    expect(pass).to.not.reportError([
      "start = stop",
      "stop = #start:start"
    ].join("\n"));
  });
});
