#!/usr/bin/env node

"use strict";

let fs = require("fs");
let peg = require("../lib/peg");
let options = require("./options");

// Helpers

function readStream(inputStream, callback) {
  let input = "";
  inputStream.on("data", data => { input += data; });
  inputStream.on("end", () => { callback(input); });
}

function abort(message) {
  console.error(message);
  process.exit(1);
}

// Main

let inputStream, outputStream;

if (options.source === null) {
  process.stdin.resume();
  inputStream = process.stdin;
} else {
  inputStream = fs.createReadStream(options.source);
  inputStream.on("error", () => {
    abort(`Can't read from file "${options.source}".`);
  });
}

if (options.outputFile === null) {
  outputStream = process.stdout;
} else {
  outputStream = fs.createWriteStream(options.outputFile);
  outputStream.on("error", () => {
    abort(`Can't write to file "${options.outputFile}".`);
  });
}

readStream(inputStream, input => {
  let location, source;

  try {
    source = peg.generate(input, options);
  } catch (e) {
    if (e.location !== undefined) {
      location = e.location.start;
      abort(location.line + ":" + location.column + ": " + e.message);
    } else {
      abort(e);
    }
  }

  outputStream.write(source);
  if (outputStream !== process.stdout) {
    outputStream.end();
  }
});

