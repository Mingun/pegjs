/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.pegjs.java.generator.OP;

/**
 * Класс для генерации байт-кода для правил.
 * @author Mingun
 */
final class GenerateVisitor implements Visitor<byte[], GenerateVisitor.Context> {
    /** Шаблон для экранирования символов в функции {@link #quote}. */
    private static final Pattern pat = Pattern.compile("[\u0000-\u0007\u000B\u000E-\u001F\u0080-\uFFFF]");
    private GrammarNode ast;
    
    public static final class Context {
        /** Указатель стека. */
        public final int sp;
        /** Отображение имен меток на позиции в стеке виртуальной машины. */
        public final Map<String, Integer> env;
        /** Узлы действий передают себя здесь своим потомкам. */
        public final ActionNode action;

        public Context() {
            sp = -1;
            env = new HashMap<String, Integer>();
            action = null;
        }
        public Context(int stackPointer) {
            sp = stackPointer;
            env = new HashMap<String, Integer>();
            action = null;
        }
        public Context(int sp, Map<String, Integer> env, ActionNode action) {
            this.sp = sp;
            this.env = env;
            this.action = action;
        }
    }
    /**
     * Обходит все правила грамматики и для каждого генерирует байткод.
     * @param node Корневой узел грамматики.
     * @param context Дополнительная информация (не используется).
     * @return Всегда {@code null}.
     */
    @Override
    public byte[] visit(GrammarNode node, Context context) {
        ast = node;
        for (RuleNode rule : node.rules) {
            rule.bytecode = visit(rule, null);
        }
        ast = null;
        return null;
    }
    @Override
    public byte[] visit(RuleNode node, Context context) {
        return node.expression.visit(this, new Context());
    }
    @Override
    public byte[] visit(NamedNode node, Context context) {
        final int nameIndex = ast.addConstError("other", null, quote(node.name));

        /*
         * The code generated below is slightly suboptimal because |FAIL| pushes
         * to the stack, so we need to stick a |POP| in front of it. We lack a
         * dedicated instruction that would just report the failure and not touch
         * the stack.
         */
        return buildSequence(
            OP.SILENT_FAILS_ON.a(),
            node.expression.visit(this, context),
            OP.SILENT_FAILS_OFF.a(),
            buildCondition(OP.IF_ERROR.a(), OP.FAIL.a(nameIndex), null)
        );
    }
    @Override
    public byte[] visit(ChoiceNode node, Context context) {
        return buildAlternativesCode(node.alternatives, context);
    }
    @Override
    public byte[] visit(ActionNode node, Context context) {
        final Map<String, Integer> env = new HashMap<>();
        final boolean emitCall = !(node.expression instanceof SequenceNode) || ((SequenceNode)node.expression).elements.isEmpty();
        final byte[] expressionCode = node.expression.visit(this, new Context(
            context.sp + (emitCall ? 1 : 0),
            env,
            node
        ));
        final int functionIndex = ast.addAction(env, node.code);

        return emitCall
            ? buildSequence(
                OP.PUSH_CURR_POS.a(),
                expressionCode,
                buildCondition(
                    OP.IF_NOT_ERROR.a(),
                    buildSequence(
                        OP.REPORT_SAVED_POS.a(1),
                        buildCall(functionIndex, 1, env, context.sp + 2)
                    ),
                    null
                ),
                buildCondition(OP.IF_ERROR.a(), OP.NIP_CURR_POS.a(), OP.NIP.a())
            )
            : expressionCode;
    }
    @Override
    public byte[] visit(SequenceNode node, Context context) {
        if (!node.elements.isEmpty()) {
            return buildSequence(
                OP.PUSH_CURR_POS.a(),
                buildElementsCode(node, node.elements, new Context(
                    context.sp + 1,
                    context.env,
                    context.action
                ))
            );
        } else {
            return OP.PUSH_EMPTY_ARRAY.a();
        }
    }
    @Override
    public byte[] visit(LabeledNode node, Context context) {
        context.env.put(node.label, context.sp + 1);
        return node.expression.visit(this, new Context(context.sp));
    }
    @Override
    public byte[] visit(TextNode node, Context context) {
        return buildSequence(
            OP.PUSH_CURR_POS.a(),
            node.expression.visit(this, new Context(context.sp + 1)),
            buildCondition(OP.IF_NOT_ERROR.a(), OP.TEXT.a(), null),
            OP.NIP.a()
        );
    }
    @Override
    public byte[] visit(SimpleAndNode node, Context context) {
        return buildSimplePredicate(node.expression, false, context);
    }
    @Override
    public byte[] visit(SimpleNotNode node, Context context) {
        return buildSimplePredicate(node.expression, true, context);
    }
    @Override
    public byte[] visit(SemanticAndNode node, Context context) {
        return buildSemanticPredicate(node.code, false, context);
    }
    @Override
    public byte[] visit(SemanticNotNode node, Context context) {
        return buildSemanticPredicate(node.code, true, context);
    }
    @Override
    public byte[] visit(OptionalNode node, Context context) {
        return buildSequence(
            node.expression.visit(this, new Context(context.sp)),
            buildCondition(
                OP.IF_ERROR.a(),
                buildSequence(OP.POP.v(), OP.PUSH_EMPTY_STRING.v()),
                null
            )
        );
    }
    @Override
    public byte[] visit(ZeroOrMoreNode node, Context context) {
        final byte[] expressionCode = node.expression.visit(this, new Context(context.sp + 1));

        return buildSequence(
            OP.PUSH_EMPTY_ARRAY.a(),
            expressionCode,
            buildAppendLoop(expressionCode),
            OP.POP.a()
        );
    }
    @Override
    public byte[] visit(OneOrMoreNode node, Context context) {
        final byte[] expressionCode= node.expression.visit(this, new Context(context.sp + 1));

        return buildSequence(
          OP.PUSH_EMPTY_ARRAY.a(),
          expressionCode,
          buildCondition(
            OP.IF_NOT_ERROR.a(),
            buildSequence(buildAppendLoop(expressionCode), OP.POP.a()),
            buildSequence(OP.POP.v(), OP.POP.v(), OP.PUSH_NULL.v())
          )
        );
    }
    @Override
    public byte[] visit(RangeNode node, Context context) {
        // expressionCode put result on stack
        final byte[] expressionCode = node.expression.visit(this, new Context(context.sp + 1));
        final byte[] expressionCode2 = node.delimiter != null ?
          buildSequence(                    //                          stack:[  ]
            OP.PUSH_CURR_POS.a(),           // x = peg$currPos;         stack:[ pos ]
            node.delimiter.visit(this,      // item = delim();          stack:[ pos, delim ]
              new Context(context.sp + 1)
            ),
            buildCondition(
              OP.IF_NOT_ERROR.a(),          // if (item !== peg$FAILED) {
              buildSequence(
                OP.POP.a(),                 //                          stack:[ pos ]
                expressionCode,             //   item = expr();         stack:[ pos, item ]
                buildCondition(
                  OP.IF_ERROR.a(),          //   if (item === peg$FAILED) {
                  // If element FAILED, rollback currPos to saved value.
                  buildSequence(
                    OP.POP.v(),             //                          stack:[ pos ]
                    OP.POP_CURR_POS.v(),    //     peg$currPos = x;     stack:[  ]
                    OP.PUSH_NULL.v()        //     item = peg$FAILED;   stack:[ peg$FAILED ]
                  ),
                  // Else, just drop saved currPos.
                  OP.NIP.a()                //   }                      stack:[ item ]
                )
              ),                            // }
              // If delimiter FAILED, currPos not changed, so just drop it.
              OP.NIP.a()                    //                          stack:[ peg$FAILED ]
            )                               //                          stack:[ <?> ]
          ) : expressionCode;
        /*final byte[] min = node.min.visit(this, new Context(context.sp + 1);
        final byte[] max = node.max.visit(this, new Context(context.sp + 1);*/
        final int minIndex = ast.addConst(node.min == null ? "null" : node.min.toString());
        final int maxIndex = ast.addConst(node.max == null ? "null" : node.max.toString());

        return buildSequence(
          OP.PUSH_EMPTY_ARRAY.a(),    // var result = []          stack:[ [] ]
          expressionCode,             // var elem = expr();       stack:[ [], elem ]
          buildLoop(
            OP.WHILE_NOT_ERROR.a(),   // while (elem !== peg$FAILED) {
            buildSequence(
              OP.APPEND.a(),          //   result.push(elem);     stack:[ [elem...] ]
              // Check high boundary.
              OP.PUSH.a(maxIndex),    //                          stack:[ [elem...], max ]
              buildCondition(         //   if (max !== undefined && result.length >= max) {
                OP.IF_ARRLEN_MAX.a(), //                          stack:[ [elem...] ]
                // push `peg$FAILED` - this break loop on next iteration.
                OP.PUSH_NULL.a(),     //     elem = peg$FAILED;   stack:[ [elem...], peg$FAILED ]
                expressionCode2       //   } else {
              )                       //     elem = expr2();      stack:[ [elem...], elem ]
            )                         //   }
          ),                          // }                        stack:[ [elem...], elem ]
          OP.POP.a(),                 //                          stack:[ [elem...] ] (pop elem===`peg$FAILED`)

          // Check low boundary.
          OP.PUSH.a(minIndex),        //                          stack:[ [elem...], min ]
          buildCondition(             // if (min !== undefined && result.length < min) 
            OP.IF_ARRLEN_MIN.a(),     //                          stack:[ [elem...] ]
            buildSequence(            //   result = peg$FAILED;
              OP.POP.v(),
              OP.PUSH_NULL.v()        //                          stack:[ peg$FAILED ]
            ),
            null
          )
        );                            // return result;           stack:[ result ]
    }
    @Override
    public byte[] visit(RuleRefNode node, Context context) {
        return OP.RULE.a(ast.indexOfRuleByName(node.name));
    }
    @Override
    public byte[] visit(LiteralNode node, Context context) {
        if (node.value.length() != 0) {
            final int stringIndex = ast.addConst(node.ignoreCase
                ? quote(node.value.toString().toLowerCase())
                : quote(node.value)
            );
            final int expectedIndex = ast.addConstError(
                "literal",
                quote(node.value),
                quote(quote(node.value))
            );

            /*
             * For case-sensitive strings the value must match the beginning of the
             * remaining input exactly. As a result, we can use |ACCEPT_STRING| and
             * save one |substr| call that would be needed if we used |ACCEPT_N|.
             */
            return buildCondition(
                (node.ignoreCase ? OP.MATCH_STRING_IC : OP.MATCH_STRING).a(stringIndex),
                node.ignoreCase
                    ? OP.ACCEPT_N.a(node.value.length())
                    : OP.ACCEPT_STRING.a(stringIndex),
                OP.FAIL.a(expectedIndex)
            );
        } else {
            return OP.PUSH_EMPTY_STRING.a();
        }
    }

    @Override
    public byte[] visit(ClassNode node, Context context) {
        final String regexp;

        if (node.parts.size() > 0) {
            final StringBuilder sb = new StringBuilder("/^[");
            if (node.inverted) {
                sb.append('^');
            }
            for (ClassNode.CharacterClass part : node.parts) {
                sb.append(ClassNode.CharacterClass.quoteForRegexpClass(part.begin));
                if (part.isRange()) {
                    sb.append('-');
                    sb.append(ClassNode.CharacterClass.quoteForRegexpClass(part.end));
                }
            }
            sb.append("]/");
            if (node.ignoreCase) {
                sb.append('i');
            }
            regexp = sb.toString();
        } else {
            /*
             * IE considers regexps /[]/ and /[^]/ as syntactically invalid, so we
             * translate them into euqivalents it can handle.
             */
            regexp = node.inverted ? "/^[\\S\\s]/" : "/^(?!)/";
        }

        final int regexpIndex   = ast.addConst(regexp);
        final int expectedIndex = ast.addConstError(
            "class",
            quote(node.rawText),
            quote(node.rawText)
        );

        return buildCondition(
            OP.MATCH_REGEXP.a(regexpIndex),
            OP.ACCEPT_N.a(1),
            OP.FAIL.a(expectedIndex)
        );
    }
    @Override
    public byte[] visit(AnyNode node, Context context) {
        final int expectedIndex = ast.addConstError(
            "any",
            null,
            quote("any character")
        );

        return buildCondition(
            OP.MATCH_ANY.a(),
            OP.ACCEPT_N.a(1),
            OP.FAIL.a(expectedIndex)
        );
    }

    //<editor-fold defaultstate="collapsed" desc="Вспомогательные функции генерации байткода">
    private static byte[] buildSequence(byte[]... seq) {
        int len = 0;
        for (byte[] b : seq) { if (b != null) len += b.length; }
        final byte[] result = new byte[len];

        len = 0;
        for (byte[] b : seq) {
            if (b == null) continue;
            System.arraycopy(b, 0, result, len, b.length);
            len += b.length;
        }

        return result;
    }
    private static byte[] buildSequence(byte... seq) {
        return buildSequence(new byte[][]{seq});
    }
    private static byte[] buildCondition(byte[] condCode, byte[] thenCode, byte[] elseCode) {
        return buildSequence(
            condCode,
            new byte[] {
                (byte)(thenCode == null ? 0 : thenCode.length),
                (byte)(elseCode == null ? 0 : elseCode.length)
            },
            thenCode,
            elseCode
        );
    }
    private static byte[] buildLoop(byte[] condCode, byte[] bodyCode) {
        return buildSequence(
            condCode,
            new byte[] {(byte)(bodyCode == null ? 0 : bodyCode.length)},
            bodyCode
        );
    }
    private static byte[] buildCall(int functionIndex, int delta, Map<String, Integer> env, int sp) {
        final byte[] params = new byte[env.size()];
        int i = 0;
        for (int p : env.values()) {
            params[i] = (byte)(sp - p);
            ++i;
        }

        return buildSequence(new byte[] {
            OP.CALL.v(), (byte)functionIndex, (byte)delta, (byte)params.length
        }, params);
    }
    private byte[] buildSimplePredicate(Node expression, boolean negative, Context context) {
        return buildSequence(
            new byte[]{OP.PUSH_CURR_POS.v(), OP.SILENT_FAILS_ON.v()},
            expression.visit(this, new Context(context.sp + 1)),
            OP.SILENT_FAILS_OFF.a(),
            buildCondition(
                (negative ? OP.IF_ERROR : OP.IF_NOT_ERROR).a(),
                buildSequence(
                    OP.POP.v(),
                    (negative ? OP.POP : OP.POP_CURR_POS).v(),
                    OP.PUSH_EMPTY_STRING.v()
                ),
                buildSequence(
                    OP.POP.v(),
                    (negative ? OP.POP_CURR_POS : OP.POP).v(),
                    OP.PUSH_NULL.v()
                )
            )
        );
    }
    private byte[] buildSemanticPredicate(Code code, boolean negative, Context context) {
        final int functionIndex    = ast.addAction(context.env, code);

        return buildSequence(
            OP.REPORT_CURR_POS.a(),
            buildCall(functionIndex, 0, context.env, context.sp),
            buildCondition(
                OP.IF.a(),
                buildSequence(
                    OP.POP.v(),
                    (negative ? OP.PUSH_NULL : OP.PUSH_EMPTY_STRING).v()
                ),
                buildSequence(
                    OP.POP.v(),
                    (negative ? OP.PUSH_EMPTY_STRING : OP.PUSH_NULL).v()
                )
            )
        );
    }
    private static byte[] buildAppendLoop(byte[] expressionCode) {
        return buildLoop(
            OP.WHILE_NOT_ERROR.a(),
            buildSequence(OP.APPEND.a(), expressionCode)
        );
    }

    private byte[] buildAlternativesCode(List<Node> alternatives, Context context) {
        return buildSequence(
            alternatives.get(0).visit(this, new Context(context.sp)),
            alternatives.size() > 1
                ? buildCondition(
                    OP.IF_ERROR.a(),
                    buildSequence(
                        OP.POP.a(),
                        buildAlternativesCode(alternatives.subList(1, alternatives.size()), context)
                    ),
                    null
                )
                : null
        );
    }

    private byte[] buildElementsCode(SequenceNode node, List<Node> elements, Context context) {
        if (elements.size() > 0) {
            final List<Node> subList = elements.subList(1, elements.size());
            final int processedCount = node.elements.size() - subList.size();

            return buildSequence(
                elements.get(0).visit(this, new Context(
                    context.sp,
                    context.env,
                    null
                )),
                buildCondition(
                    OP.IF_NOT_ERROR.a(),
                    buildElementsCode(node, subList, new Context(
                        context.sp + 1,
                        context.env,
                        context.action
                    )),
                    buildSequence(
                        processedCount > 1 ? OP.POP_N.a(processedCount) : OP.POP.a(),
                        OP.POP_CURR_POS.a(),
                        OP.PUSH_NULL.a()
                    )
                )
            );
        } else {
            if (context.action != null) {
                final int functionIndex = ast.addAction(context.env, context.action.code);

                return buildSequence(
                    OP.REPORT_SAVED_POS.a(node.elements.size()),
                    buildCall(
                        functionIndex,
                        node.elements.size(),
                        context.env,
                        context.sp
                    ),
                    buildCondition(OP.IF_ERROR.a(), OP.NIP_CURR_POS.a(), OP.NIP.a())
                );
            } else {
                return buildSequence(OP.WRAP.v(), (byte)node.elements.size(), OP.NIP.v());
            }
        }
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Прочие вспомогательные функции">
    private static String quote(CharSequence s) {
        /*
         * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
         * literal except for the closing quote character, backslash, carriage
         * return, line separator, paragraph separator, and line feed. Any character
         * may appear in the form of an escape sequence.
         *
         * For portability, we also escape all control and non-ASCII characters.
         * Note that "\0" and "\v" escape sequences are not used because JSHint does
         * not like the first and IE the second.
         */
        s = s.toString()
            .replace("\\", "\\\\")// backslash
            .replace("\"", "\\\"")// closing quote character
            .replace("\b", "\\b") // backspace
            .replace("\t", "\\t") // horizontal tab
            .replace("\n", "\\n") // line feed
            .replace("\f", "\\f") // form feed
            .replace("\r", "\\r");// carriage return
        final Matcher m = pat.matcher(s);
        final StringBuffer sb = new StringBuffer();
        sb.append('"');
        boolean result = m.find();
        if (result) {
            do {
                m.appendReplacement(sb, escape(m.group()));
                result = m.find();
            } while (result);
            m.appendTail(sb);
        } else {
            sb.append(s);
        }
        return sb.append('"').toString();
    }

    /**
     * Returns a string padded on the left to a desired length with a character.
     *
     * The code needs to be in sync with the code template in the compilation
     * function for "action" nodes.
     */
    private static StringBuilder padLeft(final StringBuilder sb, CharSequence input, char padding, int length) {
        final int padLength = length - input.length();
        for (int i = 0; i < padLength; ++i) {
            sb.append(padding);
        }
        sb.append(input);
        return sb;
    }

    /**
     * Returns an escape sequence for given character. Uses \x for characters <=
     * 0xFF to save space, \\u for the rest.
     *
     * The code needs to be in sync with the code template in the compilation
     * function for "action" nodes.
     */
    private static String escape(String ch) {
        final int charCode = ch.codePointAt(0);
        int length;
        final StringBuilder sb = new StringBuilder();
        // Дважды, потому что обратный слеш трактуется, как экранирующий символ в
        // методах Matcher-а.
        sb.append('\\');
        sb.append('\\');
        if (charCode <= 0xFF) {
            sb.append('x');
            length = 2;
        } else {
            sb.append('u');
            length = 4;
        }
        return padLeft(sb, Integer.toString(charCode, 16).toUpperCase(), '0', length).toString();
    }
    //</editor-fold>
}