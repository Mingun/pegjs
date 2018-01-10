"use strict";

module.exports = {
  root: true,
  env: { node: true },
  parserOptions: { ecmaVersion: 2015 },

  rules: {
    // ----- Possible Errors -----
    "no-cond-assign": "error",
    "no-console": "off",
    "no-constant-condition": "error",
    "no-control-regex": "off",
    "no-debugger": "error",
    "no-dupe-args": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty-character-class": "error",
    "no-empty": "error",
    "no-ex-assign": "error",
    "no-extra-boolean-cast": "error",
    "no-extra-parens": "off",
    "no-extra-semi": "error",
    "no-func-assign": "error",
    "no-inner-declarations": ["error", "both"],
    "no-invalid-regexp": "error",
    "no-irregular-whitespace": ["error", {
      skipStrings: false,
      skipComments: false,
      skipRegExps: false,
      skipTemplates: false
    }],
    "no-obj-calls": "error",
    "no-prototype-builtins": "error",
    "no-regex-spaces": "off",
    "no-sparse-arrays": "error",
    "no-template-curly-in-strings": "off",
    "no-unexpected-multiline": "error",
    "no-unreachable": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "use-isnan": "error",
    "valid-jsdoc": "error",
    "valid-typeof": "error",

    // ----- Best Practices -----
    "accessor-pairs": "off",
    "array-callback-return": "off",
    "block-scoped-var": "error",
    "class-methods-use-this": "off",
    "complexity": "off",
    "consistent-return": "error",
    "curly": "error",
    "default-case": "error",
    "dot-location": ["error", "property"],
    "dot-notation": "error",
    "eqeqeq": "error",
    "guard-for-in": "error",
    "no-alert": "off",
    "no-caller": "error",
    "no-case-declarations": "error",
    "no-div-regex": "off",
    "no-else-return": "off",
    "no-empty-function": "error",
    "no-empty-pattern": "off",
    "no-eq-null": "error",
    "no-eval": "off",
    "no-extend-native": "error",
    "no-extra-bind": "error",
    "no-extra-label": "error",
    "no-fallthrough": "error",
    "no-floating-decimal": "error",
    "no-global-assign": "error",
    "no-implicit-coercion": "error",
    "no-implicit-globals": "error",
    "no-implied-eval": "error",
    "no-invalid-this": "off",
    "no-iterator": "error",
    "no-labels": "off",
    "no-lone-blocks": "error",
    "no-loop-func": "error",
    "no-magic-numbers": "off",
    "no-multi-spaces": "off",
    "no-multi-str": "error",
    "no-new-func": "off",
    "no-new-wrappers": "error",
    "no-new": "error",
    "no-octal-escape": "error",
    "no-octal": "error",
    "no-param-reassign": "off",
    "no-proto": "error",
    "no-redeclare": "error",
    "no-restricted-properties": "off",
    "no-return-assign": "error",
    "no-script-url": "error",
    "no-self-assign": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-throw-literal": "error",
    "no-unmodified-loop-condition": "error",
    "no-unused-expressions": "error",
    "no-unused-labels": "error",
    "no-useless-call": "error",
    "no-useless-concat": "error",
    "no-useless-escape": "error",
    "no-void": "error",
    "no-warning-comments": "error",
    "no-with": "error",
    "radix": "error",
    "vars-on-top": "off",
    "wrap-iife": ["error", "inside"],
    "yoda": "error",

    // ----- Strict Mode -----
    "strict": "error",

    // ----- Variables -----
    "init-declarations": "off",
    "no-catch-shadow": "off",
    "no-delete-var": "error",
    "no-label-var": "error",
    "no-restricted-globals": "off",
    "no-shadow-restricted-names": "error",
    "no-shadow": "off",
    "no-undef-init": "off",
    "no-undef": "error",
    "no-undefined": "off",
    "no-unused-vars": "error",
    "no-use-before-define": "off",

    // ----- Node.js and CommonJS -----
    "callback-return": "off",
    "global-require": "off",
    "handle-callback-err": "off",
    "no-mixed-requires": "off",
    "no-new-require": "error",
    "no-path-concat": "off",
    "no-process-env": "off",
    "no-process-exit": "off",
    "no-restriced-modules": "off",
    "no-sync": "off",

    // ----- Stylistic Issues -----
    "array-bracket-spacing": ["error", "never"],
    "block-spacing": ["error", "always"],
    "brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "camelcase": ["error", { properties: "never" }],
    "comma-dangle": ["error", "never"],
    "comma-spacing": ["error", { before: false, after: true }],
    "comma-style": ["error", "last"],
    "computed-property-spacing": ["error", "never"],
    "consistent-this": ["error", "that"],
    "eol-last": ["error", "always"],
    "func-call-spacing": ["error", "never"],
    "func-names": ["error", "never"],
    "func-style": ["error", "declaration"],
    "id-blacklist": "off",
    "id-length": "off",
    "id-match": "off",
    "indent": ["error", 2, {
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1,
      MemberExpression: 1,
      FunctionDeclaration: { parametrs: 1, body: 1 },
      FunctionExpression: { parametrs: 1, body: 1 }
    }],
    "jsx-quotes": ["error", "prefer-double"],
    "key-spacing": ["error", {
      beforeColon: false,
      afterColon: true,
      mode: "minimum"
    }],
    "keyword-spacing": ["error", { before: true, after: true }],
    "line-comment-position": "off",
    "linebreak-style": "off",
    "lines-around-comment": "off",
    "lines-around-directive": ["error", "always"],
    "max-depth": "off",
    "max-len": ["error", {
      code: 80,
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }],
    "max-lines": "off",
    "max-nested-callbacks": "off",
    "max-params": "off",
    "max-statements-per-line": "off",
    "max-statements": "off",
    "multiline-ternary": ["off"],
    "new-cap": ["error", { newIsCap: true, capIsNew: true, properties: true }],
    "new-parens": "error",
    "newline-after-var": "off",
    "newline-before-return": "error",
    "newline-per-chained-call": "off",
    "no-array-constructor": "error",
    "no-bitwise": "off",
    "no-continue": "off",
    "no-inline-comments": "off",
    "no-lonely-if": "off",
    "no-mixed-operators": "off",
    "no-mixed-spaces-and-tabs": "error",
    "no-multiple-empty-lines": ["error", { max: 1 }],
    "no-negated-condition": "off",
    "no-nested-ternary": "error",
    "no-new-object": "error",
    "no-plusplus": "off",
    "no-restricted-syntax": "off",
    "no-tabs": "error",
    "no-ternary": "off",
    "no-trailing-spaces": "error",
    "no-underscore-dangle": "off",
    "no-unneeded-ternary": "error",
    "no-whitespace-before-property": "error",
    "object-curly-newline": "off",
    "object-curly-spacing": ["error", "always"],
    "object-property-newline": "off",
    "one-var-declaration-per-line": "off",
    "one-var": ["error", { initialized: "never", uninitialized: "always" }],
    "operator-assignment": ["error", "always"],
    "operator-linebreak": ["error", "before"],
    "padded-blocks": ["error", "never"],
    "quote-props": ["error", "consistent"],
    "quotes": ["error", "double"],
    "require-jsdoc": "off",
    "semi-spacing": ["error", { before: false, after: true }],
    "semi": ["error", "always"],
    "sort-keys": "off",
    "sort-vars": "off",
    "space-before-blocks": ["error", "always"],
    "space-before-function-paren": ["error", "never"],
    "space-in-parens": ["error", "never"],
    "space-infix-ops": "error",
    "space-unary-ops": ["error", { words: true, nonwords: false }],
    "spaced-comment": ["error", "always", {
      line: { markers: ["/"] },
      block: { markers: ["*"], balanced: true }
    }],
    "unicode-bom": ["error", "never"],
    "wrap-regex": "off",

    // ----- ECMAScript 6 -----
    "arrow-body-style": ["error", "as-needed"],
    "arrow-parens": ["error", "as-needed"],
    "arrow-spacing": ["error", { before: true, after: true }],
    "constructor-super": "error",
    "generator-star-spacing": ["error", "after"],
    "no-class-assign": "error",
    "no-confusing-arrow": "off",
    "no-const-assign": "error",
    "no-dupe-class-members": "error",
    "no-duplicate-imports": ["error", { includeExports: true }],
    "no-new-symbol": "error",
    "no-restricted-imports": "off",
    "no-this-before-super": "error",
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-useless-rename": "error",
    "no-var": "error",
    "object-shorthand": ["error", "methods"],
    "prefer-arrow-callback": "off",
    "prefer-const": "off",
    "prefer-numeric-literals": "error",
    "prefer-reflect": "off",
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "off",
    "require-yield": "error",
    "rest-spread-spacing": ["error", "never"],
    "sort-imports": ["error", {
      memberSyntaxSortOrder: ["none", "all", "multiple", "single"]
    }],
    "symbol-description": "error",
    "template-curly-spacing": ["error", "never"],
    "yield-star-spacing": ["error", "after"]
  }
}
