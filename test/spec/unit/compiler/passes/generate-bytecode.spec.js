"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../../lib/compiler/passes/generate-bytecode");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |generateBytecode|", function() {
  function bytecodeDetails(bytecode) {
    return {
      rules: [{ bytecode: bytecode }]
    };
  }

  function constsDetails(literals, classes, expectations, functions) {
    return {
      literals: literals,
      classes: classes,
      expectations: expectations,
      functions: functions
    };
  }

  describe("for grammar", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST([
        "a = 'a'",
        "b = 'b'",
        "c = 'c'"
      ].join("\n"), {
        rules: [
          { bytecode: [23, 0, 18, 0, 2, 1, 22, 0, 3] },
          { bytecode: [23, 1, 18, 1, 2, 1, 22, 1, 3] },
          { bytecode: [23, 2, 18, 2, 2, 1, 22, 2, 3] }
        ]
      });
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST([
        "a = 'a'",
        "b = 'b'",
        "c = 'c'"
      ].join("\n"), constsDetails(
        ["a", "b", "c"],
        [],
        [
          { type: "literal", value: "a", ignoreCase: false },
          { type: "literal", value: "b", ignoreCase: false },
          { type: "literal", value: "c", ignoreCase: false }
        ],
        []
      ));
    });
  });

  describe("for rule", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = 'a'", bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3  // <expression>
      ]));
    });
  });

  describe("for named", function() {
    let grammar1 = "start 'start' = .";
    let grammar2 = "start 'start' = 'a'";
    let grammar3 = "start 'start' = [a]";

    describe("when |reportFailures=true|", function() {
      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar1, bytecodeDetails([
          23, 0,                        // EXPECT <0>
          28,                           // SILENT_FAILS_ON
          17, 2, 1, 21, 1, 3,           // <expression>
          29                            // SILENT_FAILS_OFF
        ]));
        expect(pass).to.changeAST(grammar2, bytecodeDetails([
          23, 0,                        // EXPECT <0>
          28,                           // SILENT_FAILS_ON
          18, 0, 2, 1, 22, 0, 3,        // <expression>
          29                            // SILENT_FAILS_OFF
        ]));
        expect(pass).to.changeAST(grammar3, bytecodeDetails([
          23, 0,                        // EXPECT <0>
          28,                           // SILENT_FAILS_ON
          20, 0, 2, 1, 21, 1, 3,        // <expression>
          29                            // SILENT_FAILS_OFF
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar1, constsDetails(
          [],
          [],
          [{ type: "rule", value: "start" }],
          []
        ));
        expect(pass).to.changeAST(grammar2, constsDetails(
          ["a"],
          [],
          [{ type: "rule", value: "start" }],
          []
        ));
        expect(pass).to.changeAST(grammar3, constsDetails(
          [],
          [{ value: ["a"], inverted: false, ignoreCase: false }],
          [{ type: "rule", value: "start" }],
          []
        ));
      });
    });

    describe("when |reportFailures=false|", function() {
      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar1, bytecodeDetails([
          17, 2, 1, 21, 1, 3            // <expression>
        ]), {}, { reportFailures: false });
        expect(pass).to.changeAST(grammar2, bytecodeDetails([
          18, 0, 2, 1, 22, 0, 3         // <expression>
        ]), {}, { reportFailures: false });
        expect(pass).to.changeAST(grammar3, bytecodeDetails([
          20, 0, 2, 1, 21, 1, 3         // <expression>
        ]), {}, { reportFailures: false });
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar1,
          constsDetails([], [], [], []),
          {},
          { reportFailures: false }
        );
        expect(pass).to.changeAST(grammar2, constsDetails(
          ["a"],
          [],
          [],
          []
        ), {}, { reportFailures: false });
        expect(pass).to.changeAST(grammar3, constsDetails(
          [],
          [{ value: ["a"], inverted: false, ignoreCase: false }],
          [],
          []
        ), {}, { reportFailures: false });
      });
    });
  });

  describe("for choice", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = 'a' / 'b' / 'c'", bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <alternatives[0]>
        14, 23, 0,                    // IF_ERROR
        6,                            //   * POP
        23, 1, 18, 1, 2, 1, 22, 1, 3, //     <alternatives[1]>
        14, 10, 0,                    //     IF_ERROR
        6,                            //       * POP
        23, 2, 18, 2, 2, 1, 22, 2, 3  //         <alternatives[2]>
      ]));
    });
  });

  describe("for action", function() {
    describe("without labels", function() {
      let grammar = "start = 'a' { code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
          15, 5, 0,                     // IF_NOT_ERROR
          24,                           //   * LOAD_SAVED_POS
          26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
          9                             // POP_POS
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          [{ predicate: false, params: [], body: " code " }]
        ));
      });

      it("defines only one constant for the same code and parameters", function() {
        expect(pass).to.changeAST("start = ('' { code }) ('' { code })", constsDetails(
          [],
          [],
          [],
          [{ predicate: false, params: [], body: " code " }]
        ));
      });
    });

    describe("with one label", function() {
      let grammar = "start = a:'a' { code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
          15, 6, 0,                     // IF_NOT_ERROR
          24,                           //   * LOAD_SAVED_POS
          26, 0, 1, 1, 0,               //     CALL <0>, pop 1, args [1]
          9                             // POP_POS
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          [{ predicate: false, params: ["a"], body: " code " }]
        ));
      });
    });

    describe("with multiple labels", function() {
      let grammar = "start = a:'a' b:'b' c:'c' { code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <elements[0]>
          15, 40, 3,                    // IF_NOT_ERROR
          23, 1, 18, 1, 2, 1, 22, 1, 3, //   * <elements[1]>
          15, 24, 4,                    //     IF_NOT_ERROR
          23, 2, 18, 2, 2, 1, 22, 2, 3, //       * <elements[2]>
          15, 8, 4,                     //         IF_NOT_ERROR
          24,                           //           * LOAD_SAVED_POS
          26, 0, 3, 3, 2, 1, 0,         //             CALL <0>, pop 3, args [2,1,0]
          8, 3,                         //           * POP_N <3>
          3,                            //             PUSH_FAILED
          7,                            //             LOAD_CURR_POS
          8, 2,                         //       * POP_N <2>
          3,                            //         PUSH_FAILED
          7,                            //         LOAD_CURR_POS
          6,                            //   * POP
          3,                            //     PUSH_FAILED
          7,                            //     LOAD_CURR_POS
          9,                            // POP_POS
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          [{ predicate: false, params: ["a", "b", "c"], body: " code " }]
        ));
      });

      it("defines only one constant for the same code and parameters", function() {
        expect(pass).to.changeAST("start = a:'' b:'' c:'' ('' { code }) ('' { code })", constsDetails(
          [],
          [],
          [],
          [{ predicate: false, params: ["a", "b", "c"], body: " code " }]
        ));
      });
    });
  });

  describe("for sequence", function() {
    describe("empty", function() {
      let grammar = "start = ";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          4      // PUSH_EMPTY_ARRAY
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails([], [], [], []));
      });
    });

    describe("non-empty", function() {
      let grammar = "start = 'a' 'b' 'c'";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <elements[0]>
          15, 34, 3,                    // IF_NOT_ERROR
          23, 1, 18, 1, 2, 1, 22, 1, 3, //   * <elements[1]>
          15, 18, 4,                    //     IF_NOT_ERROR
          23, 2, 18, 2, 2, 1, 22, 2, 3, //       * <elements[2]>
          15, 2, 4,                     //         IF_NOT_ERROR
          11, 3,                        //           * WRAP <3>
          8, 3,                         //           * POP_N <3>
          3,                            //             PUSH_FAILED
          7,                            //             LOAD_CURR_POS
          8, 2,                         //       * POP_N <2>
          3,                            //         PUSH_FAILED
          7,                            //         LOAD_CURR_POS
          6,                            //   * POP
          3,                            //     PUSH_FAILED
          7,                            //     LOAD_CURR_POS
          9,                            // POP_POS
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          []
        ));
      });
    });
  });

  describe("for labeled", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = a:'a'", bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3  // <expression>
      ]));
      expect(pass).to.changeAST("start = @'a'", bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3  // <expression>
      ]));
      expect(pass).to.changeAST("start = @a:'a'", bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3  // <expression>
      ]));
    });

    describe("with one auto-labels", function() {
      it("generates correct bytecode", function() {
        expect(pass).to.changeAST("start = @'a' 'b' 'c'", bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <elements[0]>
          15, 35, 3,                    // IF_NOT_ERROR
          23, 1, 18, 1, 2, 1, 22, 1, 3, //   * <elements[1]>
          15, 19, 4,                    //     IF_NOT_ERROR
          23, 2, 18, 2, 2, 1, 22, 2, 3, //       * <elements[2]>
          15, 3, 4,                     //         IF_NOT_ERROR
          36, 3, 2,                     //           * GET <2>, pop 3
          8, 3,                         //           * POP_N <3>
          3,                            //             PUSH_FAILED
          7,                            //             LOAD_CURR_POS
          8, 2,                         //       * POP_N <2>
          3,                            //         PUSH_FAILED
          7,                            //         LOAD_CURR_POS
          6,                            //   * POP
          3,                            //     PUSH_FAILED
          7,                            //     LOAD_CURR_POS
          9,                            // POP_POS
        ]));
      });
    });

    describe("with multiply auto-labels", function() {
      it("generates correct bytecode", function() {
        expect(pass).to.changeAST("start = @'a' 'b' @'c'", bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <elements[0]>
          15, 37, 3,                    // IF_NOT_ERROR
          23, 1, 18, 1, 2, 1, 22, 1, 3, //   * <elements[1]>
          15, 21, 4,                    //     IF_NOT_ERROR
          23, 2, 18, 2, 2, 1, 22, 2, 3, //       * <elements[2]>
          15, 5, 4,                     //         IF_NOT_ERROR
          37, 3, 2, 2, 0,               //           * WRAP_SOME <[2, 0]>, pop 3
          8, 3,                         //           * POP_N <3>
          3,                            //             PUSH_FAILED
          7,                            //             LOAD_CURR_POS
          8, 2,                         //       * POP_N <2>
          3,                            //         PUSH_FAILED
          7,                            //         LOAD_CURR_POS
          6,                            //   * POP
          3,                            //     PUSH_FAILED
          7,                            //     LOAD_CURR_POS
          9,                            // POP_POS
        ]));
      });
    });
  });

  describe("for text", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST("start = $'a'", bytecodeDetails([
        5,                            // PUSH_CURR_POS
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
        15, 2, 1,                     // IF_NOT_ERROR
        6,                            //   * POP
        12,                           //     TEXT
        9                             //   * POP_POS
      ]));
    });
  });

  describe("for simple_and", function() {
    let grammar = "start = &'a'";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        5,                            // PUSH_CURR_POS
        38,                           // EXPECT_NS_BEGIN
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
        39, 0,                        // EXPECT_NS_END <false>
        15, 3, 2,                     // IF_NOT_ERROR
        6,                            //   * POP
        1,                            //     PUSH_UNDEFINED
        7,                            //     LOAD_CURR_POS
        6,                            //   * POP
        3,                            //     PUSH_FAILED
        9,                            // POP_POS
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for simple_not", function() {
    let grammar = "start = !'a'";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        5,                            // PUSH_CURR_POS
        38,                           // EXPECT_NS_BEGIN
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
        39, 1,                        // EXPECT_NS_END <true>
        14, 2, 3,                     // IF_ERROR
        6,                            //   * POP
        1,                            //     PUSH_UNDEFINED
        6,                            //   * POP
        3,                            //     PUSH_FAILED
        7,                            //     LOAD_CURR_POS
        9,                            // POP_POS
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for optional", function() {
    let grammar = "start = 'a'?";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
        14, 2, 0,                     // IF_ERROR
        6,                            //   * POP
        2                             //     PUSH_NULL
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for zero_or_more", function() {
    let grammar = "start = 'a'*";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        4,                            // PUSH_EMPTY_ARRAY
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
        16, 10,                       // WHILE_NOT_ERROR
        10,                           //   * APPEND
        23, 0, 18, 0, 2, 1, 22, 0, 3, //     <expression>
        6                             // POP
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for one_or_more", function() {
    let grammar = "start = 'a'+";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        4,                            // PUSH_EMPTY_ARRAY
        23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
        15, 13, 3,                    // IF_NOT_ERROR
        16, 10,                       //   * WHILE_NOT_ERROR
        10,                           //       * APPEND
        23, 0, 18, 0, 2, 1, 22, 0, 3, //         <expression>
        6,                            //     POP
        6,                            //   * POP
        6,                            //     POP
        3                             //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for range", function() {
    describe("| .. | (edge case -- no boundaries)", function() {
      let grammar = "start = 'a'| .. |";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          4,                            // PUSH_EMPTY_ARRAY
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
          16, 10,                       // WHILE_NOT_ERROR
          10,                           //   * APPEND
          23, 0, 18, 0, 2, 1, 22, 0, 3, //     <expression>
          6                             // POP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          []
        ));
      });
    });

    describe("constant boudaries", function() {
      describe("| ..3| (edge case -- no min boundary)", function() {
        let grammar = "start = 'a'| ..3|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 15,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            31, 3, 1, 9,                  //     IF_GE <3>
            3,                            //       * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //       * <expression>
            6                             // POP
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("| ..1| (edge case -- no min boundary -- same as |optional|)", function() {
        let grammar = "start = 'a'| ..1|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 15,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            31, 1, 1, 9,                  //     IF_GE <1>
            3,                            //       * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //       * <expression>
            6                             // POP
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("|2.. | (edge case -- no max boundary)", function() {
        let grammar = "start = 'a'|2.. |";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 10,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            23, 0, 18, 0, 2, 1, 22, 0, 3, //     <expression>
            6,                            // POP
            30, 2, 3, 0,                  // IF_LT <2>
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("|0.. | (edge case -- no max boundary -- same as |zero or more|)", function() {
        let grammar = "start = 'a'|0.. |";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 10,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            23, 0, 18, 0, 2, 1, 22, 0, 3, //     <expression>
            6                             // POP
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("|1.. | (edge case -- no max boundary -- same as |one or more|)", function() {
        let grammar = "start = 'a'|1.. |";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 10,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            23, 0, 18, 0, 2, 1, 22, 0, 3, //     <expression>
            6,                            // POP
            30, 1, 3, 0,                  // IF_LT <1>
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("|2..3|", function() {
        let grammar = "start = 'a'|2..3|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 15,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            31, 3, 1, 9,                  //     IF_GE <3>
            3,                            //       * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //       * <expression>
            6,                            // POP
            30, 2, 3, 0,                  // IF_LT <2>
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("| 42 | (edge case -- exact repetitions)", function() {
        let grammar = "start = 'a'|42|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, // <expression>
            16, 15,                       // WHILE_NOT_ERROR
            10,                           //   * APPEND
            31, 42, 1, 9,                 //     IF_GE <42>
            3,                            //       * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //       * <expression>
            6,                            // POP
            30, 42, 3, 0,                 // IF_LT <42>
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });
    });

    describe("variable boudaries", function() {
      describe("| ..x| (edge case -- no min boundary)", function() {
        let grammar = "start = max:({return 42;}) 'a'| ..max|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            // {return 42;}
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            15, 5, 0,                     // IF_NOT_ERROR
            24,                           //   * LOAD_SAVED_POS
            26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
            9,                            // POP_POS

            15, 42, 3,                    // IF_NOT_ERROR
            // "a"| ..max|
            4,                            //   * PUSH_EMPTY_ARRAY
            33, 1, 1, 9,                  //     IF_GE_DYNAMIC <1>
            3,                            //       * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //       * <expression>
            16, 15,                       //     WHILE_NOT_ERROR
            10,                           //       * APPEND
            33, 1, 1, 9,                  //         IF_GE_DYNAMIC <1>
            3,                            //           * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //           * <expression>
            6,                            //     POP

            15, 2, 4,                     //     IF_NOT_ERROR
            11, 2,                        //       * WRAP <2>
            8, 2,                         //       * POP_N <2>
            3,                            //         PUSH_FAILED
            7,                            //         LOAD_CURR_POS
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            [{ predicate: false, params: [], body: "return 42;" }]
          ));
        });
      });

      describe("|x.. | (edge case -- no max boundary)", function() {
        let grammar = "start = min:({return 42;}) 'a'|min.. |";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            // {return 42;}
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            15, 5, 0,                     // IF_NOT_ERROR
            24,                           //   * LOAD_SAVED_POS
            26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
            9,                            // POP_POS

            15, 41, 3,                    // IF_NOT_ERROR
            // "a"|min..|
            5,                            //   * PUSH_CURR_POS
            4,                            //     PUSH_EMPTY_ARRAY
            23, 0, 18, 0, 2, 1, 22, 0, 3, //     <expression>
            16, 10,                       //     WHILE_NOT_ERROR
            10,                           //       * APPEND
            23, 0, 18, 0, 2, 1, 22, 0, 3, //         <expression>
            6,                            //     POP
            32, 1, 3, 0,                  //     IF_LT_DYNAMIC <1>
            6,                            //       * POP
            3,                            //         PUSH_FAILED
            7,                            //         LOAD_CURR_POS
            9,                            //     POP_POS

            15, 2, 4,                     //     IF_NOT_ERROR
            11, 2,                        //       * WRAP <2>
            8, 2,                         //       * POP_N <2>
            3,                            //         PUSH_FAILED
            7,                            //         LOAD_CURR_POS
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            [{ predicate: false, params: [], body: "return 42;" }]
          ));
        });
      });

      describe("|x..y|", function() {
        let grammar = "start = min:({return 42;}) max:({return 42;}) 'a'|min..max|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            // {return 42;} - min
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            15, 5, 0,                     // IF_NOT_ERROR
            24,                           //   * LOAD_SAVED_POS
            26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
            9,                            // POP_POS

            15, 70, 3,                    // IF_NOT_ERROR
            // {return 42;} - max
            5,                            //   * PUSH_CURR_POS
            4,                            //     PUSH_EMPTY_ARRAY
            15, 6, 0,                     //     IF_NOT_ERROR
            24,                           //       * LOAD_SAVED_POS
            26, 1, 1, 1, 1,               //         CALL <1>, pop 1, args [1]
            9,                            //     POP_POS
            15, 51, 4,                    //     IF_NOT_ERROR
            // "a"|min..max|
            5,                            //       * PUSH_CURR_POS
            4,                            //         PUSH_EMPTY_ARRAY
            33, 1, 1, 9,                  //         IF_GE_DYNAMIC <1>
            3,                            //           * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //           * <expression>
            16, 15,                       //         WHILE_NOT_ERROR
            10,                           //           * APPEND
            33, 1, 1, 9,                  //             IF_GE_DYNAMIC <1>
            3,                            //               * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //               * <expression>
            6,                            //         POP
            32, 2, 3, 0,                  //         IF_LT_DYNAMIC <2>
            6,                            //           * POP
            3,                            //             PUSH_FAILED
            7,                            //             LOAD_CURR_POS
            9,                            //         POP_POS

            15, 2, 4,                     //         IF_NOT_ERROR
            11, 3,                        //           * WRAP <3>
            8, 3,                         //           * POP_N <3>
            3,                            //             PUSH_FAILED
            7,                            //             LOAD_CURR_POS
            8, 2,                         //       * POP_N <2>
            3,                            //         PUSH_FAILED
            7,                            //         LOAD_CURR_POS
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            [
              { predicate: false, params: [],      body: "return 42;" },
              { predicate: false, params: ["min"], body: "return 42;" },
            ]
          ));
        });
      });

      describe("|exact| (edge case -- exact repetitions)", function() {
        let grammar = "start = exact:({return 42;}) 'a'|exact|";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            5,                            // PUSH_CURR_POS
            // {return 42;}
            5,                            // PUSH_CURR_POS
            4,                            // PUSH_EMPTY_ARRAY
            15, 5, 0,                     // IF_NOT_ERROR
            24,                           //   * LOAD_SAVED_POS
            26, 0, 1, 0,                  //     CALL <0>, pop 1, args []
            9,                            // POP_POS

            15, 51, 3,                    // IF_NOT_ERROR
            // "a"|exact|
            5,                            //   * PUSH_CURR_POS
            4,                            //     PUSH_EMPTY_ARRAY
            33, 1, 1, 9,                  //     IF_GE_DYNAMIC <1>
            3,                            //       * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //       * <expression>
            16, 15,                       //     WHILE_NOT_ERROR
            10,                           //       * APPEND
            33, 1, 1, 9,                  //         IF_GE_DYNAMIC <1>
            3,                            //           * PUSH_FAILED
            23, 0, 18, 0, 2, 1, 22, 0, 3, //           * <expression>
            6,                            //     POP
            32, 1, 3, 0,                  //     IF_LT_DYNAMIC <1>
            6,                            //       * POP
            3,                            //         PUSH_FAILED
            7,                            //         LOAD_CURR_POS
            9,                            //     POP_POS

            15, 2, 4,                     //     IF_NOT_ERROR
            11, 2,                        //       * WRAP <2>
            8, 2,                         //       * POP_N <2>
            3,                            //         PUSH_FAILED
            7,                            //         LOAD_CURR_POS
            6,                            //   * POP
            3,                            //     PUSH_FAILED
            7,                            //     LOAD_CURR_POS
            9,                            // POP_POS
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            [{ predicate: false, params: [], body: "return 42;" }]
          ));
        });
      });
    });
  });

  describe("for group", function() {
    let grammar = "start = ('a')";

    it("generates correct bytecode", function() {
      expect(pass).to.changeAST(grammar, bytecodeDetails([
        23, 0, 18, 0, 2, 1, 22, 0, 3  // <expression>
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).to.changeAST(grammar, constsDetails(
        ["a"],
        [],
        [{ type: "literal", value: "a", ignoreCase: false }],
        []
      ));
    });
  });

  describe("for semantic_and", function() {
    describe("without labels", function() {
      let grammar = "start = &{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          25,            // UPDATE_SAVED_POS
          26, 0, 0, 0,   // CALL <0>, pop 0, args []
          13, 2, 2,      // IF
          6,             //   * POP
          1,             //     PUSH_UNDEFINED
          6,             //   * POP
          3              //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar,
          constsDetails(
            [],
            [],
            [],
            [{ predicate: true, params: [], body: " code " }]
          )
        );
      });

      it("defines only one constant for the same code and parameters", function() {
        expect(pass).to.changeAST("start = &{ code } &{ code }", constsDetails(
          [],
          [],
          [],
          [{ predicate: true, params: [], body: " code " }]
        ));
      });
    });

    describe("with labels", function() {
      let grammar = "start = a:'a' b:'b' c:'c' &{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <elements[0]>
          15, 56, 3,                    // IF_NOT_ERROR
          23, 1, 18, 1, 2, 1, 22, 1, 3, //   * <elements[1]>
          15, 40, 4,                    //     IF_NOT_ERROR
          23, 2, 18, 2, 2, 1, 22, 2, 3, //       * <elements[2]>
          15, 24, 4,                    //         IF_NOT_ERROR
          25,                           //           * UPDATE_SAVED_POS
          26, 0, 0, 3, 2, 1, 0,         //             CALL <0>, pop 0, args [2,1,0]
          13, 2, 2,                     //             IF
          6,                            //               * POP
          1,                            //                 PUSH_UNDEFINED
          6,                            //               * POP
          3,                            //                 PUSH_FAILED
          15, 2, 4,                     //             IF_NOT_ERROR
          11, 4,                        //               * WRAP <4>
          8, 4,                         //               * POP_N <4>
          3,                            //                 PUSH_FAILED
          7,                            //                 LOAD_CURR_POS
          8, 3,                         //           * POP_N <3>
          3,                            //             PUSH_FAILED
          7,                            //             LOAD_CURR_POS
          8, 2,                         //       * POP_N <2>
          3,                            //         PUSH_FAILED
          7,                            //         LOAD_CURR_POS
          6,                            //   * POP
          3,                            //     PUSH_FAILED
          7,                            //     LOAD_CURR_POS
          9,                            // POP_POS
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          [{ predicate: true, params: ["a", "b", "c"], body: " code " }]
        ));
      });

      it("defines only one constant for the same code and parameters", function() {
        expect(pass).to.changeAST("start = a:'' b:'' c:'' &{ code } &{ code }", constsDetails(
          [],
          [],
          [],
          [{ predicate: true, params: ["a", "b", "c"], body: " code " }]
        ));
      });
    });
  });

  describe("for semantic_not", function() {
    describe("without labels", function() {
      let grammar = "start = !{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          25,            // UPDATE_SAVED_POS
          26, 0, 0, 0,   // CALL <0>, pop 0, args []
          13, 2, 2,      // IF
          6,             //   * POP
          3,             //     PUSH_FAILED
          6,             //   * POP
          1              //     PUSH_UNDEFINED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar,
          constsDetails(
            [],
            [],
            [],
            [{ predicate: true, params: [], body: " code " }]
          )
        );
      });

      it("defines only one constant for the same code and parameters", function() {
        expect(pass).to.changeAST("start = !{ code } !{ code }", constsDetails(
          [],
          [],
          [],
          [{ predicate: true, params: [], body: " code " }]
        ));
      });
    });

    describe("with labels", function() {
      let grammar = "start = a:'a' b:'b' c:'c' !{ code }";

      it("generates correct bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          5,                            // PUSH_CURR_POS
          23, 0, 18, 0, 2, 1, 22, 0, 3, // <elements[0]>
          15, 56, 3,                    // IF_NOT_ERROR
          23, 1, 18, 1, 2, 1, 22, 1, 3, //   * <elements[1]>
          15, 40, 4,                    //     IF_NOT_ERROR
          23, 2, 18, 2, 2, 1, 22, 2, 3, //       * <elements[2]>
          15, 24, 4,                    //         IF_NOT_ERROR
          25,                           //           * UPDATE_SAVED_POS
          26, 0, 0, 3, 2, 1, 0,         //             CALL <0>, pop 0, args [2,1,0]
          13, 2, 2,                     //             IF
          6,                            //               * POP
          3,                            //                 PUSH_FAILED
          6,                            //               * POP
          1,                            //                 PUSH_UNDEFINED
          15, 2, 4,                     //             IF_NOT_ERROR
          11, 4,                        //               * WRAP <4>
          8, 4,                         //               * POP_N <4>
          3,                            //                 PUSH_FAILED
          7,                            //                 LOAD_CURR_POS
          8, 3,                         //           * POP_N <3>
          3,                            //             PUSH_FAILED
          7,                            //             LOAD_CURR_POS
          8, 2,                         //       * POP_N <2>
          3,                            //         PUSH_FAILED
          7,                            //         LOAD_CURR_POS
          6,                            //   * POP
          3,                            //     PUSH_FAILED
          7,                            //     LOAD_CURR_POS
          9,                            // POP_POS
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(grammar, constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false }
          ],
          [{ predicate: true, params: ["a", "b", "c"], body: " code " }]
        ));
      });

      it("defines only one constant for the same code and parameters", function() {
        expect(pass).to.changeAST("start = a:'' b:'' c:'' !{ code } !{ code }", constsDetails(
          [],
          [],
          [],
          [{ predicate: true, params: ["a", "b", "c"], body: " code " }]
        ));
      });
    });
  });

  describe("for rule_ref", function() {
    it("generates correct bytecode", function() {
      expect(pass).to.changeAST([
        "start = other",
        "other = 'other'"
      ].join("\n"), {
        rules: [
          {
            bytecode: [27, 1]   // RULE
          },
          { }
        ]
      });
    });
  });

  describe("for literal", function() {
    describe("when |reportFailures=true|", function() {
      describe("empty", function() {
        let grammar = "start = ''";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            0   // PUSH_EMPTY_STRING
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails([], [], [], []));
        });
      });

      describe("non-empty case-sensitive", function() {
        let grammar = "start = 'a'";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            23, 0,         // EXPECT <0>
            18, 0, 2, 1,   // MATCH_STRING <0>
            22, 0,         //   * ACCEPT_STRING <0>
            3              //   * PUSH_FAILED
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          ));
        });
      });

      describe("non-empty case-insensitive", function() {
        let grammar = "start = 'A'i";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            23, 0,         // EXPECT <0>
            19, 0, 2, 1,   // MATCH_STRING_IC <0>
            21, 1,         //   * ACCEPT_N <1>
            3              //   * PUSH_FAILED
          ]));
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "A", ignoreCase: true }],
            []
          ));
        });
      });

      it("defines only one constant for the same literals", function() {
        expect(pass).to.changeAST("start = 'a' 'a'", constsDetails(
          ["a"],
          [],
          [{ type: "literal", value: "a", ignoreCase: false }],
          []
        ));
      });
    });

    describe("when |reportFailures=false|", function() {
      describe("empty", function() {
        let grammar = "start = ''";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            0   // PUSH_EMPTY_STRING
          ]), {}, { reportFailures: false });
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            [], [], [], []
          ), {}, { reportFailures: false });
        });
      });

      describe("non-empty case-sensitive", function() {
        let grammar = "start = 'a'";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            18, 0, 2, 1,   // MATCH_STRING <0>
            22, 0,         //   * ACCEPT_STRING <0>
            3              //   * PUSH_FAILED
          ]), {}, { reportFailures: false });
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"], [], [], []
          ), {}, { reportFailures: false });
        });
      });

      describe("non-empty case-insensitive", function() {
        let grammar = "start = 'A'i";

        it("generates correct bytecode", function() {
          expect(pass).to.changeAST(grammar, bytecodeDetails([
            19, 0, 2, 1,   // MATCH_STRING_IC <0>
            21, 1,         //   * ACCEPT_N <1>
            3              //   * PUSH_FAILED
          ]), {}, { reportFailures: false });
        });

        it("defines correct constants", function() {
          expect(pass).to.changeAST(grammar, constsDetails(
            ["a"], [], [], []
          ), {}, { reportFailures: false });
        });
      });

      it("defines only one constant for the same literals", function() {
        expect(pass).to.changeAST("start = 'a' 'a'", constsDetails(
          ["a"],
          [],
          [],
          []
        ), {}, { reportFailures: false });
      });
    });
  });

  describe("for class", function() {
    describe("when |reportFailures=true|", function() {
      it("generates correct bytecode", function() {
        expect(pass).to.changeAST("start = [a]", bytecodeDetails([
          23, 0,         // EXPECT <0>
          20, 0, 2, 1,   // MATCH_CLASS <0>
          21, 1,         //   * ACCEPT_N <1>
          3              //   * PUSH_FAILED
        ]));
      });

      describe("non-inverted case-sensitive", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [a]", constsDetails(
            [],
            [{ value: ["a"], inverted: false, ignoreCase: false }],
            [{ type: "class", value: ["a"], inverted: false, ignoreCase: false }],
            []
          ));
        });
      });

      describe("inverted case-sensitive", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [^a]", constsDetails(
            [],
            [{ value: ["a"], inverted: true, ignoreCase: false }],
            [{ type: "class", value: ["a"], inverted: true, ignoreCase: false }],
            []
          ));
        });
      });

      describe("non-inverted case-insensitive", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [a]i", constsDetails(
            [],
            [{ value: ["a"], inverted: false, ignoreCase: true }],
            [{ type: "class", value: ["a"], inverted: false, ignoreCase: true }],
            []
          ));
        });
      });

      describe("complex", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [ab-def-hij-l]", constsDetails(
            [],
            [
              {
                value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]],
                inverted: false,
                ignoreCase: false
              }
            ],
            [
              {
                type: "class",
                value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]],
                inverted: false,
                ignoreCase: false
              }
            ],
            []
          ));
        });
      });

      it("defines only one constant for the same classes", function() {
        expect(pass).to.changeAST("start = [a] [a]", constsDetails(
          [],
          [{ value: ["a"], inverted: false, ignoreCase: false }],
          [{ type: "class", value: ["a"], inverted: false, ignoreCase: false }],
          []
        ));
      });
    });

    describe("when |reportFailures=false|", function() {
      it("generates correct bytecode", function() {
        expect(pass).to.changeAST("start = [a]", bytecodeDetails([
          20, 0, 2, 1,   // MATCH_CLASS <0>
          21, 1,         //   * ACCEPT_N <1>
          3              //   * PUSH_FAILED
        ]), {}, { reportFailures: false });
      });

      describe("non-inverted case-sensitive", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [a]", constsDetails(
            [], [{ value: ["a"], inverted: false, ignoreCase: false }], [], []
          ), {}, { reportFailures: false });
        });
      });

      describe("inverted case-sensitive", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [^a]", constsDetails(
            [], [{ value: ["a"], inverted: true, ignoreCase: false }], [], []
          ), {}, { reportFailures: false });
        });
      });

      describe("non-inverted case-insensitive", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [a]i", constsDetails(
            [], [{ value: ["a"], inverted: false, ignoreCase: true }], [], []
          ), {}, { reportFailures: false });
        });
      });

      describe("complex", function() {
        it("defines correct constants", function() {
          expect(pass).to.changeAST("start = [ab-def-hij-l]", constsDetails(
            [],
            [
              {
                value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]],
                inverted: false,
                ignoreCase: false
              }
            ],
            [],
            []
          ), {}, { reportFailures: false });
        });
      });

      it("defines only one constant for the same classes", function() {
        expect(pass).to.changeAST("start = [a] [a]", constsDetails(
          [],
          [{ value: ["a"], inverted: false, ignoreCase: false }],
          [],
          []
        ), {}, { reportFailures: false });
      });
    });
  });

  describe("for any", function() {
    describe("when |reportFailures=true|", function() {
      let grammar = "start = .";

      it("generates bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          23, 0,      // EXPECT <0>
          17, 2, 1,   // MATCH_ANY
          21, 1,      //   * ACCEPT_N <1>
          3           //   * PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar,
          constsDetails([], [], [{ type: "any" }], [])
        );
      });
    });

    describe("when |reportFailures=false|", function() {
      let grammar = "start = .";

      it("generates bytecode", function() {
        expect(pass).to.changeAST(grammar, bytecodeDetails([
          17, 2, 1,   // MATCH_ANY
          21, 1,      //   * ACCEPT_N <1>
          3           //   * PUSH_FAILED
        ]), {}, { reportFailures: false });
      });

      it("defines correct constants", function() {
        expect(pass).to.changeAST(
          grammar,
          constsDetails([], [], [], []),
          {},
          { reportFailures: false }
        );
      });
    });
  });

  it("defines different constants for predicate and action for the same code and parameters", function() {
    expect(pass).to.changeAST("start = &{ code } { code }", constsDetails(
      [],
      [],
      [],
      [
        { predicate: true,  params: [], body: " code " },
        { predicate: false, params: [], body: " code " }
      ]
    ));
    expect(pass).to.changeAST("start = a:'' b:'' c:'' &{ code } { code }", constsDetails(
      [],
      [],
      [],
      [
        { predicate: true,  params: ["a", "b", "c"], body: " code " },
        { predicate: false, params: ["a", "b", "c"], body: " code " }
      ]
    ));

    expect(pass).to.changeAST("start = !{ code } { code }", constsDetails(
      [],
      [],
      [],
      [
        { predicate: true,  params: [], body: " code " },
        { predicate: false, params: [], body: " code " }
      ]
    ));
    expect(pass).to.changeAST("start = a:'' b:'' c:'' !{ code } { code }", constsDetails(
      [],
      [],
      [],
      [
        { predicate: true,  params: ["a", "b", "c"], body: " code " },
        { predicate: false, params: ["a", "b", "c"], body: " code " }
      ]
    ));
  });

  it("defines only one constants for positive and negative predicates for the same code and parameters", function() {
    expect(pass).to.changeAST("start = &{ code } !{ code }", constsDetails(
      [],
      [],
      [],
      [{ predicate: true,  params: [], body: " code " }]
    ));

    expect(pass).to.changeAST("start = a:'' b:'' c:'' &{ code } !{ code }", constsDetails(
      [],
      [],
      [],
      [{ predicate: true,  params: ["a", "b", "c"], body: " code " }]
    ));
  });
});
