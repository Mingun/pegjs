"use strict";

class Stack {
  constructor(ruleName, varName, type) {
    /** Last used variable in the stack. */
    this.sp       = -1;
    /** Maximum stack size. */
    this.maxSp    = -1;
    this.varName  = varName;
    this.ruleName = ruleName;
    this.type     = type;
  }

  /**
   * Returns name of the variable at the index `i`.
   *
   * @param {number} i Index for which name must be generated
   * @return {string} Generated name
   *
   * @throws {RangeError} If `i < 0` which means stack underflow (there a more `pop`'s than `push`'s)
   */
  name(i) {
    if (i < 0) {
      throw new RangeError(
        "Rule '" + this.ruleName + "': Var stack underflow: attempt to use var '" + this.varName + "<x>' at index " + i
      );
    }
    return this.varName + i;
  }

  /**
   * Assigns `exprCode` to the new variable in the stack, returns generated code.
   * As the result, the size of a stack increases on 1.
   *
   * @param {string} exprCode Any expression code that must be assignet tho the new variable in the stack
   * @return {string} Assignment code
   */
  push(exprCode) {
    let code = this.name(++this.sp) + " = " + exprCode + ";";

    if (this.sp > this.maxSp) { this.maxSp = this.sp; }

    return code;
  }

  /**
   * Returns name or `n` names of the variable(s) from the top of stack.
   *
   * @param {number} [n=1] Quantity of variables which need to be removed from a stack
   * @return {string|string[]} Generated name(s). If `n > 1` than array has length of `n`
   *
   * @throws {RangeError} If stack underflow (there a more single `pop`'s than `push`'s)
   */
  pop(n) {
    if (n !== undefined) {
      this.sp -= n;

      return Array.from({ length: n }, (v, i) => this.name(this.sp + 1 + i));
    }
    return this.name(this.sp--);
  }

  /**
   * Returns name of the first free variable. The same as `index(0)`.
   *
   * @return {string} Generated name
   *
   * @throws {RangeError} If stack is empty (there was no `push`'s yet)
   */
  top() { return this.name(this.sp); }

  /**
   * Returns name of the variable at index `i`.
   *
   * @param {number} [i] Index of the variable from top of the stack
   * @return {string} Generated name
   *
   * @throws {RangeError} If `i < 0` or more than stack size
   */
  index(i) {
    if (i < 0) {
      throw new RangeError(
        "Rule '" + this.ruleName + "': Var stack overflow: attempt to get variable at negative index " + i
      );
    }
    return this.name(this.sp - i);
  }

  /**
   * Returns variable name that contains result (bottom of the stack).
   *
   * @return {string} Generated name
   *
   * @throws {RangeError} If stack is empty (there was no `push`'s yet)
   */
  result() {
    if (this.maxSp < 0) {
      throw new RangeError(
        "Rule '" + this.ruleName + "': Var stack is empty, can't get result'"
      );
    }
    return this.name(0);
  }

  /**
   * Returns defines of all used variables.
   *
   * @return {string} Generated define variable expression with type `this.type`.
   *         If stack is empty, returns empty string
   */
  defines() {
    if (this.maxSp < 0) {
      return "";
    }
    return this.type + " " + Array.from({ length: this.maxSp + 1 }, (v, i) => this.name(i)).join(", ") + ";";
  }

  /**
   * Runs the specified function and then restores the stack pointer to value before invokation.
   *
   * @param {function(): Object} generate Function that works with stack
   * @return {Object} Result, returned by `generate` function
   */
  fork(generate) {
    let baseSp = this.sp;
    let result = generate();

    this.sp = baseSp;

    return result;
  }

  /**
   * Checks that code in the `generateIf` and `generateElse` move the stack pointer in the same way
   * for all stacks.
   *
   * @param {Stack[]} stacks Stacks for which need guard
   * @param {number} pos Opcode number for error messages
   * @param {function()} generateIf First function that works with stacks
   * @param {function()} [generateElse] Second function that works with stacks
   * @return {undefined}
   *
   * @throws {Error} If `generateElse` is defined and any stack pointer moved differently in the
   *         `generateIf` and `generateElse`
   */
  static checkedIf(stacks, pos, generateIf, generateElse) {
    let baseSps = stacks.map(s => s.sp);

    generateIf();

    if (generateElse) {
      let thenSps = stacks.map(s => s.sp);

      stacks.forEach((s, i) => { s.sp = baseSps[i]; });
      generateElse();

      stacks.forEach((s, i) => {
        if (thenSps[i] !== s.sp) {
          throw new Error(
            "Rule '" + s.ruleName + "', position " + pos + ", stack '" + s.varName + "': "
            + "Branches of a condition can't move the stack pointer differently "
            + "(before: " + baseSps[i] + ", after then: " + thenSps[i] + ", after else: " + s.sp + ")."
          );
        }
      });
    }
  }

  /**
   * Checks that code in the `generateBody` do not move stack pointer in all stacks.
   *
   * @param {Stack[]} stacks Stacks for which need guard
   * @param {number} pos Opcode number for error messages
   * @param {function()} generateBody Function that works with stacks
   * @return {undefined}
   *
   * @throws {Error} If `generateBody` move stack pointer (contains unbalanced `push` and `pop`'s)
   */
  static checkedLoop(stacks, pos, generateBody) {
    let baseSps = stacks.map(s => s.sp);

    generateBody();

    stacks.forEach((s, i) => {
      if (baseSps[i] !== s.sp) {
        throw new Error(
          "Rule '" + s.ruleName + "', position " + pos + ", stack '" + s.varName + "': "
          + "Body of a loop can't move the stack pointer "
          + "(before: " + baseSps[i] + ", after: " + s.sp + ")."
        );
      }
    });
  }
}

module.exports = Stack;
