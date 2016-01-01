"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../lib/compiler/passes/report-undefined-rules");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |reportUndefinedRules|", function() {
  it("reports undefined rules", function() {
    expect(pass).to.reportError("start = undefined", {
      message: "Rule \"undefined\" is not defined.",
      location: {
        start: { offset: 8, line: 1, column: 9 },
        end: { offset: 17, line: 1, column: 18 }
      }
    });
    expect(pass).to.reportError("start<nonundefined> = undefined", {
      message: "Rule \"undefined\" is not defined.",
      location: {
        start: { offset: 22, line: 1, column: 23 },
        end:   { offset: 31, line: 1, column: 32 }
      }
    });
  });

  it("not reports undefined rules for template params", function() {
    expect(pass).to.not.reportError("start<nonundefined> = nonundefined");
  });

  it("checks allowedStartRules", function() {
    expect(pass).to.reportError("start = 'a'", {
      message: "Start rule \"missing\" is not defined."
    }, {
      allowedStartRules: ["missing"]
    });
  });
});
