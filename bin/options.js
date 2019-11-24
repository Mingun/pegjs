"use strict";

let fs = require("fs");
let path = require("path");
let peg = require("../");

// Options

let inputFile = null;
let outputFile = null;

let options = {
  "--": [],
  "cache": false,
  "dependencies": {},
  "exportVar": null,
  "format": "commonjs",
  "output": "source",
  "plugins": [],
  "trace": false
};

const EXPORT_VAR_FORMATS = ["globals", "umd"];
const DEPENDENCY_FORMATS = ["amd", "commonjs", "es", "umd"];
const MODULE_FORMATS = ["amd", "bare", "commonjs", "es", "globals", "umd"];

// Helpers

function abort(message) {
  console.error(message);
  process.exit(1);
}

function addExtraOptions(json) {
  let extraOptions;

  try {
    extraOptions = JSON.parse(json);
  } catch (e) {
    if (!(e instanceof SyntaxError)) { throw e; }

    abort("Error parsing JSON: " + e.message);
  }
  if (typeof extraOptions !== "object") {
    abort("The JSON with extra options has to represent an object.");
  }

  Object
    .keys(extraOptions)
    .forEach(key => {
      options[key] = extraOptions[key];
    });
}

function formatChoicesList(list) {
  list = list.map(entry => `"${entry}"`);
  let lastOption = list.pop();

  return list.length === 0
    ? lastOption
    : list.join(", ") + " or " + lastOption;
}

function updateList(list, string) {
  string
    .split(",")
    .forEach(entry => {
      entry = entry.trim();
      if (list.indexOf(entry) === -1) {
        list.push(entry);
      }
    });
}

// Arguments

let args = process.argv.slice(2);

function nextArg(option) {
  if (args.length === 0) {
    abort(`Missing parameter of the ${option} option.`);
  }

  return args.shift();
}

// Parse Arguments

while (args.length > 0) {
  let json, mod;
  let argument = args.shift();

  if (argument.indexOf("-") === 0 && argument.indexOf("=") > 1) {
    argument = argument.split("=");
    args.unshift(argument.length > 2 ? argument.slice(1) : argument[1]);
    argument = argument[0];
  }

  switch (argument) {
    case "--":
      options["--"] = args;
      args = [];
      break;

    case "-a":
    case "--allowed-start-rules":
      if (!options.allowedStartRules) {
        options.allowedStartRules = [];
      }
      updateList(options.allowedStartRules, nextArg("--allowed-start-rules"));
      break;

    case "--cache":
      options.cache = true;
      break;

    case "--no-cache":
      options.cache = false;
      break;

    case "-d":
    case "--dependency":
      argument = nextArg("-d/--dependency");
      if (argument.indexOf(":") === -1) {
        mod = [argument, argument];
      } else {
        mod = argument.split(":");
        if (mod.length > 2) {
          mod[1] = mod.slice(1);
        }
      }
      options.dependencies[mod[0]] = mod[1];
      break;

    case "-e":
    case "--export-var":
      options.exportVar = nextArg("-e/--export-var");
      break;

    case "--extra-options":
      addExtraOptions(nextArg("--extra-options"));
      break;

    case "-c":
    case "--config":
    case "--extra-options-file":
      argument = nextArg("-c/--config/--extra-options-file");
      try {
        json = fs.readFileSync(argument, "utf8");
      } catch (e) {
        abort(`Can't read from file "${argument}".`);
      }
      addExtraOptions(json);
      break;

    case "-f":
    case "--format":
      argument = nextArg("-f/--format");
      if (MODULE_FORMATS.indexOf(argument) === -1) {
        abort(`Module format must be either ${formatChoicesList(MODULE_FORMATS)}.`);
      }
      options.format = argument;
      break;

    case "-h":
    case "--help":
      console.log(fs.readFileSync(path.join(__dirname, "usage.txt"), "utf8").trim());
      process.exit();
      break;

    case "-o":
    case "--output":
      outputFile = nextArg("-o/--output");
      break;

    case "-p":
    case "--plugin":
      argument = nextArg("-p/--plugin");
      try {
        mod = require(argument);
      } catch (ex1) {
        if (ex1.code !== "MODULE_NOT_FOUND") { throw ex1; }

        try {
          mod = require(path.resolve(argument));
        } catch (ex2) {
          if (ex2.code !== "MODULE_NOT_FOUND") { throw ex2; }

          abort(`Can't load module "${argument}".`);
        }
      }
      options.plugins.push(mod);
      break;

    case "--trace":
      options.trace = true;
      break;

    case "--no-trace":
      options.trace = false;
      break;

    case "-v":
    case "--version":
      console.log("PEG.js v" + peg.VERSION);
      process.exit();
      break;

    default:
      if (inputFile !== null) {
        abort(`Unknown option: "${argument}".`);
      }
      inputFile = argument;
  }
}

// Validation and defaults

if (Object.keys(options.dependencies).length > 0) {
  if (DEPENDENCY_FORMATS.indexOf(options.format) === -1) {
    abort(`Can't use the -d/--dependency option with the "${options.format}" module format.`);
  }
}

if (options.exportVar !== null) {
  if (EXPORT_VAR_FORMATS.indexOf(options.format) === -1) {
    abort(`Can't use the -e/--export-var option with the "${options.format}" module format.`);
  }
}

// Use null for standard input
if (inputFile === "-") {
  inputFile = null;
}

if (outputFile === null) {
  if (inputFile) {
    outputFile = inputFile.substr(0, inputFile.length - path.extname(inputFile).length) + ".js";
  }
}

// Use null for standard output
if (outputFile === "-") {
  outputFile = null;
}

// Export

options.inputFile = inputFile;
options.outputFile = outputFile;

module.exports = options;
