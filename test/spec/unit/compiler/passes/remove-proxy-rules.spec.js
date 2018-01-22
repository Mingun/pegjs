"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../../lib/compiler/passes/remove-proxy-rules");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |removeProxyRules|", function() {
  describe("when a proxy rule isn't listed in |allowedStartRules|", function() {
    it("updates references and removes it", function() {
      expect(pass).to.changeAST(
        [
          "start = proxy",
          "proxy = proxied",
          "proxied = 'a'"
        ].join("\n"),
        {
          rules: [
            {
              name: "start",
              expression: { type: "rule_ref", name: "proxied" }
            },
            { name: "proxied" }
          ]
        },
        { allowedStartRules: ["start"] }
      );
    });
  });

  describe("when a proxy rule is listed in |allowedStartRules|", function() {
    it("updates references but doesn't remove it", function() {
      expect(pass).to.changeAST(
        [
          "start = proxy",
          "proxy = proxied",
          "proxied = 'a'"
        ].join("\n"),
        {
          rules: [
            {
              name: "start",
              expression: { type: "rule_ref", name: "proxied" }
            },
            {
              name: "proxy",
              expression: { type: "rule_ref", name: "proxied" }
            },
            { name: "proxied" }
          ]
        },
        { allowedStartRules: ["start", "proxy"] }
      );
    });
  });

  describe("when a proxy rule is reffered to imported rule", function() {
    it("do not update references and doesn't remove it", function() {
      expect(pass).to.changeAST(
        [
          "start = notProxy",
          "notProxy = #notProxied",
          "notProxied = 'a'"
        ].join("\n"),
        {
          rules: [
            {
              name:       "start",
              expression: { type: "rule_ref", name: "notProxy" }
            },
            {
              name:       "notProxy",
              expression: { type: "rule_ref", namespace: "notProxied", name: null }
            },
            { name: "notProxied" }
          ]
        },
        { allowedStartRules: ["start"] }
      );
      expect(pass).to.changeAST(
        [
          "start = notProxy",
          "notProxy = #imported:notProxied",
          "notProxied = 'a'"
        ].join("\n"),
        {
          rules: [
            {
              name:       "start",
              expression: { type: "rule_ref", name: "notProxy" }
            },
            {
              name:       "notProxy",
              expression: { type: "rule_ref", namespace: "imported", name: "notProxied" }
            },
            { name: "notProxied" }
          ]
        },
        { allowedStartRules: ["start", "notProxy"] }
      );
    });
  });
});
