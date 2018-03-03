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
    )).join("\n");
  }

  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    let parts = [];

    parts.push("");

    if (options.trace) {
      parts.push([
        "peg$tracer.trace({",
        "  type: \"rule.enter\",",
        "  rule: " + ruleNameCode + ",",
        "  location: peg$state._computeLocation(startPos, startPos)",
        "});",
        ""
      ].join("\n"));
    }

    if (options.cache) {
      parts.push([
        "var key = peg$state._offset * " + ast.rules.length + " + " + ruleIndexCode + ";",
        "var cached = peg$resultsCache[key];",
        "",
        "if (cached) {",
        "  peg$state._offset = cached.nextPos;",
        ""
      ].join("\n"));

      if (options.trace) {
        parts.push([
          "if (cached.result !== peg$FAILED) {",
          "  peg$tracer.trace({",
          "    type: \"rule.match\",",
          "    rule: " + ruleNameCode + ",",
          "    result: cached.result,",
          "    location: peg$state._computeLocation(startPos, peg$state._offset)",
          "  });",
          "} else {",
          "  peg$tracer.trace({",
          "    type: \"rule.fail\",",
          "    rule: " + ruleNameCode + ",",
          "    location: peg$state._computeLocation(startPos, startPos)",
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
        "peg$resultsCache[key] = { nextPos: peg$state._offset, result: " + resultCode + " };"
      ].join("\n"));
    }

    if (options.trace) {
      parts.push([
        "",
        "if (" + resultCode + " !== peg$FAILED) {",
        "  peg$tracer.trace({",
        "    type: \"rule.match\",",
        "    rule: " + ruleNameCode + ",",
        "    result: " + resultCode + ",",
        "    location: peg$state._computeLocation(startPos, peg$state._offset)",
        "  });",
        "} else {",
        "  peg$tracer.trace({",
        "    type: \"rule.fail\",",
        "    rule: " + ruleNameCode + ",",
        "    location: peg$state._computeLocation(startPos, startPos)",
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

      function compileLoop(cond) {
        let baseLength = 2;
        let bodyLength = bc[ip + baseLength - 1];
        let bodyCode;

        Stack.checkedLoop([resStack, posStack], ip, () => {
          ip += baseLength;
          bodyCode = compile(bc.slice(ip, ip + bodyLength));
          ip += bodyLength;
        });

        parts.push("while (" + cond + ") {");
        parts.push(indent2(bodyCode));
        parts.push("}");
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
            parts.push(resStack.push("peg$FAILED"));
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

          case op.POP_N:              // POP_N n
            resStack.pop(bc[ip + 1]);
            ip += 2;
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
            parts.push(posStack.push("peg$state._offset"));
            ip++;
            break;

          case op.LOAD_CURR_POS:      // LOAD_CURR_POS
            parts.push("peg$state._offset = " + posStack.top() + ";");
            ip++;
            break;

          case op.POP_POS:            // POP_POS
            posStack.pop();
            ip++;
            break;

          case op.TEXT:               // TEXT
            resStack.pop();
            parts.push(
              resStack.push("input.substring(" + posStack.top() + ", peg$state._offset)")
            );
            ip++;
            break;

          case op.IF:                 // IF t, f
            compileCondition(resStack.top(), 0);
            break;

          case op.IF_ERROR:           // IF_ERROR t, f
            compileCondition(resStack.top() + " === peg$FAILED", 0);
            break;

          case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
            compileCondition(resStack.top() + " !== peg$FAILED", 0);
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

          case op.WHILE_NOT_ERROR:    // WHILE_NOT_ERROR b
            compileLoop(resStack.top() + " !== peg$FAILED", 0);
            break;

          case op.MATCH_ANY:          // MATCH_ANY a, f, ...
            compileCondition("input.length > peg$state._offset", 0);
            break;

          case op.MATCH_STRING:       // MATCH_STRING s, a, f, ...
            compileCondition(
              ast.literals[bc[ip + 1]].length > 1
                ? "input.substr(peg$state._offset, "
                    + ast.literals[bc[ip + 1]].length
                    + ") === "
                    + l(bc[ip + 1])
                : "input.charCodeAt(peg$state._offset) === "
                    + ast.literals[bc[ip + 1]].charCodeAt(0),
              1
            );
            break;

          case op.MATCH_STRING_IC:    // MATCH_STRING_IC s, a, f, ...
            compileCondition(
              "input.substr(peg$state._offset, "
                + ast.literals[bc[ip + 1]].length
                + ").toLowerCase() === "
                + l(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_CLASS:        // MATCH_CLASS c, a, f, ...
            compileCondition(
              r(bc[ip + 1]) + ".test(input.charAt(peg$state._offset))",
              1
            );
            break;

          case op.ACCEPT_N:           // ACCEPT_N n
            parts.push(resStack.push(
              bc[ip + 1] > 1
                ? "input.substr(peg$state._offset, " + bc[ip + 1] + ")"
                : "input.charAt(peg$state._offset)"
            ));
            parts.push(
              bc[ip + 1] > 1
                ? "peg$state._offset += " + bc[ip + 1] + ";"
                : "peg$state._offset++;"
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:      // ACCEPT_STRING s
            parts.push(resStack.push(l(bc[ip + 1])));
            parts.push(
              ast.literals[bc[ip + 1]].length > 1
                ? "peg$state._offset += " + ast.literals[bc[ip + 1]].length + ";"
                : "peg$state._offset++;"
            );
            ip += 2;
            break;

          case op.EXPECT:             // EXPECT e
            parts.push("if (peg$silentFails === 0) { peg$state._expect(" + e(bc[ip + 1]) + "); }");
            ip += 2;
            break;

          case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS
            parts.push("peg$state._mark = " + posStack.top() + ";");
            ip++;
            break;

          case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
            parts.push("peg$state._mark = peg$state._offset;");
            ip++;
            break;

          case op.CALL:               // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE:               // RULE r
            parts.push(resStack.push("peg$parse" + ast.rules[bc[ip + 1]].name + "()"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
            parts.push("peg$silentFails++;");
            ip++;
            break;

          case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
            parts.push("peg$silentFails--;");
            ip++;
            break;

          case op.EXPECT_NS_BEGIN:    // EXPECT_NS_BEGIN
            parts.push("peg$state._begin();");
            ip++;
            break;

          case op.EXPECT_NS_END:      // EXPECT_NS_END invert
            parts.push("peg$state._end(" + (bc[ip + 1] !== 0) + ");");
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

    parts.push("function peg$parse" + rule.name + "() {");

    if (options.trace) {
      parts.push("  var startPos = peg$state._offset;");
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

    parts.push("var peg$SyntaxError = require('@pegjs2/runtime/syntax-error');");
    parts.push("var peg$ParserState = require('@pegjs2/runtime/parser-state');");

    if (options.trace) {
      parts.push("var peg$DefaultTracer = require('@pegjs2/runtime/default-tracer');");
    }

    let startRuleFunctions = "{ "
      + options.allowedStartRules.map(
          r => r + ": peg$parse" + r
        ).join(", ")
      + " }";
    let startRuleFunction = "peg$parse" + options.allowedStartRules[0];

    parts.push([
      "var peg$FAILED = peg$ParserState.FAILED;",
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
      "function peg$parse(input, options) {",
      "  options = options !== undefined ? options : {};",
      "",
      "  var peg$state = new peg$ParserState(input, 0, 1, 1);",
      "  var peg$startRuleFunctions = " + startRuleFunctions + ";",
      "  var peg$startRuleFunction = " + startRuleFunction + ";",
      "  var peg$silentFails = 0;",   // 0 = report failures, > 0 = silence failures
      "",
      "  var state = peg$state;",
    ].join("\n"));

    if (options.cache) {
      parts.push([
        "  var peg$resultsCache = {};",
        ""
      ].join("\n"));
    }

    if (options.trace) {
      parts.push([
        "  var peg$tracer = \"tracer\" in options ? options.tracer : new peg$DefaultTracer();",
        ""
      ].join("\n"));
    }

    ast.functions.forEach((c, i) => {
      parts.push("  function " + f(i) + "(" + c.params.join(", ") + ") {" + c.body + "}");
    });

    parts.push([
      "",
      "  if (\"startRule\" in options) {",
      "    if (!(options.startRule in peg$startRuleFunctions)) {",
      "      throw new Error(\"Can't start parsing from rule \\\"\" + options.startRule + \"\\\".\");",
      "    }",
      "",
      "    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];",
      "  }",
      ""
    ].join("\n"));

    ast.rules.forEach(rule => {
      parts.push(indent2(generateRuleFunction(rule)));
      parts.push("");
    });

    if (ast.initializer) {
      parts.push(indent2(ast.initializer.code));
      parts.push("");
    }

    parts.push([
      "  return peg$state.parse(peg$startRuleFunction);",
      "}"
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
      return options.trace
        ? [
          "{",
          "  SyntaxError: peg$SyntaxError,",
          "  DefaultTracer: peg$DefaultTracer,",
          "  parse: peg$parse",
          "}"
        ].join("\n")
        : [
          "{",
          "  SyntaxError: peg$SyntaxError,",
          "  parse: peg$parse",
          "}"
        ].join("\n");
    }

    function generateParserExports() {
      return options.trace
        ? [
          "{",
          "  peg$SyntaxError as SyntaxError,",
          "  peg$DefaultTracer as DefaultTracer,",
          "  peg$parse as parse",
          "}"
        ].join("\n")
        : [
          "{",
          "  peg$SyntaxError as SyntaxError,",
          "  peg$parse as parse",
          "}"
        ].join("\n");
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
