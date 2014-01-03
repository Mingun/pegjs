{
  //var utils = require("./utils");
import org.pegjs.java.ast.*;
import org.pegjs.java.exceptions.SyntaxError;
import java.util.List;
}

grammar
  = __ initializer:initializer? rules:rule+ {
      return new GrammarNode(initializer, rules);
    }

initializer
  = code:action semicolon? {
      return code;
    }

rule
  = name:identifier displayName:string? equals expression:expression semicolon? {
      return new RuleNode(name, displayName, expression);
    }

expression
  = choice

choice
  = head:sequence tail:(slash sequence)* {
      final List<List<Node>> t = (List<List<Node>>)tail;
      if (!t.isEmpty()) {
        return new ChoiceNode(head, t);
      } else {
        return head;
      }
    }

sequence
  = elements:labeled* code:action {
      final List<Node> list = (List<Node>)elements;
      final Node expression = list.size() == 1 ? list.get(0) : new SequenceNode(list);
      return new ActionNode(code, expression);
    }
  / elements:labeled* {
      final List<Node> list = (List<Node>)elements;
      return list.size() == 1 ? list.get(0) : new SequenceNode(list);
    }

labeled
  = label:identifier colon expression:prefixed {
      return new LabeledNode(label, expression);
    }
  / prefixed

prefixed
  = dollar expression:suffixed {
      return new TextNode(expression);
    }
  / and code:action {
      return new SemanticAndNode(code);
    }
  / and expression:suffixed {
      return new SimpleAndNode(expression);
    }
  / not code:action {
      return new SemanticNotNode(code);
    }
  / not expression:suffixed {
      return new SimpleNotNode(expression);
    }
  / suffixed

suffixed
  = expression:primary question {
      return new OptionalNode(expression);
    }
  / expression:primary star {
      return new ZeroOrMoreNode(expression);
    }
  / expression:primary plus {
      return new OneOrMoreNode(expression);
    }
  / expression:primary r:range {
      final Object[] rr = (Object[])r;
      final Number min = (Number)rr[0];
      final Number max = (Number)rr[1];
      final Object delimiter = rr[2];

      if (delimiter == null) {
        if (max == null) {// unbounded
          if (min.intValue() == 0) {// [0; +Inf]
            return new ZeroOrMoreNode(expression);
          } else
          if (min.intValue() == 1) {// [1; +Inf]
            return new OneOrMoreNode(expression);
          }
        } else
        if (max.intValue() == 1) {  // [?; 1]
          if (min.intValue() == 0) {// [0; 1]
            return new OptionalNode(expression);
          } else
          if (min.intValue() == 1) {// [1; 1]
            return expression;
          }
        }
      }
      return new RangeNode(min, max, delimiter, expression);
    }
  / primary

primary
  = name:identifier !(string? equals) {
      return new RuleRefNode(name);
    }
  / literal
  / class
  / dot { return new AnyNode(); }
  / lparen expression:expression rparen { return expression; }

range
  = range_open r:range2 delimiter:(comma primary)? range_close {
    final Object[] rr = (Object[])r;
    rr[2] = "".equals(delimiter) ? null : ((List)delimiter).get(1);
    return r;
  }
range2
  = min:int? dots max:int? {
    return new Object[]{"".equals(min)?0:min, "".equals(max)?null:max, null};
  }
  / val:int {return new Object[]{val, val, null};}
int = n:$(digit+) __ {return n.toString().isEmpty() ? "" : Integer.valueOf(n.toString(), 10);}

/* "Lexical" elements */

action "action"
  = braced:braced __ {
    final CharSequence seq = (CharSequence)braced;
    return new Code(seq.subSequence(1, seq.length() - 1));
  }

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
comma     = "," __ { return ","; }
dots      = ".." __{ return ".."; }
range_open= "|" __ { return "|"; }
range_close="|" __ { return "|"; }

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
      return new LiteralNode(value.toString(), "i".equals(flags));
    }

string "string"
  = string:(doubleQuotedString / singleQuotedString) __ { return string; }

doubleQuotedString
  = '"' chars:doubleQuotedCharacter* '"' { return join((List)chars); }

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
  = "'" chars:singleQuotedCharacter* "'" { return join((List)chars); }

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
      // FIXME: Get the raw text from the input directly.
      return new ClassNode(parts, inverted, flags);
    }

classCharacterRange
  = begin:classCharacter "-" end:classCharacter {
      // FIXME: Get the raw text from the input directly.
      return new ClassNode.CharacterClass(begin, end);
    }

classCharacter
  = char_:bracketDelimitedCharacter {
      // FIXME: Get the raw text from the input directly.
      return new ClassNode.CharacterClass(char_);
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
      return char_.toString()
        .replace("b", "\b")
        .replace("f", "\f")
        .replace("n", "\n")
        .replace("r", "\r")
        .replace("t", "\t")
        .replace("v", "\u000B");
    }

zeroEscapeSequence
  = "\\0" !digit { return "\u0000"; }

hexEscapeSequence
  = "\\x" digits:$(hexDigit hexDigit) {
      return new String(new int[]{Integer.parseInt(digits.toString(), 16)}, 0, 1);
    }

unicodeEscapeSequence
  = "\\u" digits:$(hexDigit hexDigit hexDigit hexDigit) {
      return new String(new int[]{Integer.parseInt(digits.toString(), 16)}, 0, 1);
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
