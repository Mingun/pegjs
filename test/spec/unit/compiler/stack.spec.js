"use strict";

let chai = require("chai");
let Stack = require("../../../../lib/compiler/Stack");

let expect = chai.expect;

describe("utility class Stack", function() {
  describe("for empty stack", function() {
    let stack;

    beforeEach(() => { stack = new Stack("rule", "v", "let"); });

    it("throws error when attempt `pop`", function() {
      expect(() => stack.pop()).to.throw(RangeError,
        "Rule 'rule': Var stack underflow: attempt to use var 'v<x>' at index -1"
      );
    });
    it("throws error when attempt `top`", function() {
      expect(() => stack.top()).to.throw(RangeError,
        "Rule 'rule': Var stack underflow: attempt to use var 'v<x>' at index -1"
      );
    });
    it("throws error when attempt `result`", function() {
      expect(() => stack.result()).to.throw(RangeError,
        "Rule 'rule': Var stack is empty, can't get result"
      );
    });
    it("throws error when attempt `index`", function() {
      expect(() => stack.index(-2)).to.throw(RangeError,
        "Rule 'rule': Var stack overflow: attempt to get variable at negative index -2"
      );
      expect(() => stack.index(0)).to.throw(RangeError,
        "Rule 'rule': Var stack underflow: attempt to use var 'v<x>' at index -1"
      );
      expect(() => stack.index(2)).to.throw(RangeError,
        "Rule 'rule': Var stack underflow: attempt to use var 'v<x>' at index -3"
      );
    });
    it("`defines` returns empty string", function() {
      expect(stack.defines()).to.equal("");
    });
  });

  it("throws error when attempt `pop` more than `push`", function() {
    let stack = new Stack("rule", "v", "let");

    stack.push("1");

    expect(() => stack.pop(3)).to.throw(RangeError,
      "Rule 'rule': Var stack underflow: attempt to use var 'v<x>' at index -2"
    );
  });

  it("returns variable with index 0 for `result`", function() {
    let stack = new Stack("rule", "v", "let");

    stack.push("1");

    expect(stack.result()).to.equal("v0");
  });

  it("`defines` returns define expression for all used variables", function() {
    let stack = new Stack("rule", "v", "let");

    stack.push("1");
    stack.push("2");
    stack.pop();
    stack.push("3");

    expect(stack.defines()).to.equal("let v0, v1;");
  });

  describe("`checkedIf` method", function() {
    let stack, stack2;

    beforeEach(function() {
      stack = new Stack("rule", "v", "let");
      stack.push("1");

      stack2 = new Stack("rule", "x", "let");
    });

    it("without else brach do not throws error", function() {
      expect(() => Stack.checkedIf([stack2, stack], 0, () => {})).to.not.throw();
      expect(() => Stack.checkedIf([stack2, stack], 0, () => stack.pop())).to.not.throw();
      expect(() => Stack.checkedIf([stack2, stack], 0, () => stack.push("2"))).to.not.throw();
    });

    it("do not throws error when stack pointer not moves in both arms", function() {
      function fn1() {}
      function fn2() {
        stack.push("1");
        stack.pop();
      }
      function fn3() {
        stack.push("1");
        stack.push("2");
        stack.pop(2);
      }
      function fn4() {
        stack.push("1");
        stack.pop();
        stack.push("2");
        stack.pop();
      }

      expect(() => Stack.checkedIf([stack2, stack], 0, fn1, fn1)).to.not.throw();
      expect(() => Stack.checkedIf([stack2, stack], 0, fn2, fn2)).to.not.throw();
      expect(() => Stack.checkedIf([stack2, stack], 0, fn3, fn3)).to.not.throw();
      expect(() => Stack.checkedIf([stack2, stack], 0, fn4, fn4)).to.not.throw();
    });
    it("do not throws error when stack pointer increases on the same value in both arms", function() {
      expect(() => Stack.checkedIf(
        [stack2, stack], 0,
        () => stack.push("1"),
        () => stack.push("2")
      )).to.not.throw();
    });
    it("do not throws error when stack pointer decreases on the same value in both arms", function() {
      stack.push("2");

      expect(() => Stack.checkedIf(
        [stack2, stack], 0,
        () => stack.pop(2),
        () => { stack.pop(); stack.pop(); }
      )).to.not.throw();
    });

    describe("throws error when stack pointer", function() {
      it("do not move in `if` and decreases in `then`", function() {
        expect(() => Stack.checkedIf(
          [stack2, stack], 0,
          () => {},
          () => stack.pop()
        )).to.throw(Error,
          "Rule 'rule', position 0, stack 'v': "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 0, after else: -1)."
        );
      });
      it("decreases in `if` and do not move in `then`", function() {
        expect(() => Stack.checkedIf(
          [stack2, stack], 0,
          () => stack.pop(),
          () => {}
        )).to.throw(Error,
          "Rule 'rule', position 0, stack 'v': "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: -1, after else: 0)."
        );
      });

      it("do not move in `if` and increases in `then`", function() {
        expect(() => Stack.checkedIf(
          [stack2, stack], 0,
          () => {},
          () => stack.push("2")
        )).to.throw(Error,
          "Rule 'rule', position 0, stack 'v': "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 0, after else: 1)."
        );
      });
      it("increases in `if` and do not move in `then`", function() {
        expect(() => Stack.checkedIf(
          [stack2, stack], 0,
          () => stack.push("2"),
          () => {}
        )).to.throw(Error,
          "Rule 'rule', position 0, stack 'v': "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 1, after else: 0)."
        );
      });

      it("decreases in `if` and increases in `then`", function() {
        expect(() => Stack.checkedIf(
          [stack2, stack], 0,
          () => stack.pop(),
          () => stack.push("2")
        )).to.throw(Error,
          "Rule 'rule', position 0, stack 'v': "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: -1, after else: 1)."
        );
      });
      it("increases in `if` and decreases in `then`", function() {
        expect(() => Stack.checkedIf(
          [stack2, stack], 0,
          () => stack.push("2"),
          () => stack.pop()
        )).to.throw(Error,
          "Rule 'rule', position 0, stack 'v': "
          + "Branches of a condition can't move the stack pointer differently "
          + "(before: 0, after then: 1, after else: -1)."
        );
      });
    });
  });

  describe("`checkedLoop` method", function() {
    let stack, stack2;

    beforeEach(function() {
      stack = new Stack("rule", "v", "let");
      stack.push("1");

      stack2 = new Stack("rule", "x", "let");
    });

    it("do not throws error when stack pointer not moves", function() {
      function fn1() {}
      function fn2() {
        stack.push("1");
        stack.pop();
      }
      function fn3() {
        stack.push("1");
        stack.push("2");
        stack.pop(2);
      }
      function fn4() {
        stack.push("1");
        stack.pop();
        stack.push("2");
        stack.pop();
      }

      expect(() => Stack.checkedLoop([stack2, stack], 0, fn1)).to.not.throw();
      expect(() => Stack.checkedLoop([stack2, stack], 0, fn2)).to.not.throw();
      expect(() => Stack.checkedLoop([stack2, stack], 0, fn3)).to.not.throw();
      expect(() => Stack.checkedLoop([stack2, stack], 0, fn4)).to.not.throw();
    });
    it("throws error when stack pointer increases", function() {
      expect(() => Stack.checkedLoop(
        [stack2, stack], 0,
        () => stack.push("1")
      )).to.throw(Error,
        "Rule 'rule', position 0, stack 'v': "
        + "Body of a loop can't move the stack pointer "
        + "(before: 0, after: 1)."
      );
    });
    it("throws error when stack pointer decreases", function() {
      expect(() => Stack.checkedLoop(
        [stack2, stack], 0,
        () => stack.pop()
      )).to.throw(Error,
        "Rule 'rule', position 0, stack 'v': "
        + "Body of a loop can't move the stack pointer "
        + "(before: 0, after: -1)."
      );
    });
  });
});
