"use strict";

let asts = require("../asts");
let op = require("../opcodes");
let visitor = require("../visitor");

// Generates bytecode.
//
// Instructions
// ============
//
// Result Stack Manipulation
// -------------------------
//
//  [0] PUSH_EMPTY_STRING
//
//        resStack.push("");
//
//  [1] PUSH_UNDEFINED
//
//        resStack.push(undefined);
//
//  [2] PUSH_NULL
//
//        resStack.push(null);
//
//  [3] PUSH_FAILED
//
//        resStack.push(FAILED);
//
//  [4] PUSH_EMPTY_ARRAY
//
//        resStack.push([]);
//
//  [6] POP
//
//        resStack.pop();
//
//  [8] POP_N n
//
//        resStack.pop(n);
//
// [36] GET n, i
//
//        value = resStack[i];
//        resStack.pop(n);
//        resStack.push(value);
//
// [10] APPEND
//
//        value = resStack.pop();
//        array = resStack.top();
//        array.push(value);
//
// [11] WRAP n
//
//        resStack.push(resStack.pop(n));
//
// [37] WRAP_SOME n, k, p1, ..., pK
//
//        value = [resStack[p1], ..., resStack[pK]];
//        resStack.pop(n);
//        resStack.push(value);
//
// [12] TEXT
//
//        resStack.pop();
//        resStack.push(input.substring(posStack.top(), currPos));
//
// Position Stack Manipulation
// ---------------------------
//
//  [5] PUSH_CURR_POS
//
//        posStack.push(currPos);
//
//  [7] LOAD_CURR_POS
//
//        currPos = posStack.top();
//
//  [9] POP_POS
//
//        posStack.pop();
//
// Conditions and Loops
// --------------------
//
// [13] IF t, f
//
//        if (resStack.top()) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [14] IF_ERROR t, f
//
//        if (resStack.top() === FAILED) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [15] IF_NOT_ERROR t, f
//
//        if (resStack.top() !== FAILED) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [30] IF_LT min, t, f
//
//        if (resStack.top().length < min) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [31] IF_GE max, t, f
//
//        if (resStack.top().length >= max) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [32] IF_LT_DYNAMIC min, t, f
//
//        if (resStack.top().length < resStack[min]) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [33] IF_GE_DYNAMIC max, t, f
//
//        if (resStack.top().length >= resStack[max]) {
//          interpret(ip + 3, ip + 3 + t);
//        } else {
//          interpret(ip + 3 + t, ip + 3 + t + f);
//        }
//
// [16] WHILE_NOT_ERROR b
//
//        while(resStack.top() !== FAILED) {
//          interpret(ip + 2, ip + 2 + b);
//        }
//
// Matching
// --------
//
// [17] MATCH_ANY a, f, ...
//
//        if (input.length > currPos) {
//          interpret(ip + 3, ip + 3 + a);
//        } else {
//          interpret(ip + 3 + a, ip + 3 + a + f);
//        }
//
// [18] MATCH_STRING s, a, f, ...
//
//        if (input.substr(currPos, literals[s].length) === literals[s]) {
//          interpret(ip + 4, ip + 4 + a);
//        } else {
//          interpret(ip + 4 + a, ip + 4 + a + f);
//        }
//
// [19] MATCH_STRING_IC s, a, f, ...
//
//        if (input.substr(currPos, literals[s].length).toLowerCase() === literals[s]) {
//          interpret(ip + 4, ip + 4 + a);
//        } else {
//          interpret(ip + 4 + a, ip + 4 + a + f);
//        }
//
// [20] MATCH_CLASS c, a, f, ...
//
//        if (classes[c].test(input.charAt(currPos))) {
//          interpret(ip + 4, ip + 4 + a);
//        } else {
//          interpret(ip + 4 + a, ip + 4 + a + f);
//        }
//
// [21] ACCEPT_N n
//
//        resStack.push(input.substring(currPos, n));
//        currPos += n;
//
// [22] ACCEPT_STRING s
//
//        resStack.push(literals[s]);
//        currPos += literals[s].length;
//
// [23] EXPECT e
//
//        expect(expectations[e]);
//
// Calls
// -----
//
// [24] LOAD_SAVED_POS
//
//        savedPos = posStack.top();
//
// [25] UPDATE_SAVED_POS
//
//        savedPos = currPos;
//
// [26] CALL f, n, pc, p1, p2, ..., pN
//
//        value = functions[f](resStack[p1], ..., resStack[pN]);
//        resStack.pop(n);
//        resStack.push(value);
//
// Rules
// -----
//
// [27] RULE r
//
//        resStack.push(parseRule(r));
//
// Failure Reporting
// -----------------
//
// [28] SILENT_FAILS_ON
//
//        silentFails++;
//
// [29] SILENT_FAILS_OFF
//
//        silentFails--;
//
// [38] EXPECT_NS_BEGIN
//
//        expected.push({ pos: curPos, variants: [] });
//
// [39] EXPECT_NS_END invert
//
//        value = expected.pop();
//        if (value.pos === expected.top().pos) {
//          if (invert) {
//            value.variants.forEach(e => { e.not = !e.not; });
//          }
//          expected.top().variants.pushAll(value.variants);
//        }
//
function generateBytecode(ast) {
  let literals = [];
  let classes = [];
  let expectations = [];
  let functions = [];

  function addLiteralConst(value) {
    let index = literals.indexOf(value);

    return index === -1 ? literals.push(value) - 1 : index;
  }

  function addClassConst(node) {
    let cls = {
      value: node.parts,
      inverted: node.inverted,
      ignoreCase: node.ignoreCase
    };
    let pattern = JSON.stringify(cls);
    let index = classes.findIndex(c => JSON.stringify(c) === pattern);

    return index === -1 ? classes.push(cls) - 1 : index;
  }

  function addExpectedConst(expected) {
    let pattern = JSON.stringify(expected);
    let index = expectations.findIndex(e => JSON.stringify(e) === pattern);

    return index === -1 ? expectations.push(expected) - 1 : index;
  }

  function addFunctionConst(predicate, params, code) {
    let func = { predicate: predicate, params: params, body: code };
    let pattern = JSON.stringify(func);
    let index = functions.findIndex(f => JSON.stringify(f) === pattern);

    return index === -1 ? functions.push(func) - 1 : index;
  }

  function buildSequence(first, ...rest) {
    return first.concat(...rest);
  }

  function buildCondition(match, condCode, thenCode, elseCode) {
    if (match > 0) { return thenCode; }
    if (match < 0) { return elseCode; }

    return condCode.concat(
      [thenCode.length, elseCode.length],
      thenCode,
      elseCode
    );
  }

  function buildLoop(condCode, bodyCode) {
    return condCode.concat([bodyCode.length], bodyCode);
  }

  /**
   * @param {number} functionIndex Index in `functions` of function to call
   * @param {number} delta Count of objects that must be pop'ed from result stack before push function result
   * @param {Object} env Mapping from label name to result stack location
   * @param {number} sp Top of result stack
   * @return {number[]} Bytecode of `CALL` instruction
   */
  function buildCall(functionIndex, delta, env, sp) {
    let params = Object.keys(env).map(name => sp - env[name]);

    return [op.CALL, functionIndex, delta, params.length].concat(params);
  }

  function buildSimplePredicate(expression, negative, context) {
    let match = expression.match|0;
    let finalization = negative
      ? buildCondition(
          -match,
          [op.IF_ERROR],
          [op.POP, op.PUSH_UNDEFINED],
          buildSequence(
            [op.LOAD_CURR_POS],
            [op.POP, op.PUSH_FAILED]
          )
        )
      : buildCondition(
          match,
          [op.IF_NOT_ERROR],
          buildSequence(
            [op.LOAD_CURR_POS],
            [op.POP, op.PUSH_UNDEFINED]
          ),
          []
        );

    return buildSequence(
      [op.PUSH_CURR_POS],
      [op.EXPECT_NS_BEGIN],
      generate(expression, {
        sp: context.sp,
        env: Object.assign({}, context.env),
        auto: [],
        action: null,
        reportFailures: context.reportFailures
      }),
      [op.EXPECT_NS_END, negative ? 1 : 0],
      finalization,
      [op.POP_POS]
    );
  }

  function buildSemanticPredicate(node, negative, context) {
    let functionIndex = addFunctionConst(
      true, Object.keys(context.env), node.code
    );

    return buildSequence(
      [op.UPDATE_SAVED_POS],
      buildCall(functionIndex, 0, context.env, context.sp),
      buildCondition(
        node.match|0,
        [op.IF],
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_FAILED] : [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_UNDEFINED] : [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildAppendLoop(expressionCode) {
    return buildLoop(
      [op.WHILE_NOT_ERROR],
      buildSequence([op.APPEND], expressionCode)
    );
  }

  function buildCheckMax(expressionCode, max, context) {
    if (max.value !== null) {
      let checkCode = max.constant
        ? [op.IF_GE, max.value]
        : [op.IF_GE_DYNAMIC, context.sp + 1 - context.env[max.value]]; // +1 for array with result

      // Push `peg$FAILED` - this break loop on next iteration, so |result|
      // will contains not more then |max| elements.
      return buildCondition(
        0,
        checkCode,        // if (r.length >= max)   p: [pos], r:[ [elem...] ]
        [op.PUSH_FAILED], //   elem = peg$FAILED;   p: [pos], r:[ [elem...], peg$FAILED ]
        expressionCode    // else
      );                  //   elem = expr();       p: [pos], r:[ [elem...], elem ]
    }
    return expressionCode;
  }

  function buildCheckMin(expressionCode, min, context) {
    // When restriction is set and not constant or constant, but not |0|, check it
    if (min.value !== null && (!min.constant || min.value > 0)) {
      let checkCode = min.constant
        ? [op.IF_LT, min.value]
        : [op.IF_LT_DYNAMIC, context.sp + 1 - context.env[min.value]]; // +1 slot for result array

      return buildSequence(
        // If low boundary present, then backtracking is possible, so save current pos
        [op.PUSH_CURR_POS],           // savedPos = curPos;       p: [pos], r:[]
        expressionCode,               // result = [elem...];      p: [pos], r:[ [elem...] ]
        buildCondition(
          0,
          checkCode,                  // if (result.length < min) {
          buildSequence(
            [op.LOAD_CURR_POS],       //   currPos = savedPos;    p: [pos], r:[ [elem...] ]
            [op.POP, op.PUSH_FAILED]  //   result = peg$FAILED;   p: [pos], r:[FAILED]
          ),
          []                          // }
        ),
        [op.POP_POS]                  //                          p: [], r:[ [elem...] ]
      );
    }
    return expressionCode;
  }

  function buildRangeBody(delimiterNode, expressionMatch, expressionCode, context) {
    if (delimiterNode !== null) {
      return buildSequence(               //                          p: [], r:[]
        [op.PUSH_CURR_POS],               // pos = peg$currPos;       p: [pos], r:[]
        generate(delimiterNode, {         // item = delim();          p: [pos], r:[delim]
          sp: context.sp + 1, // +1 for array with result
          env: Object.assign({}, context.env),
          auto: [],
          action: null,
          reportFailures: context.reportFailures
        }),
        buildCondition(
          delimiterNode.match|0,
          [op.IF_NOT_ERROR],              // if (item !== peg$FAILED) {
          buildSequence(
            [op.POP],                     //                          p: [pos], r:[]
            expressionCode,               //   item = expr();         p: [pos], r:[item]
            buildCondition(
              -expressionMatch,
              [op.IF_ERROR],              //   if (item === peg$FAILED) {
              [op.LOAD_CURR_POS],         //     peg$currPos = pos;   p: [pos], r:[FAILED]
              []                          //   }
            ),
            []                            // }                        p: [pos], r:[item]
          ),
          []
        ),
        [op.POP_POS]                      //                          p: [], r:[<?>]
      );
    }
    return expressionCode;
  }

  let generate = visitor.build({
    grammar(node) {
      node.rules.forEach(generate);

      node.literals = literals;
      node.classes = classes;
      node.expectations = expectations;
      node.functions = functions;
    },

    rule(node) {
      // If `reportFailures` not defined, then flag will be true
      let flag = node.reportFailures !== false;

      node.bytecode = generate(node.expression, {
        sp: -1,             // stack pointer of result stack
        env: { },           // mapping of label names to result stack positions
        auto: [],           // result stack positions of automatic labels
        action: null,       // action nodes pass themselves to children here
        reportFailures: flag// if `false`, suppress generation of EXPECT opcodes
      });
    },

    named(node, context) {
      // Do not generate unused constant, if no need it
      let nameIndex = context.reportFailures ? addExpectedConst(
        { type: "rule", value: node.name }
      ) : null;
      let expressionCode = generate(node.expression, {
        sp: context.sp,
        env: context.env,
        auto: context.auto,
        action: context.action,
        reportFailures: false
      });

      // No need to disable report failures if it already disabled
      return context.reportFailures ? buildSequence(
        [op.EXPECT, nameIndex],
        [op.SILENT_FAILS_ON],
        expressionCode,
        [op.SILENT_FAILS_OFF]
      ) : expressionCode;
    },

    choice(node, context) {
      function buildAlternativesCode(alternatives, context) {
        return buildSequence(
          generate(alternatives[0], {
            sp: context.sp,
            env: Object.assign({}, context.env),
            auto: [],
            action: null,
            reportFailures: context.reportFailures
          }),
          alternatives.length > 1
            ? buildCondition(
                // If alternative always match no need generate code for next alternatives
                -(alternatives[0].match|0),
                [op.IF_ERROR],
                buildSequence(
                  [op.POP],
                  buildAlternativesCode(alternatives.slice(1), context)
                ),
                []
              )
            : []
        );
      }

      return buildAlternativesCode(node.alternatives, context);
    },

    action(node, context) {
      let env = Object.assign({}, context.env);
      let emitCall = node.expression.type !== "sequence"
                  || node.expression.elements.length === 0;
      let expressionCode = generate(node.expression, {
        sp: context.sp,
        env: env,
        auto: [],
        action: node,
        reportFailures: context.reportFailures
      });
      let match = node.expression.match|0;
      let functionIndex = emitCall && match >= 0
        ? addFunctionConst(false, Object.keys(env), node.code)
        : null;

      return emitCall
        ? buildSequence(
            [op.PUSH_CURR_POS],                                   // p: [pos], r:[]
            expressionCode,                                       // p: [pos], r:[exp]
            buildCondition(
              match,
              [op.IF_NOT_ERROR],
              buildSequence(
                [op.LOAD_SAVED_POS],                              // p: [pos], r:[exp]
                // +1 for result of expression
                buildCall(functionIndex, 1, env, context.sp + 1)  // p: [pos], r:[act]
              ),
              []
            ),
            [op.POP_POS]                                          // p: [], r:[act]
          )
        : expressionCode;
    },

    sequence(node, context) {
      function buildElementsCode(elements, context) {
        let count = node.elements.length;
        if (elements.length > 0) {
          let processedCount = count - elements.length + 1;

          return buildSequence(
            generate(elements[0], {                         // p: [pos], r:[... exp]
              sp: context.sp,
              env: context.env,
              auto: context.auto,
              action: null,
              reportFailures: context.reportFailures
            }),
            buildCondition(
              elements[0].match|0,
              [op.IF_NOT_ERROR],
              buildElementsCode(elements.slice(1), {        // p: [pos], r:[... exp exp]
                sp: context.sp + 1,                         // +1 for result
                env: context.env,
                auto: context.auto,
                action: context.action,
                reportFailures: context.reportFailures
              }),
              buildSequence(
                [op.LOAD_CURR_POS],
                processedCount > 1 ? buildSequence(
                  [op.POP_N, processedCount],               // p: [pos], r:[]
                  [op.PUSH_FAILED]                          // p: [pos], r:[FAILED]
                ) : []                                      // p: [pos], r:[FAILED]
              )
            )
          );
        } else {
          let sp = context.sp;

          if (context.action) {
            let functionIndex = addFunctionConst(
              false,
              Object.keys(context.env),
              context.action.code
            );

            return buildSequence(
              [op.LOAD_SAVED_POS],
              buildCall(                                    // p: [pos], r:[act]
                functionIndex,
                count,
                context.env,
                sp
              )
            );
          }

          let resultLen = context.auto.length;
          if (resultLen === 0) {
            return [op.WRAP, count];                        // p: [pos], r:[[...]]
          }
          if (resultLen === 1) {
            return [op.GET, count, sp - context.auto[0].sp];// p: [], r:[res]
          }

          return buildSequence(                             // p: [pos], r:[[...]]
            [op.WRAP_SOME, count, resultLen],
            context.auto.map(a => sp - a.sp)
          );
        }
      }

      return node.elements.length > 0 ? buildSequence(
        [op.PUSH_CURR_POS],                                 // p: [pos], r:[]
        buildElementsCode(node.elements, context),          // p: [pos], r:[???]
        [op.POP_POS]                                        // p: [], r:[???]
      ) : [op.PUSH_EMPTY_ARRAY];
    },

    labeled(node, context) {
      let env = context.env;

      if (node.label !== null) { // auto labels may not have name
        env = Object.assign({}, env);
        // +1 for result of labeled expression
        context.env[node.label] = context.sp + 1;
      }
      if (node.auto) {
        // +1 for result of labeled expression
        context.auto.push({ label: node.label, sp: context.sp + 1 });
      }

      return generate(node.expression, {
        sp: context.sp,
        env: env,
        auto: [],
        action: null,
        reportFailures: context.reportFailures
      });
    },

    text(node, context) {
      let match = node.match|0;

      return buildSequence(
        // Position need only for TEXT, no need save it if node always fails
        match >= 0 ? [op.PUSH_CURR_POS] : [],     // p: [pos], r:[]
        generate(node.expression, {               // p: [pos], r:[exp]
          sp: context.sp,
          env: Object.assign({}, context.env),
          auto: [],
          action: null,
          reportFailures: context.reportFailures
        }),
        buildCondition(
          match,
          [op.IF_NOT_ERROR],
          [op.TEXT],                              // p: [pos], r:[txt]
          []                                      // p: [pos], r:[FAILED]
        ),
        match >= 0 ? [op.POP_POS] : []            // p: [], r:[?]
      );
    },

    simple_and(node, context) {
      return buildSimplePredicate(node.expression, false, context);
    },

    simple_not(node, context) {
      return buildSimplePredicate(node.expression, true, context);
    },

    optional(node, context) {
      return buildSequence(
        generate(node.expression, {
          sp: context.sp,
          env: Object.assign({}, context.env),
          auto: [],
          action: null,
          reportFailures: context.reportFailures
        }),
        buildCondition(
          // If expression always match no need replace FAILED to NULL
          -(node.expression.match|0),
          [op.IF_ERROR],
          buildSequence([op.POP], [op.PUSH_NULL]),
          []
        )
      );
    },

    zero_or_more(node, context) {
      let expressionCode = generate(node.expression, {
        sp: context.sp + 1, // +1 for array with result
        env: Object.assign({}, context.env),
        auto: [],
        action: null,
        reportFailures: context.reportFailures
      });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],            // p: [], r: [ [] ]
        expressionCode,                   // p: [], r: [ [], elem ]
        buildAppendLoop(expressionCode),  // p: [], r: [ [... elem], ??? ]
        [op.POP]                          // p: [], r: [ [...] ]
      );
    },

    one_or_more(node, context) {
      let expressionCode = generate(node.expression, {
        sp: context.sp + 1, // +1 for array with result
        env: Object.assign({}, context.env),
        auto: [],
        action: null,
        reportFailures: context.reportFailures
      });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildCondition(
          node.expression.match|0,
          [op.IF_NOT_ERROR],
          buildSequence(buildAppendLoop(expressionCode), [op.POP]),
          buildSequence([op.POP], [op.POP], [op.PUSH_FAILED])
        )
      );
    },

    range(node, context) {
      let expressionCode = generate(node.expression, {
        sp: context.sp + 1, // +1 for array with result
        env: Object.assign({}, context.env),
        auto: [],
        action: null,
        reportFailures: context.reportFailures
      });
      let match = node.expression.match|0;
      let bodyCode = buildRangeBody(node.delimiter, match, expressionCode, context);
      // Check high boundary, if it defined.
      let checkMaxCode = buildCheckMax(bodyCode, node.max, context);
      // For dynamic high boundary need check first iteration, because result can contain |0|
      // elements. Constant boundaries not needed such check, because it always >=1
      let firstElemCode = node.max.constant || node.max.value === null
                        ? expressionCode
                        : buildCheckMax(expressionCode, node.max, context);
      let mainLoopCode = buildSequence(
        [op.PUSH_EMPTY_ARRAY],            // var result = [];         p: [pos], r:[ [] ]
        firstElemCode,                    // var elem = expr();       p: [pos], r:[ [], elem ]
        buildAppendLoop(checkMaxCode),    // while(...)r.push(elem);  p: [pos], r:[ [...], elem|peg$FAILED ]
        [op.POP]                          //                          p: [pos], r:[ [...] ] (pop elem===`peg$FAILED`)
      );

      // Check low boundary, if it defined and not |0|.
      return buildCheckMin(mainLoopCode, node.min, context);
    },

    group(node, context) {
      return generate(node.expression, {
        sp: context.sp,
        env: Object.assign({}, context.env),
        auto: [],
        action: null,
        reportFailures: context.reportFailures
      });
    },

    semantic_and(node, context) {
      return buildSemanticPredicate(node, false, context);
    },

    semantic_not(node, context) {
      return buildSemanticPredicate(node, true, context);
    },

    rule_ref(node) {
      return [op.RULE, asts.indexOfRule(ast, node.name)];
    },

    literal(node, context) {
      if (node.value.length > 0) {
        let match = node.match|0;
        let needConst = match === 0 || (match > 0 && !node.ignoreCase);
        let stringIndex = needConst ? addLiteralConst(
          node.ignoreCase ? node.value.toLowerCase() : node.value
        ) : null;
        // Do not generate unused constant, if no need it
        let expectedIndex = context.reportFailures ? addExpectedConst({
          type: "literal",
          value: node.value,
          ignoreCase: node.ignoreCase
        }) : null;

        // For case-sensitive strings the value must match the beginning of the
        // remaining input exactly. As a result, we can use |ACCEPT_STRING| and
        // save one |substr| call that would be needed if we used |ACCEPT_N|.
        return buildSequence(
          context.reportFailures ? [op.EXPECT, expectedIndex] : [],
          buildCondition(
            match,
            node.ignoreCase
              ? [op.MATCH_STRING_IC, stringIndex]
              : [op.MATCH_STRING, stringIndex],
            node.ignoreCase
              ? [op.ACCEPT_N, node.value.length]
              : [op.ACCEPT_STRING, stringIndex],
            [op.PUSH_FAILED]
          )
        );
      }

      return [op.PUSH_EMPTY_STRING];
    },

    class(node, context) {
      let match = node.match|0;
      let classIndex = match === 0 ? addClassConst(node) : null;
      // Do not generate unused constant, if no need it
      let expectedIndex = context.reportFailures ? addExpectedConst({
        type: "class",
        value: node.parts,
        inverted: node.inverted,
        ignoreCase: node.ignoreCase
      }) : null;

      return buildSequence(
        context.reportFailures ? [op.EXPECT, expectedIndex] : [],
        buildCondition(
          match,
          [op.MATCH_CLASS, classIndex],
          [op.ACCEPT_N, 1],
          [op.PUSH_FAILED]
        )
      );
    },

    any(node, context) {
      // Do not generate unused constant, if no need it
      let expectedIndex = context.reportFailures ? addExpectedConst({ type: "any" }) : null;

      return buildSequence(
        context.reportFailures ? [op.EXPECT, expectedIndex] : [],
        buildCondition(
          node.match|0,
          [op.MATCH_ANY],
          [op.ACCEPT_N, 1],
          [op.PUSH_FAILED]
        )
      );
    }
  });

  generate(ast);
}

module.exports = generateBytecode;
