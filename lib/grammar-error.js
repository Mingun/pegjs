"use strict";

var classes = require("./utils/classes");

/* Thrown when the grammar contains an error. */
function GrammarError(message, problems) {
  this.name = "GrammarError";
  this.message = message;
  this.problems = problems;

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, GrammarError);
  }
}

classes.subclass(GrammarError, Error);

module.exports = GrammarError;
