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
//  [8] BREAK n
//
//        if (n > 0) {
//          resStack.pop(n);
//          resStack.push(FAILED);
//        }
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
// [16] LOOP cond b
//
//        do {
//          interpret(ip + 3, ip + 3 + b);
//        } while (cond);
//
// Matching
// --------
//
// [17] MATCH_ANY
//
//        state.matchAny()
//
// [18] MATCH_LITERAL l
//
//        state.matchLiteral(l)
//
// [19] MATCH_LITERAL_IC l
//
//        state.matchLiteralIC(l)
//
// [20] MATCH_CLASS c
//
//        state.matchClass(c)
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

  function buildTryCondition(match, commonCode, thenCode, elseCode) {
    if (match > 0) { return thenCode; }
    if (match < 0) { return elseCode; }

    return commonCode;
  }

  function buildBreakCondition(match, condCode, n, thenCode, elseCode) {
    thenCode = buildSequence(thenCode, [op.BREAK, n]);

    if (match > 0) { return thenCode; }
    if (match < 0) { return elseCode; }

    return condCode.concat(
      [thenCode.length, 0],
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

  /**
   * Generates a code for check of upper bound if needed:
   * ```
   * IF_GE[_DYNAMIC] <max>  p:[] r:[[...]]
   *  * BREAK <0>           p:[] r:[[...]]
   * ```
   * @param {{ constant: boolean, value: (number|string)? }} max Upper bound
   * @param {number} sp Current top of result stack
   * @param {Object} env Mapping from label name to stack position for use by `IF_GE_DYNAMIC` opcode
   *
   * @return {number[]} Bytecode for cheking maximum elements count in array
   */
  function buildCheckMax(max, sp, env) {
    if (max !== null && max.value !== null) {
      let checkCode = max.constant
        ? [op.IF_GE, max.value]
        : [op.IF_GE_DYNAMIC, sp - env[max.value]];

      return buildCondition(0, checkCode, [op.BREAK, 0], []);
    }
    return [];
  }

  /**
   * Generates a code for check of lower bound if needed:
   * ```
   * PUSH_CURR_POS          p:[pos] r:[]
   * <expression>           p:[pos] r:[[...]]
   * IF_LT[_DYNAMIC] <min>
   *  * LOAD_CURR_POS
   *    POP                 p:[pos] r:[]
   *    PUSH_FAILED         p:[pos] r:[FAILED]
   * POP_POS                p:[] r:[[...]]
   * ```
   * @param {number[]} expressionCode Bytecode of expression
   * @param {{ constant: boolean, value: (number|string) }} min Lower bound
   * @param {number} sp Current top of result stack
   * @param {Object} env Mapping from label name to stack position for use by `IF_LT_DYNAMIC` opcode
   *
   * @return {number[]} Bytecode for cheking minimum elements count in array
   */
  function buildCheckMin(expressionCode, min, sp, env) {
    // When restriction is set and not constant or constant, but not |0|, check it
    if (min.value !== null && (!min.constant || min.value > 0)) {
      let checkCode = min.constant
        ? [op.IF_LT, min.value]
        : [op.IF_LT_DYNAMIC, sp - env[min.value]];

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

  /**
   * Generates a main range append code:
   * ```
   *                  <expression>        p:[pos] r:[[...] ?]
   *                  IF_ERROR
   * [if loadCurrPos]   * LOAD_CURR_POS
   *                      POP             p:[pos] r:[[...]]
   *                      BREAK <0>       p:[pos] r:[[...]]      ---.
   *                    * APPEND          p:[pos] r:[[..., e]]      |
   *                                                             <--'
   * ```
   * @param {number} match The sign defining a possibility of `expressionCode` to be matched successfully
   * @param {number[]} expressionCode Bytecode of expression
   * @param {boolean} loadCurrPos Restore position in case of failure
   *
   * @return {number[]} Bytecode for appending `expressionCode` result to array
   */
  function buildRangeAppend(match, expressionCode, loadCurrPos) {
    return buildSequence(
      expressionCode,                           // p:[] r:[[...] ?]
      buildCondition(
        -match,
        [op.IF_ERROR],
        buildSequence(
          loadCurrPos ? [op.LOAD_CURR_POS] : [],
          [op.POP],                             // p:[] r:[[...]]
          [op.BREAK, 0]
        ),
        [op.APPEND]                             // p:[] r:[[... e]]
      )
    );
  }

  function buildRangeBody(expression, delimiter, max, sp, context) {
    let match = expression.match|0;
    let expressionCode = generate(expression, {
      sp: sp,
      env: Object.assign({}, context.env),
      auto: [],
      action: null,
      reportFailures: context.reportFailures
    });
    let checkMaxCode  = buildCheckMax(max, sp, context.env);
    let parseNextCode = buildRangeAppend(match, expressionCode, delimiter !== null);

    if (delimiter !== null) {
      // LOOP false {
      //  * IF_GE_DYNAMIC <max>
      //      * BREAK <0>                                       -----------.
      //    PUSH_CURR_POS             p:[pos1 pos2] r:[[]]                 |
      //    LOOP true { <==================================================]====.
      //     * <expression>           p:[pos1 pos2] r:[[...] ?]            |    |
      //       IF_ERROR                                                    |    |
      //         * LOAD_CURR_POS                                           |    |
      //           POP                p:[pos1 pos2] r:[[...]]              |    |
      //           BREAK <0>                                    ---------. |    |
      //         * APPEND             p:[pos1 pos2] r:[[... e]]          | |    |
      //       IF_GE[_DYNAMIC] <max>                                     | |    |
      //         * BREAK <0>                                    -------. | |    |
      //       POP_POS                p:[pos1]      r:[[...]]          | | |    |
      //       PUSH_CURR_POS          p:[pos1 pos2] r:[[...]]          | | |    |
      //       <delimiter>            p:[pos1 pos2] r:[[...] ?]        | | |    |
      //       IF_ERROR                                                | | |    |
      //         * POP                p:[pos1 pos2] r:[[...]]          | | |    |
      //           BREAK <0>                                    -----. | | |    |
      //    } =====================================================]=]=]=]=]===='
      //    POP_POS                   p:[pos1]      r:[[...]]   <--+-+-+-' |
      // }                                                      <----------'
      let delimiterCode = buildSequence(
        [op.POP_POS],
        [op.PUSH_CURR_POS],
        generate(delimiter, {
          sp: sp,
          env: Object.assign({}, context.env),
          auto: [],
          action: null,
          reportFailures: context.reportFailures
        }),
        buildCondition(
          -(delimiter.match|0),
          [op.IF_ERROR],
          buildSequence([op.POP], [op.BREAK, 0]),
          []
        )
      );

      return buildLoop(
        [op.LOOP, 0],
        buildSequence(
          // For dynamic high boundary need check first iteration, because result can contain |0|
          // elements. Constant boundaries not needed such check, because it always >=1
          max.constant ? [] : checkMaxCode,
          [op.PUSH_CURR_POS],
          buildLoop(
            [op.LOOP, 1],
            buildSequence(parseNextCode, checkMaxCode, delimiterCode)
          ),
          [op.POP_POS]
        )
      );
    }
    // LOOP true {            p:[] r:[[...]]
    //   * IF_GE[_DYNAMIC] <max>
    //       * BREAK <0>      p:[] r:[[...]]     ----.
    //     <expression>       p:[] r:[[...] ?]       |
    //     IF_ERROR                                  |
    //       * POP            p:[] r:[[...]]         |
    //         BREAK <0>      p:[] r:[[...]]     --. |
    //       * APPEND         p:[] r:[[..., e]]    | |
    // }                                         <-+-'
    return buildLoop([op.LOOP, 1], buildSequence(checkMaxCode, parseNextCode));
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
      // Rule2 = A / B / C;
      // LOOP false
      //  * <alternative[0]>    p:[] r:[?]
      //    IF_NOT_ERROR
      //      * BREAK <0>       p:[] r:[a0]  -----.
      //    POP                 p:[] r:[]         |
      //  * <alternative[1]>    p:[] r:[?]        |
      //    IF_NOT_ERROR                          |
      //      * BREAK <0>       p:[] r:[a1]  ---. |
      //    POP                 p:[] r:[]       | |
      //  * <alternative[2]>    p:[] r:[?]      | |
      //                        p:[] r:[?]   <--+-'
      if ((node.match|0) < 0) { return [op.PUSH_FAILED]; }

      function buildAlternative(alternative, i, a) {
        let expressionCode = generate(alternative, {                // p: [], r:[?]
          sp: context.sp,
          env: Object.assign({}, context.env),
          auto: [],
          action: null,
          reportFailures: context.reportFailures
        });

        return i + 1 !== a.length ? buildSequence(
          expressionCode,
          buildBreakCondition(0, [op.IF_NOT_ERROR], 0, [], [op.POP])// p: [], r:[?]
        ) : expressionCode;
      }

      let alternatives = [];
      for (let i = 0; i < node.alternatives.length; ++i) {
        let alternative = node.alternatives[i];
        let match = alternative.match|0;

        // This alternative never match so not even try
        if (match < 0) { continue; }

        alternatives.push(alternative);

        // This alternative always match, other will not be even tryed, so end loop
        if (match > 0) { break; }
      }

      alternatives = alternatives.map(buildAlternative);

      return alternatives.length > 0
        ? buildLoop([op.LOOP, 0], buildSequence(...alternatives))   // p: [], r:[?]
        : [op.PUSH_EMPTY_STRING];                                   // p: [], r:['']
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
      // Rule1 = A B C;
      // PUSH_CURR_POS          p:[pos] r:[]
      // LOOP false
      //  * <element[0]>        p:[pos] r:[?]
      //    IF_ERROR
      //      * LOAD_CURR_POS   p:[pos] r:[FAILED]
      //        BREAK <1>       p:[pos] r:[FAILED]      -------.
      //  - <element[1]>        p:[pos] r:[e0 ?]               |
      //    IF_ERROR                                           |
      //      * LOAD_CURR_POS   p:[pos] r:[e0 FAILED]          |
      //        BREAK <2>       p:[pos] r:[FAILED]      -----. |
      //  - <element[2]>        p:[pos] r:[e0 e1 ?]          | |
      //    IF_ERROR                                         | |
      //      * LOAD_CURR_POS   p:[pos] r:[e0 e1 FAILED]     | |
      //        BREAK <3>       p:[pos] r:[FAILED]      ---. | |
      //  - WRAP <3>            p:[pos] r:[[e0 e1 e2]]     | | |
      // POP_POS                p:[] r:[?]              <--+-+-'
      let elements = node.elements.map(function(element, i) {
        return buildSequence(
          generate(element, {                             // p: [pos], r:[... exp]
            sp: context.sp + i,
            env: context.env,
            auto: context.auto,
            action: null,
            reportFailures: context.reportFailures
          }),
          buildBreakCondition(
            -(element.match|0),
            [op.IF_ERROR], i + 1,
            [op.LOAD_CURR_POS],
            []
          )
        );
      });

      function buildFinal(count) {
        let sp = context.sp + count;

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
          return [op.GET, count, sp - context.auto[0].sp];// p: [pos], r:[res]
        }

        return buildSequence(                             // p: [pos], r:[[...]]
          [op.WRAP_SOME, count, resultLen],
          context.auto.map(a => sp - a.sp)
        );
      }

      return node.elements.length > 0 ? buildSequence(
        [op.PUSH_CURR_POS],                               // p: [pos], r:[]
        buildLoop(
          [op.LOOP, 0],
          buildSequence(
            ...elements,                                  // p: [pos], r:[...]
            buildFinal(node.elements.length)              // p: [pos], r:[[...]]
          )
        ),
        [op.POP_POS]                                      // p: [], r:[?]
      ) : [op.PUSH_EMPTY_ARRAY];                          // p: [], r:[[]]
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
      // +1 for array with result
      let mainCode = buildRangeBody(node.expression, null, null, context.sp + 1, context);

      return buildSequence([op.PUSH_EMPTY_ARRAY], mainCode);
    },

    one_or_more(node, context) {
      // +1 for array with result
      let sp = context.sp + 1;
      let mainCode = buildRangeBody(node.expression, null, null, sp, context);

      // Check low boundary, if it defined and not |0|.
      return buildCheckMin(
        buildSequence([op.PUSH_EMPTY_ARRAY], mainCode),
        { constant: true, value: 1 }, sp, context.env
      );
    },

    range(node, context) {
      // Rule3 = A|x..y|;
      // [if has min] PUSH_CURR_POS          p:[pos] r:[]
      //              PUSH_EMPTY_ARRAY       p:[pos] r:[[]]
      //              LOOP true
      // [if has max]  * IF_GE <y>
      // [if has max]      * BREAK <0>       p:[pos] r:[[...]]      -----.
      //                 <expression>        p:[pos] r:[[...] e]         |
      //                 IF_ERROR                                        |
      //                   * POP             p:[pos] r:[[...]]           |
      //                     BREAK <0>       p:[pos] r:[[...]]      ---. |
      //                 APPEND              p:[pos] r:[[..., e]]      | |
      // [if has min] IF_LT <x>                                     <--+-'
      // [if has min]  * LOAD_CURR_POS       p:[pos] r:[[...]]
      // [if has min]    POP                 p:[pos] r:[]
      // [if has min]    PUSH_FAILED         p:[pos] r:[FAILED]
      // [if has min] POP_POS                p:[] r:[?]
      let sp = context.sp + 1; // +1 for array with result
      let mainCode = buildRangeBody(node.expression, node.delimiter, node.max, sp, context);

      // Check low boundary, if it defined and not |0|.
      return buildCheckMin(
        buildSequence([op.PUSH_EMPTY_ARRAY], mainCode),
        node.min, sp, context.env
      );
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
          buildTryCondition(
            match,
            node.ignoreCase
              ? [op.MATCH_LITERAL_IC, stringIndex]
              : [op.MATCH_LITERAL, stringIndex],
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
        buildTryCondition(
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
        buildTryCondition(
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
