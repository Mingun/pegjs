"use strict";

module.exports = {
  extends: "eslint:recommended",
  root: true,
  env: { node: true },
  parserOptions: { ecmaVersion: 2015 },

  rules: {
    // ----- Possible Errors -----
    "no-console": "off",
    "no-control-regex": "off",
    "no-irregular-whitespace": ["error", {
      skipStrings: false,
      skipComments: false,
      skipRegExps: false,
      skipTemplates: false
    }],
    "no-prototype-builtins": "error",
    "no-regex-spaces": "off",
    "valid-jsdoc": "error",

    // ----- Best Practices -----
    "consistent-return": "error",
    "curly": "error",
    "default-case": "error",
    "dot-location": ["error", "property"],
    "dot-notation": "error",
    "eqeqeq": "error",
    "guard-for-in": "error",
    "no-caller": "error",
    "no-eq-null": "error",
    "no-extend-native": "error",
    "no-extra-bind": "error",
    "no-extra-label": "error",
    "no-floating-decimal": "error",
    "no-implicit-coercion": "error",
    "no-implicit-globals": "error",
    "no-implied-eval": "error",
    "no-iterator": "error",
    "no-lone-blocks": "error",
    "no-loop-func": "error",
    "no-multi-str": "error",
    "no-new": "error",
    "no-new-func": "error",
    "no-new-wrappers": "error",
    "no-octal-escape": "error",
    "no-proto": "error",
    "no-return-assign": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-throw-literal": "error",
    "no-unmodified-loop-condition": "error",
    "no-unused-expressions": "error",
    "no-useless-call": "error",
    "no-useless-concat": "error",
    "no-void": "error",
    "no-warning-comments": "error",
    "no-with": "error",
    "radix": "error",
    "wrap-iife": ["error", "inside"],
    "yoda": "error",

    // ----- Strict Mode -----
    "strict": "error",

    // ----- Variables -----
    "no-label-var": "error",
    "no-shadow-restricted-names": "error",
    "no-undef-init": "error",
    "no-buffer-constructor": "error",

    // ----- Node.js and CommonJS -----
    "no-new-require": "error",

    // ----- Stylistic Issues -----
    "array-bracket-spacing": ["error", "never"],
    "block-spacing": ["error", "always"],
    "brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "camelcase": ["error", { properties: "never" }],
    "comma-dangle": ["error", "only-multiline"],
    "comma-spacing": ["error", { before: false, after: true }],
    "computed-property-spacing": ["error", "never"],
    "consistent-this": ["error", "that"],
    "eol-last": ["error", "always"],
    "func-call-spacing": ["error", "never"],
    "func-style": ["error", "declaration"],
    "indent-legacy": ["error", 2, {
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1,
      MemberExpression: 1,
      FunctionDeclaration: { parameters: 1, body: 1 },
      FunctionExpression: { parameters: 1, body: 1 }
    }],
    "key-spacing": ["error", {
      beforeColon: false,
      afterColon: true,
      mode: "minimum"
    }],
    "keyword-spacing": ["error", { before: true, after: true }],
    "padding-line-between-statements": ["error",
      { blankLine: "always", prev: "directive", next: "*" },
      { blankLine: "any", prev: "directive", next: "directive" },
      { blankLine: "always", prev: "*", next: "return" },
      { blankLine: "any", prev: "block-like", next: "return" },
    ],
    "max-len": ["error", {
      code: 100,
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }],
    "new-cap": ["error", { newIsCap: true, capIsNew: true, properties: true }],
    "new-parens": "error",
    "no-array-constructor": "error",
    "no-multiple-empty-lines": ["error", { max: 1 }],
    "no-new-object": "error",
    "no-tabs": "error",
    "no-trailing-spaces": "error",
    "no-unneeded-ternary": "error",
    "no-whitespace-before-property": "error",
    "object-curly-spacing": ["error", "always"],
    "one-var": ["error", { initialized: "never", uninitialized: "always" }],
    "operator-assignment": ["error", "always"],
    "operator-linebreak": ["error", "before"],
    "padded-blocks": ["error", "never"],
    "quote-props": ["error", "consistent"],
    "quotes": ["error", "double", { "avoidEscape": true }],
    "semi": ["error", "always"],
    "semi-spacing": ["error", { before: false, after: true }],
    "space-before-blocks": ["error", "always"],
    "space-before-function-paren": ["error", "never"],
    "space-infix-ops": ["error", { "int32Hint": true }],
    "space-unary-ops": ["error", { words: true, nonwords: false }],
    "spaced-comment": ["error", "always", {
      line: { markers: ["/", "{", "}"] },
      block: { markers: ["*"], balanced: true }
    }],
    "unicode-bom": ["error", "never"],

    // ----- ECMAScript 6 -----
    "arrow-body-style": ["error", "as-needed"],
    "arrow-parens": ["error", "as-needed"],
    "arrow-spacing": ["error", { before: true, after: true }],
    "generator-star-spacing": ["error", "after"],
    "no-duplicate-imports": ["error", { includeExports: true }],
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-useless-rename": "error",
    "no-var": "error",
    "object-shorthand": ["error", "methods"],
    "prefer-numeric-literals": "error",
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "rest-spread-spacing": ["error", "never"],
    "sort-imports": ["error", {
      memberSyntaxSortOrder: ["none", "all", "multiple", "single"]
    }],
    "symbol-description": "error",
    "template-curly-spacing": ["error", "never"],
    "yield-star-spacing": ["error", "after"],
  }
}
