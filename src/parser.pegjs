{
  var utils = require("./utils");
}

grammar
  = __ initializer:initializer? rules:rule+ {
      return {
        type:        "grammar",
        region:      region(),
        initializer: initializer,
        rules:       rules
      };
    }

initializer
  = code:action semicolon? {
      return {
        type:   "initializer",
        region: region(),
        code:   code
      };
    }

rule
  = name:identifier displayName:string? equals expression:expression semicolon? {
      return {
        type:        "rule",
        region:      region(),
        name:        name,
        expression:  displayName !== null
          ? {
              type:       "named",
              region:     region(),
              name:       displayName,
              expression: expression
            }
          : expression
      };
    }

expression
  = choice

choice
  = head:sequence tail:(slash sequence)* {
      if (tail.length > 0) {
        var alternatives = [head].concat(utils.map(
            tail,
            function(element) { return element[1]; }
        ));
        return {
          type:         "choice",
          region:       region(),
          alternatives: alternatives
        };
      } else {
        return head;
      }
    }

sequence
  = elements:labeled* code:action {
      var expression = elements.length !== 1
        ? {
            type:     "sequence",
            region:   region(),
            elements: elements
          }
        : elements[0];
      return {
        type:       "action",
        region:     region(),
        expression: expression,
        code:       code
      };
    }
  / elements:labeled* {
      return elements.length !== 1
        ? {
            type:     "sequence",
            region:   region(),
            elements: elements
          }
        : elements[0];
    }

labeled
  = label:identifier colon expression:prefixed {
      return {
        type:       "labeled",
        region:     region(),
        label:      label,
        expression: expression
      };
    }
  / prefixed

prefixed
  = dollar expression:suffixed {
      return {
        type:       "text",
        region:     region(),
        expression: expression
      };
    }
  / and code:action {
      return {
        type:   "semantic_and",
        region: region(),
        code:   code
      };
    }
  / and expression:suffixed {
      return {
        type:       "simple_and",
        region:     region(),
        expression: expression
      };
    }
  / not code:action {
      return {
        type:   "semantic_not",
        region: region(),
        code:   code
      };
    }
  / not expression:suffixed {
      return {
        type:       "simple_not",
        region:     region(),
        expression: expression
      };
    }
  / suffixed

suffixed
  = expression:primary question {
      return {
        type:       "optional",
        region:     region(),
        expression: expression
      };
    }
  / expression:primary star {
      return {
        type:       "zero_or_more",
        region:     region(),
        expression: expression
      };
    }
  / expression:primary plus {
      return {
        type:       "one_or_more",
        region:     region(),
        expression: expression
      };
    }
  / primary

primary
  = name:identifier !(string? equals) {
      return {
        type:   "rule_ref",
        region: region(),
        name:   name
      };
    }
  / literal
  / class
  / dot { return { type: "any", region: region() }; }
  / lparen expression:expression rparen { return expression; }

/* "Lexical" elements */

action "action"
  = braced:braced __ { return braced.substr(1, braced.length - 2); }

braced
  = $("{" (braced / nonBraceCharacters)* "}")

nonBraceCharacters
  = nonBraceCharacter+

nonBraceCharacter
  = [^{}]

equals    = "=" __ { return "="; }
colon     = ":" __ { return ":"; }
semicolon = ";" __ { return ";"; }
slash     = "/" __ { return "/"; }
and       = "&" __ { return "&"; }
not       = "!" __ { return "!"; }
dollar    = "$" __ { return "$"; }
question  = "?" __ { return "?"; }
star      = "*" __ { return "*"; }
plus      = "+" __ { return "+"; }
lparen    = "(" __ { return "("; }
rparen    = ")" __ { return ")"; }
dot       = "." __ { return "."; }

/*
 * Modeled after ECMA-262, 5th ed., 7.6, but much simplified:
 *
 * * no Unicode escape sequences
 *
 * * "Unicode combining marks" and "Unicode connection punctuation" can't be
 *   part of the identifier
 *
 * * only [a-zA-Z] is considered a "Unicode letter"
 *
 * * only [0-9] is considered a "Unicode digit"
 *
 * The simplifications were made just to make the implementation little bit
 * easier, there is no "philosophical" reason behind them.
 *
 * Contrary to ECMA 262, the "$" character is not valid because it serves other
 * purpose in the grammar.
 */
identifier "identifier"
  = chars:$((letter / "_") (letter / digit / "_")*) __ { return chars; }

/*
 * Modeled after ECMA-262, 5th ed., 7.8.4. (syntax & semantics, rules only
 * vaguely).
 */
literal "literal"
  = value:(doubleQuotedString / singleQuotedString) flags:"i"? __ {
      return {
        type:       "literal",
        region:     region(),
        value:      value,
        ignoreCase: flags === "i"
      };
    }

string "string"
  = string:(doubleQuotedString / singleQuotedString) __ { return string; }

doubleQuotedString
  = '"' chars:doubleQuotedCharacter* '"' { return chars.join(""); }

doubleQuotedCharacter
  = simpleDoubleQuotedCharacter
  / simpleEscapeSequence
  / zeroEscapeSequence
  / hexEscapeSequence
  / unicodeEscapeSequence
  / eolEscapeSequence

simpleDoubleQuotedCharacter
  = !('"' / "\\" / eolChar) char_:. { return char_; }

singleQuotedString
  = "'" chars:singleQuotedCharacter* "'" { return chars.join(""); }

singleQuotedCharacter
  = simpleSingleQuotedCharacter
  / simpleEscapeSequence
  / zeroEscapeSequence
  / hexEscapeSequence
  / unicodeEscapeSequence
  / eolEscapeSequence

simpleSingleQuotedCharacter
  = !("'" / "\\" / eolChar) char_:. { return char_; }

class "character class"
  = "[" inverted:"^"? parts:(classCharacterRange / classCharacter)* "]" flags:"i"? __ {
      var partsConverted = utils.map(parts, function(part) { return part.data; });
      var rawText = "["
        + (inverted !== null ? inverted : "")
        + utils.map(parts, function(part) { return part.rawText; }).join("")
        + "]"
        + (flags !== null ? flags : "");

      return {
        type:       "class",
        region:     region(),
        parts:      partsConverted,
        // FIXME: Get the raw text from the input directly.
        rawText:    rawText,
        inverted:   inverted === "^",
        ignoreCase: flags === "i"
      };
    }

classCharacterRange
  = begin:classCharacter "-" end:classCharacter {
      if (begin.data.charCodeAt(0) > end.data.charCodeAt(0)) {
        error(
          "Invalid character range: " + begin.rawText + "-" + end.rawText + "."
        );
      }

      return {
        data:    [begin.data, end.data],
        // FIXME: Get the raw text from the input directly.
        rawText: begin.rawText + "-" + end.rawText
      };
    }

classCharacter
  = char_:bracketDelimitedCharacter {
      return {
        data:    char_,
        // FIXME: Get the raw text from the input directly.
        rawText: utils.quoteForRegexpClass(char_)
      };
    }

bracketDelimitedCharacter
  = simpleBracketDelimitedCharacter
  / simpleEscapeSequence
  / zeroEscapeSequence
  / hexEscapeSequence
  / unicodeEscapeSequence
  / eolEscapeSequence

simpleBracketDelimitedCharacter
  = !("]" / "\\" / eolChar) char_:. { return char_; }

simpleEscapeSequence
  = "\\" !(digit / "x" / "u" / eolChar) char_:. {
      return char_
        .replace("b", "\b")
        .replace("f", "\f")
        .replace("n", "\n")
        .replace("r", "\r")
        .replace("t", "\t")
        .replace("v", "\x0B"); // IE does not recognize "\v".
    }

zeroEscapeSequence
  = "\\0" !digit { return "\x00"; }

hexEscapeSequence
  = "\\x" digits:$(hexDigit hexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

unicodeEscapeSequence
  = "\\u" digits:$(hexDigit hexDigit hexDigit hexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

eolEscapeSequence
  = "\\" eol:eol { return eol; }

digit
  = [0-9]

hexDigit
  = [0-9a-fA-F]

letter
  = lowerCaseLetter
  / upperCaseLetter

lowerCaseLetter
  = [a-z]

upperCaseLetter
  = [A-Z]

__ = (whitespace / eol / comment)*

/* Modeled after ECMA-262, 5th ed., 7.4. */
comment "comment"
  = singleLineComment
  / multiLineComment

singleLineComment
  = "//" (!eolChar .)*

multiLineComment
  = "/*" (!"*/" .)* "*/"

/* Modeled after ECMA-262, 5th ed., 7.3. */
eol "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029"

eolChar
  = [\n\r\u2028\u2029]

/* Modeled after ECMA-262, 5th ed., 7.2. */
whitespace "whitespace"
  = [ \t\v\f\u00A0\uFEFF\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]
