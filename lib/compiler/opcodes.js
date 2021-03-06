"use strict";

// Bytecode instruction opcodes.
let opcodes = {
  // Result Stack Manipulation

  PUSH_EMPTY_STRING: 0,    // PUSH_EMPTY_STRING
  PUSH_UNDEFINED:    1,    // PUSH_UNDEFINED
  PUSH_NULL:         2,    // PUSH_NULL
  PUSH_FAILED:       3,    // PUSH_FAILED
  PUSH_EMPTY_ARRAY:  4,    // PUSH_EMPTY_ARRAY
  POP:               6,    // POP
  BREAK:             8,    // BREAK n
  GET:               36,   // GET n, i
  APPEND:            10,   // APPEND
  WRAP:              11,   // WRAP n
  WRAP_SOME:         37,   // WRAP_SOME n, c, p1, ..., pC
  TEXT:              12,   // TEXT

  // Position Stack Manipulation

  PUSH_CURR_POS:     5,    // PUSH_CURR_POS
  LOAD_CURR_POS:     7,    // LOAD_CURR_POS
  POP_POS:           9,    // POP_POS

  // Conditions and Loops

  IF:                13,   // IF t, f
  IF_ERROR:          14,   // IF_ERROR t, f
  IF_NOT_ERROR:      15,   // IF_NOT_ERROR t, f
  IF_LT:             30,   // IF_LT min, t, f
  IF_GE:             31,   // IF_GE max, t, f
  IF_LT_DYNAMIC:     32,   // IF_LT_DYNAMIC min, t, f
  IF_GE_DYNAMIC:     33,   // IF_GE_DYNAMIC max, t, f
  LOOP:              41,   // LOOP cond b

  // Matching

  MATCH_ANY:         17,   // MATCH_ANY
  MATCH_LITERAL:     18,   // MATCH_LITERAL l
  MATCH_LITERAL_IC:  19,   // MATCH_LITERAL_IC l
  MATCH_CLASS:       20,   // MATCH_CLASS c
  ACCEPT_N:          21,   // ACCEPT_N n
  ACCEPT_STRING:     22,   // ACCEPT_STRING s
  EXPECT:            23,   // EXPECT e

  // Calls

  LOAD_SAVED_POS:    24,   // LOAD_SAVED_POS p
  UPDATE_SAVED_POS:  25,   // UPDATE_SAVED_POS
  CALL:              26,   // CALL f, n, pc, p1, p2, ..., pN

  // Rules

  RULE:              27,   // RULE r

  // Failure Reporting

  SILENT_FAILS_ON:   28,   // SILENT_FAILS_ON
  SILENT_FAILS_OFF:  29,   // SILENT_FAILS_OFF

  EXPECT_NS_BEGIN:   38,   // EXPECT_NS_BEGIN
  EXPECT_NS_END:     39    // EXPECT_NS_END invert
};

module.exports = opcodes;
