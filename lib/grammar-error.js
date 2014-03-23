"use strict";

// Thrown when the grammar contains an error.
class GrammarError {
  constructor(message, problems) {
    this.name = "GrammarError";
    this.message = message;
    this.problems = problems;

    // istanbul ignore else
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, GrammarError);
    }
  }
}

module.exports = GrammarError;
