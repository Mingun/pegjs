"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../lib/compiler/passes/check-template-args");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |checkTemplateArgs|", function() {
  it("reports insufficient count of arguments", function() {
    expect(pass).to.reportError([
      "start = List<'.'>",
      "List<E, D> = E (D E)*"
    ].join("\n"), {
      message: "Insufficient count of template arguments for rule \"List\". Expected 2, found 1",
      location: {
        start: { offset:  8, line: 1, column:  9 },
        end:   { offset: 17, line: 1, column: 18 }
      }
    });
    expect(pass).to.reportError([
      "start = List<'.', ., start>",
      "List<E, D> = E (D E)*"
    ].join("\n"), {
      message: "Insufficient count of template arguments for rule \"List\". Expected 2, found 3",
      location: {
        start: { offset:  8, line: 1, column:  9 },
        end:   { offset: 27, line: 1, column: 28 }
      }
    });
    expect(pass).to.not.reportError([
      "start = List<'.', .>",
      "List<E, D> = E (D E)*"
    ].join("\n"));
  });

  it("not allow template arguments for template parameters", function() {
    expect(pass).to.reportError("Apply<E> = E<.>", {
      message: "Template paramater \"E\" of rule \"Apply\" can't accept template arguments",
      location: {
        start: { offset: 11, line: 1, column: 12 },
        end:   { offset: 15, line: 1, column: 16 }
      }
    });
    expect(pass).to.reportError("Apply<E, D> = E<D>", {
      message: "Template paramater \"E\" of rule \"Apply\" can't accept template arguments",
      location: {
        start: { offset: 14, line: 1, column: 15 },
        end:   { offset: 18, line: 1, column: 19 }
      }
    });
  });
});
