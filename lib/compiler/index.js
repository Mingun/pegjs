"use strict";

let GrammarError = require("../grammar-error");
let calcReportFailures = require("./passes/calc-report-failures");
let generateBytecode = require("./passes/generate-bytecode");
let generateJS = require("./passes/generate-js");
let removeProxyRules = require("./passes/remove-proxy-rules");
let reportDuplicateLabels = require("./passes/report-duplicate-labels");
let reportAmbiguousLabels = require("./passes/report-ambiguous-labels");
let reportDuplicateRules = require("./passes/report-duplicate-rules");
let reportInfiniteRecursion = require("./passes/report-infinite-recursion");
let reportInfiniteRepetition = require("./passes/report-infinite-repetition");
let reportUndefinedRules = require("./passes/report-undefined-rules");
let inferenceMatchResult = require("./passes/inference-match-result");
let visitor = require("./visitor");

function processOptions(options, defaults) {
  let processedOptions = {};

  Object.keys(options).forEach(name => {
    processedOptions[name] = options[name];
  });

  Object.keys(defaults).forEach(name => {
    if (!Object.prototype.hasOwnProperty.call(processedOptions, name)) {
      processedOptions[name] = defaults[name];
    }
  });

  return processedOptions;
}

// istanbul ignore next
function chain(f1, f2) {
  return function(...args) {
    f1(...args);
    f2(...args);
  };
}

// istanbul ignore next
function merge(obj1, obj2) {
  if (obj1) {
    for (let f in obj1) {
      if (!Object.prototype.hasOwnProperty.call(obj1, f)
       || !Object.prototype.hasOwnProperty.call(obj2, f)
      ) {
        continue;
      }
      obj1[f] = chain(obj1[f], obj2[f]);
    }

    return obj1;
  }

  return obj2;
}

function makeObject(keys, iterator) {
  let result = {};

  keys.forEach(k => { result[k] = iterator(k); });

  return result;
}

let compiler = {
  // AST node visitor builder. Useful mainly for plugins which manipulate the
  // AST.
  visitor: visitor,

  // Compiler passes.
  //
  // Each pass is a function that is passed the AST. It can perform checks on it
  // or modify it as needed. If the pass encounters a semantic error, it throws
  // |peg.GrammarError|.
  passes: {
    check: {
      reportUndefinedRules: reportUndefinedRules,
      reportDuplicateRules: reportDuplicateRules,
      reportDuplicateLabels: reportDuplicateLabels,
      reportAmbiguousLabels: reportAmbiguousLabels,
      reportInfiniteRecursion: reportInfiniteRecursion,
      reportInfiniteRepetition: reportInfiniteRepetition
    },
    transform: {
      removeProxyRules: removeProxyRules
    },
    generate: {
      calcReportFailures: calcReportFailures,
      inferenceMatchResult: inferenceMatchResult,
      generateBytecode: generateBytecode,
      generateJS: generateJS
    }
  },

  // Generates a parser from a specified grammar AST. Throws |peg.GrammarError|
  // if the AST contains a semantic error. Note that not all errors are detected
  // during the generation and some may protrude to the generated parser and
  // cause its malfunction.
  compile(ast, passes, options) {
    function mapOutput(kind) {
      switch (kind) {
        case "parser": return eval(ast.code);
        case "source": return ast.code;
        case "ast"   : return ast;
        // istanbul ignore next
        default      : throw new Error("Invalid output format: " + kind + ".");
      }
    }
    options = options !== undefined ? options : {};

    options = processOptions(options, {
      allowedStartRules: [ast.rules[0].name],
      cache: false,
      dependencies: {},
      exportVar: null,
      format: "bare",
      optimize: "speed",
      output: "parser",
      trace: false
    });

    let problems = [];
    let errors = 0;
    let DEFAULT_COLLECTOR = {
      emitFatalError(...args) {
        // istanbul ignore next
        throw new GrammarError(...args);
      },
      emitError(...args) {
        ++errors;
        problems.push(["error", ...args]);
      },
      emitWarning(...args) {
        // istanbul ignore next
        problems.push(["warning", ...args]);
      },
      emitInfo(...args) {
        // istanbul ignore next
        problems.push(["info", ...args]);
      }
    };

    options.collector = merge(options.collector, DEFAULT_COLLECTOR);

    Object.keys(passes).forEach(stage => {
      // Clear array.
      problems.length = 0;
      errors = 0;

      options.collector.emitInfo("Process stage '" + stage + "'...");
      passes[stage].forEach((p, i) => {
        options.collector.emitInfo(" -> Process pass " + i);
        p(ast, options);
      });
      // Collect all errors by stage
      if (errors !== 0) {
        throw new GrammarError("Stage '" + stage + "' contains " + errors + " error(s).", problems);
      }
    });

    if (Array.isArray(options.output)) {
      return makeObject(options.output, mapOutput);
    }

    return mapOutput(options.output);
  }
};

module.exports = compiler;
