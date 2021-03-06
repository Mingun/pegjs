"use strict";

let asts = require("../asts");
let op = require("../opcodes");
let Stack = require("../stack");

function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

function stringEscape(s) {
  // ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
  // literal except for the closing quote character, backslash, carriage
  // return, line separator, paragraph separator, and line feed. Any character
  // may appear in the form of an escape sequence.
  //
  // For portability, we also escape all control and non-ASCII characters.
  return s
    .replace(/\\/g,   "\\\\")   // backslash
    .replace(/"/g,    "\\\"")   // closing double quote
    .replace(/\0/g,   "\\0")    // null
    .replace(/\x08/g, "\\b")    // backspace
    .replace(/\t/g,   "\\t")    // horizontal tab
    .replace(/\n/g,   "\\n")    // line feed
    .replace(/\v/g,   "\\v")    // vertical tab
    .replace(/\f/g,   "\\f")    // form feed
    .replace(/\r/g,   "\\r")    // carriage return
    .replace(/[\x00-\x0F]/g,          ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x"  + hex(ch))
    .replace(/[\u0100-\u0FFF]/g,      ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g,      ch => "\\u"  + hex(ch));
}

function regexpClassEscape(s) {
  // Based on ECMA-262, 5th ed., 7.8.5 & 15.10.1.
  //
  // For portability, we also escape all control and non-ASCII characters.
  return s
    .replace(/\\/g,   "\\\\")   // backslash
    .replace(/\//g,   "\\/")    // closing slash
    .replace(/]/g,    "\\]")    // closing bracket
    .replace(/\^/g,   "\\^")    // caret
    .replace(/-/g,    "\\-")    // dash
    .replace(/\0/g,   "\\0")    // null
    .replace(/\x08/g, "\\b")    // backspace
    .replace(/\t/g,   "\\t")    // horizontal tab
    .replace(/\n/g,   "\\n")    // line feed
    .replace(/\v/g,   "\\v")    // vertical tab
    .replace(/\f/g,   "\\f")    // form feed
    .replace(/\r/g,   "\\r")    // carriage return
    .replace(/[\x00-\x0F]/g,          ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x"  + hex(ch))
    .replace(/[\u0100-\u0FFF]/g,      ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g,      ch => "\\u"  + hex(ch));
}

// Generates parser JavaScript code.
function generateJS(ast, options) {
  /* These only indent non-empty lines to avoid trailing whitespace. */
  const lineMatchRE = /^([^`\r\n]+?(?:`[^`]*?`[^\r\n]*?)?)$/gm;
  function indent2(code) { return code.replace(lineMatchRE, "  $1"); }

  function l(i) { return "peg$c" + i; } // |literals[i]| of the abstract machine
  function r(i) { return "peg$r" + i; } // |classes[i]| of the abstract machine
  function e(i) { return "peg$e" + i; } // |expectations[i]| of the abstract machine
  function f(i) { return "peg$f" + i; } // |actions[i]| of the abstract machine

  function generateTables() {
    function buildLiteral(literal) {
      return "\"" + stringEscape(literal) + "\"";
    }

    function buildRegexp(cls) {
      return "/^["
            + (cls.inverted ? "^" : "")
            + cls.value.map(part =>
                Array.isArray(part)
                  ? regexpClassEscape(part[0])
                    + "-"
                    + regexpClassEscape(part[1])
                  : regexpClassEscape(part)
              ).join("")
            + "]/" + (cls.ignoreCase ? "i" : "");
    }

    function buildExpectation(e) {
      switch (e.type) {
        case "rule": {
          return "peg$ruleExpectation(\"" + stringEscape(e.value) + "\")";
        }
        case "literal": {
          return "peg$literalExpectation(\""
                  + stringEscape(e.value)
                  + "\", "
                  + e.ignoreCase
                  + ")";
        }
        case "class": {
          let parts = e.value.map(part =>
                Array.isArray(part)
                  ? "[\"" + stringEscape(part[0]) + "\", \"" + stringEscape(part[1]) + "\"]"
                  : "\""  + stringEscape(part) + "\""
              ).join(", ");

          return "peg$classExpectation(["
                  + parts + "], "
                  + e.inverted + ", "
                  + e.ignoreCase
                  + ")";
        }
        case "any": return "{ type: 'any' }";
        // istanbul ignore next
        default: throw new Error("Unknown expectation type (" + JSON.stringify(e) + ")");
      }
    }

    return ast.literals.map(
      (c, i) => "var " + l(i) + " = " + buildLiteral(c) + ";"
    ).concat("", ast.classes.map(
      (c, i) => "var " + r(i) + " = " + buildRegexp(c) + ";"
    )).concat("", ast.expectations.map(
      (c, i) => "var " + e(i) + " = " + buildExpectation(c) + ";"
    )).concat("", ast.functions.map(
      (c, i) => "var " + f(i) + ";"
    )).join("\n");
  }

  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    let parts = [];

    parts.push("");

    if (options.trace) {
      parts.push([
        "tracer.trace({",
        "  type: 'rule.enter',",
        "  rule: " + ruleNameCode + ",",
        "  location: state._computeLocation(startPos, startPos)",
        "});",
        ""
      ].join("\n"));
    }

    if (options.cache) {
      parts.push([
        "var key = state._offset * " + ast.rules.length + " + " + ruleIndexCode + ";",
        "var cached = resultsCache[key];",
        "",
        "if (cached) {",
        "  state._offset = cached.nextPos;",
        ""
      ].join("\n"));

      if (options.trace) {
        parts.push([
          "if (cached.result !== FAILED) {",
          "  tracer.trace({",
          "    type: 'rule.match',",
          "    rule: " + ruleNameCode + ",",
          "    result: cached.result,",
          "    location: state._computeLocation(startPos, state._offset)",
          "  });",
          "} else {",
          "  tracer.trace({",
          "    type: 'rule.fail',",
          "    rule: " + ruleNameCode + ",",
          "    location: state._computeLocation(startPos, startPos)",
          "  });",
          "}",
          ""
        ].join("\n"));
      }

      parts.push([
        "  return cached.result;",
        "}",
        ""
      ].join("\n"));
    }

    return parts.join("\n");
  }

  function generateRuleFooter(ruleNameCode, resultCode) {
    let parts = [];

    if (options.cache) {
      parts.push([
        "",
        "resultsCache[key] = { nextPos: state._offset, result: " + resultCode + " };"
      ].join("\n"));
    }

    if (options.trace) {
      parts.push([
        "",
        "if (" + resultCode + " !== FAILED) {",
        "  tracer.trace({",
        "    type: 'rule.match',",
        "    rule: " + ruleNameCode + ",",
        "    result: " + resultCode + ",",
        "    location: state._computeLocation(startPos, state._offset)",
        "  });",
        "} else {",
        "  tracer.trace({",
        "    type: 'rule.fail',",
        "    rule: " + ruleNameCode + ",",
        "    location: state._computeLocation(startPos, startPos)",
        "  });",
        "}"
      ].join("\n"));
    }

    parts.push([
      "",
      "return " + resultCode + ";"
    ].join("\n"));

    return parts.join("\n");
  }

  function generateRuleFunction(rule) {
    let parts = [];
    let resStack = new Stack(rule.name, "r", "var");
    let posStack = new Stack(rule.name, "p", "var");

    function compile(bc) {
      let ip = 0;
      let end = bc.length;
      let parts = [];
      let value;

      function compileCondition(cond, argCount) {
        let baseLength = argCount + 3;
        let thenLength = bc[ip + baseLength - 2];
        let elseLength = bc[ip + baseLength - 1];
        let thenCode, elseCode;

        Stack.checkedIf([resStack, posStack], ip,
          () => {
            ip += baseLength;
            thenCode = compile(bc.slice(ip, ip + thenLength));
            ip += thenLength;
          },
          elseLength > 0 ? () => {
            elseCode = compile(bc.slice(ip, ip + elseLength));
            ip += elseLength;
          } : null
        );

        parts.push("if (" + cond + ") {");
        parts.push(indent2(thenCode));
        if (elseLength > 0) {
          parts.push("} else {");
          parts.push(indent2(elseCode));
        }
        parts.push("}");
      }

      function compileLoop() {
        let baseLength = 3;
        let bodyLength = bc[ip + baseLength - 1];
        let bodyCode;
        let cond = bc[ip + 1] ? "true" : "false";

        Stack.checkedLoop([posStack], ip, () => {
          ip += baseLength;
          bodyCode = compile(bc.slice(ip, ip + bodyLength));
          ip += bodyLength;
        });

        parts.push("do {");
        parts.push(indent2(bodyCode));
        parts.push("} while (" + cond + ");");
      }

      function compileCall() {
        let baseLength = 4;
        let paramsLength = bc[ip + baseLength - 1];

        let value = f(bc[ip + 1]) + "("
          + bc.slice(ip + baseLength, ip + baseLength + paramsLength).map(
              p => resStack.index(p)
            ).join(", ")
          + ")";
        resStack.pop(bc[ip + 2]);
        parts.push(resStack.push(value));
        ip += baseLength + paramsLength;
      }

      function compileWrapSome() {
        let baseLength = 3;
        let paramsLength = bc[ip + baseLength - 1];

        let value = "["
          + bc.slice(ip + baseLength, ip + baseLength + paramsLength).map(
              p => resStack.index(p)
            ).join(", ")
          + "]";
        resStack.pop(bc[ip + 1]);
        parts.push(resStack.push(value));
        ip += baseLength + paramsLength;
      }

      function compileBreak() {
        let n = bc[ip + 1];
        if (n > 0) {
          resStack.pop(n);
          parts.push(resStack.push("FAILED"));
        }
        parts.push("break;");
        ip += 2;
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH_EMPTY_STRING:  // PUSH_EMPTY_STRING
            parts.push(resStack.push("''"));
            ip++;
            break;

          case op.PUSH_UNDEFINED:     // PUSH_UNDEFINED
            parts.push(resStack.push("undefined"));
            ip++;
            break;

          case op.PUSH_NULL:          // PUSH_NULL
            parts.push(resStack.push("null"));
            ip++;
            break;

          case op.PUSH_FAILED:        // PUSH_FAILED
            parts.push(resStack.push("FAILED"));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY:   // PUSH_EMPTY_ARRAY
            parts.push(resStack.push("[]"));
            ip++;
            break;

          case op.POP:                // POP
            resStack.pop();
            ip++;
            break;

          case op.BREAK:              // BREAK n
            resStack.fork(compileBreak);
            break;

          case op.GET:                // GET n, i
            value = resStack.index(bc[ip + 2]);
            resStack.pop(bc[ip + 1]);
            parts.push(resStack.push(value));
            // Remove useless `r<x> = r<x>;` statement
            if (resStack.top() === value) {
              parts.pop();
            }
            ip += 3;
            break;

          case op.APPEND:             // APPEND
            value = resStack.pop();
            parts.push(resStack.top() + ".push(" + value + ");");
            ip++;
            break;

          case op.WRAP:               // WRAP n
            parts.push(
              resStack.push("[" + resStack.pop(bc[ip + 1]).join(", ") + "]")
            );
            ip += 2;
            break;

          case op.WRAP_SOME:          // WRAP_SOME n, k, p1, ..., pK
            compileWrapSome();
            break;

          case op.PUSH_CURR_POS:      // PUSH_CURR_POS
            parts.push(posStack.push("state._offset"));
            ip++;
            break;

          case op.LOAD_CURR_POS:      // LOAD_CURR_POS
            parts.push("state._offset = " + posStack.top() + ";");
            ip++;
            break;

          case op.POP_POS:            // POP_POS
            posStack.pop();
            ip++;
            break;

          case op.TEXT:               // TEXT
            resStack.pop();
            parts.push(
              resStack.push("state.input.substring(" + posStack.top() + ", state._offset)")
            );
            ip++;
            break;

          case op.IF:                 // IF t, f
            compileCondition(resStack.top(), 0);
            break;

          case op.IF_ERROR:           // IF_ERROR t, f
            compileCondition(resStack.top() + " === FAILED", 0);
            break;

          case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
            compileCondition(resStack.top() + " !== FAILED", 0);
            break;

          case op.IF_LT:              // IF_LT min, t, f
            compileCondition(resStack.top() + ".length < " + bc[ip + 1], 1);
            break;

          case op.IF_GE:              // IF_GE max, t, f
            compileCondition(resStack.top() + ".length >= " + bc[ip + 1], 1);
            break;

          case op.IF_LT_DYNAMIC:      // IF_LT_DYNAMIC min, t, f
            compileCondition(resStack.top() + ".length < " + resStack.index(bc[ip + 1]), 1);
            break;

          case op.IF_GE_DYNAMIC:      // IF_GE_DYNAMIC max, t, f
            compileCondition(resStack.top() + ".length >= " + resStack.index(bc[ip + 1]), 1);
            break;

          case op.LOOP:               // LOOP cond b
            compileLoop();
            break;

          case op.MATCH_ANY:          // MATCH_ANY
            parts.push(resStack.push("state.matchAny()"));
            ip++;
            break;

          case op.MATCH_LITERAL: {    // MATCH_LITERAL l
            let str = ast.literals[bc[ip + 1]];
            parts.push(resStack.push(
              str.length > 1
                ? "state.matchLiteral(" + l(bc[ip + 1]) + ")"
                : "state.matchChar(" + l(bc[ip + 1]) + ", " + str.charCodeAt(0) + ")"
            ));
            ip += 2;
            break;
          }
          case op.MATCH_LITERAL_IC:   // MATCH_LITERAL_IC l
            parts.push(resStack.push(
              "state.matchLiteralIC(" + l(bc[ip + 1]) + ")"
            ));
            ip += 2;
            break;

          case op.MATCH_CLASS:        // MATCH_CLASS c
            parts.push(resStack.push(
              "state.matchClass(" + r(bc[ip + 1]) + ")"
            ));
            ip += 2;
            break;

          case op.ACCEPT_N:           // ACCEPT_N n
            parts.push(resStack.push(
              bc[ip + 1] > 1
                ? "state.input.substr(state._offset, " + bc[ip + 1] + ")"
                : "state.input.charAt(state._offset)"
            ));
            parts.push(
              bc[ip + 1] > 1
                ? "state._offset += " + bc[ip + 1] + ";"
                : "state._offset++;"
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:      // ACCEPT_STRING s
            parts.push(resStack.push(l(bc[ip + 1])));
            parts.push(
              ast.literals[bc[ip + 1]].length > 1
                ? "state._offset += " + ast.literals[bc[ip + 1]].length + ";"
                : "state._offset++;"
            );
            ip += 2;
            break;

          case op.EXPECT:             // EXPECT e
            parts.push("if (silentFails === 0) { state._expect(" + e(bc[ip + 1]) + "); }");
            ip += 2;
            break;

          case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS
            parts.push("state._mark = " + posStack.top() + ";");
            ip++;
            break;

          case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
            parts.push("state._mark = state._offset;");
            ip++;
            break;

          case op.CALL:               // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE:               // RULE r
            parts.push(resStack.push("parse" + ast.rules[bc[ip + 1]].name + "()"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
            parts.push("silentFails++;");
            ip++;
            break;

          case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
            parts.push("silentFails--;");
            ip++;
            break;

          case op.EXPECT_NS_BEGIN:    // EXPECT_NS_BEGIN
            parts.push("state._begin();");
            ip++;
            break;

          case op.EXPECT_NS_END:      // EXPECT_NS_END invert
            parts.push("state._end(" + (bc[ip + 1] !== 0) + ");");
            ip += 2;
            break;

          // istanbul ignore next
          default:
            throw new Error(
              "Rule '" + rule.name + "', position " + ip + ": "
              + "Invalid opcode " + bc[ip] + "."
            );
        }
      }

      return parts.join("\n");
    }

    let code = compile(rule.bytecode);

    parts.push("function parse" + rule.name + "() {");

    if (options.trace) {
      parts.push("  var startPos = state._offset;");
    }

    parts.push(indent2(resStack.defines()));
    parts.push(indent2(posStack.defines()));

    parts.push(indent2(generateRuleHeader(
      '"' + stringEscape(rule.name) + '"',
      asts.indexOfRule(ast, rule.name)
    )));
    parts.push(indent2(code));
    parts.push(indent2(generateRuleFooter(
      '"' + stringEscape(rule.name) + '"',
      resStack.result()
    )));

    parts.push("}");

    return parts.join("\n");
  }

  function generateToplevel() {
    let parts = [];

    parts.push("var peg$ParserState = require('@pegjs2/runtime/parser-state');");

    if (options.trace) {
      parts.push("var peg$DefaultTracer = require('@pegjs2/runtime/default-tracer');");
    }

    parts.push([
      "",
      "function peg$literalExpectation(text, ignoreCase) {",
      "  return { type: 'literal', text: text, ignoreCase: ignoreCase };",
      "}",
      "",
      "function peg$classExpectation(parts, inverted, ignoreCase) {",
      "  return { type: 'class', parts: parts, inverted: inverted, ignoreCase: ignoreCase };",
      "}",
      "",
      "function peg$ruleExpectation(description) {",
      "  return { type: 'rule', description: description };",
      "}",
      "",
      generateTables(),
      "",
      "function peg$init(input, options, state) {",
    ].join("\n"));

    if (ast.initializer) {
      parts.push("");
      parts.push(indent2(ast.initializer.code));
    }

    parts.push("");
    ast.functions.forEach((c, i) => {
      parts.push("  " + f(i) + " = function(" + c.params.join(", ") + ") {" + c.body + "};");
    });

    parts.push([
      "}",
      "",
      "function peg$define(options, state) {",
      "  var FAILED = peg$ParserState.FAILED;",
      "  var silentFails = 0;",   // 0 = report failures, > 0 = silence failures
    ].join("\n"));

    if (options.cache) {
      parts.push("  var resultsCache = {};");
    }

    if (options.trace) {
      parts.push('  var tracer = "tracer" in options ? options.tracer : new peg$DefaultTracer();');
    }

    ast.rules.forEach(rule => {
      parts.push("");
      parts.push(indent2(generateRuleFunction(rule)));
    });

    parts.push([
      "",
      "  return {",
    ].join("\n"));

    parts.push(options.allowedStartRules.map(
      r => "    " + r + ": parse" + r + ","
    ).join("\n"));

    parts.push([
      "  };",
      "}",
      "",
      "function peg$parse(input, options) {",
      "  options = options !== undefined ? options : {};",
      "",
      "  var state = new peg$ParserState(input, options.source, 0, 1, 1);",
      `  var startRule = "startRule" in options ? options.startRule : "${options.allowedStartRules[0]}";`,
      "  var startRuleFunctions = peg$define(options, state);",
      "",
      "  if (!(startRule in startRuleFunctions)) {",
      "    throw new Error('Can\\'t start parsing from rule \"' + startRule + '\".')",
      "  }",
      "",
      "  peg$init(input, options, state);",
      "  return state.parse(startRuleFunctions[startRule]);",
      "}",
    ].join("\n"));

    return parts.join("\n");
  }

  function generateWrapper(toplevelCode) {
    function generateGeneratedByComment() {
      return [
        "// Generated by PEG.js 2 v" + require("../../peg").VERSION,
        "//",
        "// https://github.com/Mingun/pegjs"
      ].join("\n");
    }

    function generateParserObject() {
      return "{ parse: peg$parse }";
    }

    function generateParserExports() {
      return "{ peg$parse as parse }";
    }

    let generators = {
      bare() {
        return [
          generateGeneratedByComment(),
          "(function() {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("return " + generateParserObject() + ";"),
          "})()"
        ].join("\n");
      },

      commonjs() {
        let parts = [];
        let dependencyVars = Object.keys(options.dependencies);

        parts.push([
          generateGeneratedByComment(),
          "",
          "\"use strict\";",
          ""
        ].join("\n"));

        if (dependencyVars.length > 0) {
          dependencyVars.forEach(variable => {
            parts.push("var " + variable
              + " = require(\""
              + stringEscape(options.dependencies[variable])
              + "\");"
            );
          });
          parts.push("");
        }

        parts.push([
          toplevelCode,
          "",
          "module.exports = " + generateParserObject() + ";",
          ""
        ].join("\n"));

        return parts.join("\n");
      },

      es() {
        let parts = [];
        let dependencyVars = Object.keys(options.dependencies);

        parts.push(
          generateGeneratedByComment(),
          ""
        );

        if (dependencyVars.length > 0) {
          dependencyVars.forEach(variable => {
            parts.push("import " + variable
              + " from \""
              + stringEscape(options.dependencies[variable])
              + "\";"
            );
          });
          parts.push("");
        }

        parts.push(
          toplevelCode,
          "",
          "export " + generateParserExports() + ";",
          "",
          "export default " + generateParserObject() + ";",
          ""
        );

        return parts.join("\n");
      },

      amd() {
        let dependencyVars = Object.keys(options.dependencies);
        let dependencyIds = dependencyVars.map(v => options.dependencies[v]);
        let dependencies = "["
          + dependencyIds.map(
              id => "\"" + stringEscape(id) + "\""
            ).join(", ")
          + "]";
        let params = dependencyVars.join(", ");

        return [
          generateGeneratedByComment(),
          "define(" + dependencies + ", function(" + params + ") {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("return " + generateParserObject() + ";"),
          "});",
          ""
        ].join("\n");
      },

      globals() {
        return [
          generateGeneratedByComment(),
          "(function(root) {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("root." + options.exportVar + " = " + generateParserObject() + ";"),
          "})(this);",
          ""
        ].join("\n");
      },

      umd() {
        let parts = [];
        let dependencyVars = Object.keys(options.dependencies);
        let dependencyIds = dependencyVars.map(v => options.dependencies[v]);
        let dependencies = "["
          + dependencyIds.map(
              id => "\"" + stringEscape(id) + "\""
            ).join(", ")
          + "]";
        let requires = dependencyIds.map(
          id => "require(\"" + stringEscape(id) + "\")"
        ).join(", ");
        let params = dependencyVars.join(", ");

        parts.push([
          generateGeneratedByComment(),
          "(function(root, factory) {",
          "  if (typeof define === \"function\" && define.amd) {",
          "    define(" + dependencies + ", factory);",
          "  } else if (typeof module === \"object\" && module.exports) {",
          "    module.exports = factory(" + requires + ");"
        ].join("\n"));

        if (options.exportVar !== null) {
          parts.push([
            "  } else {",
            "    root." + options.exportVar + " = factory();"
          ].join("\n"));
        }

        parts.push([
          "  }",
          "})(this, function(" + params + ") {",
          "  \"use strict\";",
          "",
          indent2(toplevelCode),
          "",
          indent2("return " + generateParserObject() + ";"),
          "});",
          ""
        ].join("\n"));

        return parts.join("\n");
      }
    };

    return generators[options.format]();
  }

  ast.code = generateWrapper(generateToplevel());
}

module.exports = generateJS;
