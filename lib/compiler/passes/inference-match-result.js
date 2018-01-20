"use strict";

let visitor = require("../visitor");
let asts    = require("../asts");

// Inference match result of the rule. Can be:
// -1: negative result, always fails
//  0: neutral result, may be fail, may be match
//  1: positive result, always match
function inferenceMatchResult(ast, options) {
  let emitWarning = options.collector.emitWarning;

  function sometimesMatch(node) { return (node.match = 0); }
  function alwaysMatch(node) {
    inference(node.expression);

    return (node.match = 1);
  }

  function inferenceExpression(node) {
    return (node.match = inference(node.expression));
  }
  function inferenceElements(elements, forChoice) {
    let length = elements.length;
    let always = 0;
    let never = 0;

    for (let i = 0; i < length; ++i) {
      let result = inference(elements[i]);

      if (result > 0) { ++always; }
      if (result < 0) { ++never;  }
    }

    if (always === length) {
      return 1;
    }
    if (forChoice) {
      return never === length ? -1 : 0;
    }

    return never > 0 ? -1 : 0;
  }

  let inference = visitor.build({
    rule(node) {
      let oldResult;
      let count = 0;

      if (typeof node.match === "undefined") {
        node.match = 0;
        do {
          oldResult = node.match;
          node.match = inference(node.expression);
          // 6 == 3! -- permutations count for all transitions from one match
          // state to another.
          // After 6 iterations the cycle with guarantee begins
          // istanbul ignore next
          if (++count > 6) {
            emitWarning(
              "Infinity cycle detected when trying evaluate node match result",
              node.location
            );
            node.match = 0;
            break;
          }
        } while (oldResult !== node.match);
      }

      return node.match;
    },
    named:        inferenceExpression,
    choice(node) {
      return (node.match = inferenceElements(node.alternatives, true));
    },
    action:       inferenceExpression,
    sequence(node) {
      return (node.match = inferenceElements(node.elements, false));
    },
    labeled:      inferenceExpression,
    text:         inferenceExpression,
    simple_and:   inferenceExpression,
    simple_not(node) {
      return (node.match = -inference(node.expression));
    },
    optional:     alwaysMatch,
    zero_or_more: alwaysMatch,
    one_or_more:  inferenceExpression,
    range(node) {
      let match = inference(node.expression);
      // If any boundary is variable - it can be negative, and it that case
      // node not match, but it may be match with some other values
      if (!node.min.constant || !node.max.constant) {
        if (node.delimiter !== null) {
          inference(node.delimiter);
        }
        return (node.match = 0);
      }
      if (node.max.value === 0
       || node.max.value !== null && node.min.value > node.max.value
      ) {
        if (node.delimiter !== null) {
          inference(node.delimiter);
        }
        return (node.match = -1);
      }

      if (match < 0) {
        if (node.delimiter !== null) {
          inference(node.delimiter);
        }
        // If range expression always fail, then range also always fail
        // (one expection - if it not allow zero elements input - then
        // it always success (as empty)).
        // If range expression sometimes match, then range match only if its minimun is 0
        return (node.match = node.min.value === 0 ? 1 : -1);
      }
      if (match > 0) {
        if (node.delimiter !== null) {
          let delMatch = inference(node.delimiter);
          // With zero or one elements delimiter not used, so because
          // expression always match, range also always match
          return (node.match = node.min.value < 2 ? 1 : delMatch);
        }
        return (node.match = 1);
      }
      // Expression sometimes match
      if (node.delimiter !== null) {
        let delMatch = inference(node.delimiter);
        // With zero or one elements delimiter not used, so because
        // expression sometimes match, range also sometimes match
        if (node.min.value < 2) {
          return (node.match = node.min.value === 0 ? 1 : 0);
        }
        // If delimiter never match then range also never match (because
        // there at least one delimiter)
        return (node.match = delMatch < 0 ? -1 : 0);
      }
      return (node.match = node.min.value === 0 ? 1 : 0);
    },
    group:        inferenceExpression,
    semantic_and: sometimesMatch,
    semantic_not: sometimesMatch,
    rule_ref(node) {
      let rule = asts.findRule(ast, node.name);

      return (node.match = inference(rule));
    },
    literal(node) {
      // Empty literal always match on any input
      return (node.match = node.value.length === 0 ? 1 : 0);
    },
    class(node) {
      // Empty character class never match on any input
      return (node.match = node.parts.length === 0 ? -1 : 0);
    },
    // |any| not match on empty input
    any:          sometimesMatch
  });

  inference(ast);
}

module.exports = inferenceMatchResult;
