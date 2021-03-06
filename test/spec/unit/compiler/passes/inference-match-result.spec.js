"use strict";

let chai = require("chai");
let helpers = require("./helpers");
let pass = require("../../../../../lib/compiler/passes/inference-match-result");

chai.use(helpers);

let expect = chai.expect;

describe("compiler pass |inferenceMatchResult|", function() {
  it("calculate |match| property for |any| correctly", function() {
    expect(pass).to.changeAST("start = .",       { rules: [{ match:  0 }] });
  });

  it("calculate |match| property for |literal| correctly", function() {
    expect(pass).to.changeAST("start = ''",      { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = ''i",     { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = 'a'",     { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = 'a'i",    { rules: [{ match:  0 }] });
  });

  it("calculate |match| property for |class| correctly", function() {
    expect(pass).to.changeAST("start = []",      { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = []i",     { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = [a]",     { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [a]i",    { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [a-b]",   { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [a-b]i",  { rules: [{ match:  0 }] });
  });

  it("calculate |match| property for |sequence| correctly", function() {
    expect(pass).to.changeAST("start = 'a' 'b'", { rules: [{ match:  0 }] });

    expect(pass).to.changeAST("start = 'a' ''",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' 'b'",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' ''",   { rules: [{ match:  1 }] });

    expect(pass).to.changeAST("start = 'a' []",  { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = [] 'b'",  { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = [] []",   { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |choice| correctly", function() {
    expect(pass).to.changeAST("start = 'a' / 'b'", { rules: [{ match:  0 }] });

    expect(pass).to.changeAST("start = 'a' / ''",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ''  / 'b'", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ''  / ''",  { rules: [{ match:  1 }] });

    expect(pass).to.changeAST("start = 'a' / []",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = []  / 'b'", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = []  / []",  { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for predicates correctly", function() {
    expect(pass).to.changeAST("start = &.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = &''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = &[]", { rules: [{ match: -1 }] });

    expect(pass).to.changeAST("start = !.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = !''", { rules: [{ match: -1 }] });
    expect(pass).to.changeAST("start = ![]", { rules: [{ match:  1 }] });

    expect(pass).to.changeAST("start = &{ code }", { rules: [{ match: 0 }] });
    expect(pass).to.changeAST("start = !{ code }", { rules: [{ match: 0 }] });
  });

  it("calculate |match| property for |text| correctly", function() {
    expect(pass).to.changeAST("start = $.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = $''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = $[]", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |action| correctly", function() {
    expect(pass).to.changeAST("start = .  { code }", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' { code }", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = [] { code }", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |labeled| correctly", function() {
    expect(pass).to.changeAST("start = a:.",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = a:''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = a:[]", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |named| correctly", function() {
    expect(pass).to.changeAST("start 'start' = .",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start 'start' = ''", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start 'start' = []", { rules: [{ match: -1 }] });
  });

  it("calculate |match| property for |optional| correctly", function() {
    expect(pass).to.changeAST("start = .?",  { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = ''?", { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = []?", { rules: [{ match: 1 }] });
  });

  it("calculate |match| property for |zero_or_more| correctly", function() {
    expect(pass).to.changeAST("start = .*",  { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = ''*", { rules: [{ match: 1 }] });
    expect(pass).to.changeAST("start = []*", { rules: [{ match: 1 }] });
  });

  it("calculate |match| property for |one_or_more| correctly", function() {
    expect(pass).to.changeAST("start = .+",  { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = ''+", { rules: [{ match:  1 }] });
    expect(pass).to.changeAST("start = []+", { rules: [{ match: -1 }] });
  });

  describe("calculate |match| property for |range|", function() {
    describe("without delimiters", function() {
      describe("with constant boundaries", function() {
        it("for | .. | correctly", function() {
          expect(pass).to.changeAST("start =  .| .. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| .. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| .. |", { rules: [{ match:  1 }] });
        });
        it("for | ..1| correctly", function() {
          expect(pass).to.changeAST("start =  .| ..1|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..1|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..1|", { rules: [{ match:  1 }] });
        });
        it("for | ..3| correctly", function() {
          expect(pass).to.changeAST("start =  .| ..3|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..3|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..3|", { rules: [{ match:  1 }] });
        });
        it("for |0.. | correctly", function() {
          expect(pass).to.changeAST("start =  .|0.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|0.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|0.. |", { rules: [{ match:  1 }] });
        });
        it("for |1.. | correctly", function() {
          expect(pass).to.changeAST("start =  .|1.. |", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|1.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|1.. |", { rules: [{ match: -1 }] });
        });
        it("for |2.. | correctly", function() {
          expect(pass).to.changeAST("start =  .|2.. |", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|2.. |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|2.. |", { rules: [{ match: -1 }] });
        });
        it("for |2..3| correctly", function() {
          expect(pass).to.changeAST("start =  .|2..3|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|2..3|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|2..3|", { rules: [{ match: -1 }] });
        });
        it("for | 42 | correctly", function() {
          expect(pass).to.changeAST("start =  .| 42 |", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''| 42 |", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| 42 |", { rules: [{ match: -1 }] });
        });
      });
      describe("with variable boundaries", function() {
        it("for |   ..max| correctly", function() {
          expect(pass).to.changeAST("start =  .|   ..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|   ..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|   ..max|", { rules: [{ match: 0 }] });
        });
        it("for |min..   | correctly", function() {
          expect(pass).to.changeAST("start =  .|min..   |", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..   |", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..   |", { rules: [{ match: 0 }] });
        });
        it("for |min..max| correctly", function() {
          expect(pass).to.changeAST("start =  .|min..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..max|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..max|", { rules: [{ match: 0 }] });
        });
        it("for | exact  | correctly", function() {
          expect(pass).to.changeAST("start =  .|exact|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|exact|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|exact|", { rules: [{ match: 0 }] });
        });
      });
    });
    describe("with delimiters", function() {
      describe("with constant boundaries", function() {
        it("for | .. , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .| .. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .| .. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .| .. ,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = ''| .. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| .. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| .. ,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = []| .. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| .. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| .. ,[]|", { rules: [{ match:  1 }] });
        });
        it("for | ..1, delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .| ..1, .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .| ..1,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .| ..1,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = ''| ..1, .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..1,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..1,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = []| ..1, .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..1,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..1,[]|", { rules: [{ match:  1 }] });
        });
        it("for | ..3, delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .| ..3, .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .| ..3,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .| ..3,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = ''| ..3, .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..3,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| ..3,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = []| ..3, .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..3,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []| ..3,[]|", { rules: [{ match:  1 }] });
        });
        it("for |0.. , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|0.. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .|0.. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start =  .|0.. ,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = ''|0.. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|0.. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|0.. ,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = []|0.. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|0.. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = []|0.. ,[]|", { rules: [{ match:  1 }] });
        });
        it("for |1.. , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|1.. , .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .|1.. ,''|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .|1.. ,[]|", { rules: [{ match:  0 }] });

          expect(pass).to.changeAST("start = ''|1.. , .|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|1.. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|1.. ,[]|", { rules: [{ match:  1 }] });

          expect(pass).to.changeAST("start = []|1.. , .|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []|1.. ,''|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []|1.. ,[]|", { rules: [{ match: -1 }] });
        });
        it("for |2.. , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|2.. , .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .|2.. ,''|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .|2.. ,[]|", { rules: [{ match: -1 }] });

          expect(pass).to.changeAST("start = ''|2.. , .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|2.. ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|2.. ,[]|", { rules: [{ match: -1 }] });

          expect(pass).to.changeAST("start = []|2.. , .|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []|2.. ,''|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []|2.. ,[]|", { rules: [{ match: -1 }] });
        });
        it("for |2..3, delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|2..3, .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .|2..3,''|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .|2..3,[]|", { rules: [{ match: -1 }] });

          expect(pass).to.changeAST("start = ''|2..3, .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''|2..3,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''|2..3,[]|", { rules: [{ match: -1 }] });

          expect(pass).to.changeAST("start = []|2..3, .|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []|2..3,''|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []|2..3,[]|", { rules: [{ match: -1 }] });
        });
        it("for | 42 , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .| 42 , .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .| 42 ,''|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start =  .| 42 ,[]|", { rules: [{ match: -1 }] });

          expect(pass).to.changeAST("start = ''| 42 , .|", { rules: [{ match:  0 }] });
          expect(pass).to.changeAST("start = ''| 42 ,''|", { rules: [{ match:  1 }] });
          expect(pass).to.changeAST("start = ''| 42 ,[]|", { rules: [{ match: -1 }] });

          expect(pass).to.changeAST("start = []| 42 , .|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []| 42 ,''|", { rules: [{ match: -1 }] });
          expect(pass).to.changeAST("start = []| 42 ,[]|", { rules: [{ match: -1 }] });
        });
      });
      describe("with variable boundaries", function() {
        it("for |   ..max, delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|   ..max, .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .|   ..max,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .|   ..max,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = ''|   ..max, .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|   ..max,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|   ..max,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = []|   ..max, .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|   ..max,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|   ..max,[]|", { rules: [{ match: 0 }] });
        });
        it("for |min..   , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|min..   , .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .|min..   ,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .|min..   ,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = ''|min..   , .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..   ,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..   ,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = []|min..   , .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..   ,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..   ,[]|", { rules: [{ match: 0 }] });
        });
        it("for |min..max, delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .|min..max, .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .|min..max,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .|min..max,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = ''|min..max, .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..max,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''|min..max,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = []|min..max, .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..max,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []|min..max,[]|", { rules: [{ match: 0 }] });
        });
        it("for | exact  , delimiter| correctly", function() {
          expect(pass).to.changeAST("start =  .| exact  , .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .| exact  ,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start =  .| exact  ,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = ''| exact  , .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''| exact  ,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = ''| exact  ,[]|", { rules: [{ match: 0 }] });

          expect(pass).to.changeAST("start = []| exact  , .|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []| exact  ,''|", { rules: [{ match: 0 }] });
          expect(pass).to.changeAST("start = []| exact  ,[]|", { rules: [{ match: 0 }] });
        });
      });
    });
  });

  it("calculate |match| property for |rule_ref| correctly", function() {
    expect(pass).to.changeAST(
      ["start = end", "end = . "].join("\n"),
      { rules: [{ match:  0 }, { match:  0 }] }
    );
    expect(pass).to.changeAST(
      ["start = end", "end = ''"].join("\n"),
      { rules: [{ match:  1 }, { match:  1 }] }
    );
    expect(pass).to.changeAST(
      ["start = end", "end = []"].join("\n"),
      { rules: [{ match: -1 }, { match: -1 }] }
    );

    expect(pass).to.changeAST("start = .  start", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = '' start", { rules: [{ match:  0 }] });
    expect(pass).to.changeAST("start = [] start", { rules: [{ match: -1 }] });

    expect(pass).to.changeAST("start = . start []", { rules: [{ match: -1 }] });
  });
});
