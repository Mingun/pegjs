/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.generator;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import org.pegjs.java.AbstractParser;
import org.pegjs.java.ast.Code;
import org.pegjs.java.ast.GrammarNode;
import org.pegjs.java.ast.NamedNode;
import org.pegjs.java.ast.RuleNode;
import org.pegjs.java.exceptions.GenerateParserError;
import org.pegjs.java.exceptions.PEGException;

/**
 * Компилирует код абстрактной виртуальной машины, исполняющей грамматику в исходный
 * код Java.
 * @author Mingun
 */
final class SourceCodeGenerator {
    private GrammarNode ast;
    private final Stack stack = new Stack();
    
    private final static Map<String, String> imports = getImports(
        "java.lang.reflect.InvocationTargetException",
        "java.lang.reflect.Method",
        "java.util.ArrayList",
        "java.util.Arrays",
        "java.util.HashMap",
        "java.util.List",
        "java.util.Map",
        "java.util.regex.Pattern",
        "org.pegjs.java.AbstractParser",
        "org.pegjs.java.Error",
        "org.pegjs.java.annotations.Action",
        "org.pegjs.java.annotations.Grammar",
        "org.pegjs.java.annotations.Rule",
        "org.pegjs.java.exceptions.PEGException"
    );
    //<editor-fold defaultstate="collapsed" desc="Опции генерации">
    private boolean useFullNames = true;
    //</editor-fold>

    /** Класс стека локальных переменных. */
    private static final class Stack {
        int maxSp = -1;
        /** Список типов каждого элемента стека. LinkedList, потому что ArrayDeque не позволяет null-элементы. */
        final Deque<String> types = new LinkedList<String>();

        String push(String exprCode, Class<?> type) {
            return push(exprCode, type == null ? (String)null : type.getName());
        }
        /**
         * Помещает результат указанного выражения в первую свободную локальную переменную.
         * Если все локальные переменные заняты, создает новую, иначе переписывает значение
         * существующей.
         * @param exprCode Значение выражения, которое будет присвоено переменной.
         * @return Исходный код присваивания выражения локальной переменной.
         */
        String push(String exprCode, String type) {
            final int sp = types.size();
            types.push(type);
            final String code = s(sp) + "/*"+type+"*/ = " + exprCode + ';';
            if (sp > this.maxSp) { this.maxSp = sp; }
            return code;
        }

        String pop(int... arguments) {
            if (arguments.length == 0) {
                types.pop();
                return s(types.size());
            } else {
                final int n = arguments[0];
                final StringBuilder sb = new StringBuilder();
                boolean first = true;
                final int sp = types.size();
                for (int i = sp - n; i < sp; ++i) {
                    types.pop();
                    if (!first) {
                        sb.append(", ");
                    }
                    sb.append(s(i));
                    first = false;
                }
                return sb.toString();
            }
        }
        /** Получает имя первой свободной локальной переменной. */
        String top() {
            return s(types.size() - 1);
        }

        String index(int i) {
            return s(sp() - i);
        }
        CharSequence locals() {
            final StringBuilder sb = new StringBuilder();
            sb.append("Object ");
            for (int i = 0; i < maxSp + 1; ++i) {
                if (i != 0) {
                    sb.append(", ");
                }
                sb.append(s(i)).append(" = null");
            }
            sb.append(';');
            return sb;
        }
        void clear() {
            maxSp = -1;
            types.clear();
        }
        int sp() { return types.size() - 1; }
        void restore(int sp) {
            while (this.sp() > sp) {
                types.pop();
            }
            while (this.sp() < sp) {
                //FIXME: Подумать над тем, как предотвратить потерю данных о типах.
                types.push(null);
            }
        }
    }
    
    //<editor-fold defaultstate="collapsed" desc="Функции компиляции">
    public List<CharSequence> generate(GrammarNode ast, String fullClassName, Class base) {
        // Проверяем допустимость базового класса для парсера.
        checkBase(base);
        this.ast = ast;
        stack.clear();
        final List<CharSequence> result = new ArrayList<CharSequence>();
        
        final int i = fullClassName.lastIndexOf('.');
        final String className;
        if (i > 0) {
            result.add("package " + fullClassName.substring(0, i) + ';');
            result.add("");
            className = fullClassName.substring(i+1);
        } else {
            className = fullClassName;
        }
        
        if (!useFullNames) {
            for (String imp : imports.values()) {
                result.add("import "+imp+';');
            }
        }
        if (ast.initializer != null) {
            result.add("//<editor-fold defaultstate=\"collapsed\" desc=\"Код инициализатора\">");
            result.add(ast.initializer.content);
            result.add("//</editor-fold>");
            result.add("");
        }
        result.add('@'+__("Grammar"));
        result.add("public class " + className + " extends " + (base != null ? base.getName().replace('$', '.') : __("AbstractParser")) + " {");
        generateTables(result, ast);
        result.add("    public " + className + "() {");
        result.add("        super(");
        result.add("        //<editor-fold defaultstate=\"collapsed\" desc=\"Список правил, с которых возможно начало разбора\">");
        result.add("            \""+ast.rules.get(0).name+'"');
        result.add("        //</editor-fold>");
        result.add("        );");
        result.add("    }");
        result.add("    @Override");
        result.add("    public Object parse(CharSequence input, String startRule) {");
        result.add("        return this.parse(input, startRule, \""+ast.rules.get(0).name+"\");");
        result.add("    }");

        result.add("    //<editor-fold defaultstate=\"collapsed\" desc=\"Вспомогательные функции\">");
        result.add("    // Объявляем в текущем классе, т.к. вызов private методов разбора правил,");
        result.add("    // объявленных в данном классе, из AbstractParser невозможен.");
        result.add("    @Override");
        result.add("    protected final Object callRule(String ruleName) {");
        result.add("        try {");
        result.add("            final "+__("Method")+" m = this.getClass().getDeclaredMethod(ruleName, (Class[]) null);");
        result.add("            if (!m.isAnnotationPresent("+__("Rule")+".class)) {");
        result.add("                throw new "+__("PEGException")+"(ruleName+\" not rule name\");");
        result.add("            }");
        result.add("            return m.invoke(this, (Object[]) null);");
        result.add("        } catch (IllegalAccessException ex) {");
        result.add("            throw new "+__("PEGException")+"(ex);");
        result.add("        } catch (IllegalArgumentException ex) {");
        result.add("            throw new "+__("PEGException")+"(ex);");
        result.add("        } catch ("+__("InvocationTargetException")+" ex) {");
        result.add("            throw new "+__("PEGException")+"(ex);");
        result.add("        } catch (NoSuchMethodException ex) {");
        result.add("            throw new "+__("PEGException")+"(ex);");
        result.add("        } catch (SecurityException ex) {");
        result.add("            throw new "+__("PEGException")+"(ex);");
        result.add("        }");
        result.add("    }");
        result.add("    //</editor-fold>");
        result.add("");
        result.add("    //<editor-fold defaultstate=\"collapsed\" desc=\"Функции разбора правил\">");
        for (RuleNode rule : ast.rules) {
            for (CharSequence line : generate(rule)) {
                result.add(indent(line));
            }
        }
        result.add("    //</editor-fold>");
        result.add("}");
        return result;
    }
    /**
     * Генерирует функцию разбора правила.
     * @param rule Узел AST-а, представляющий правило, для которого генерируется исходный код.
     * @return Список строк исходного кода, реализующего исполнение байт-кода.
     */
    private List<CharSequence> generate(RuleNode rule) {
        final List<CharSequence> lines = generate(rule.bytecode, 0, rule.bytecode.length);
        final List<CharSequence> result = new ArrayList<CharSequence>();
        if (rule.expression instanceof NamedNode) {
            result.add('@'+__("Rule") + "(title=\"" + ((NamedNode)rule.expression).name + "\")");
        } else {
            result.add('@'+__("Rule"));
        }
        // unused подавляем потому, что начальные правила грамматики могут не вызываться
        // другими правилами, а при старте разбора они вызываются через рефлексию.
        // unchecked подавляем потому, что используется непараметризированный интерфейс
        // List и возникает предупреждение на его методе add.
        result.add("@SuppressWarnings({\"unused\", \"unchecked\"})");
        // Не генерируем реальный возвращаемый правилом тип, т.к. оно может вернуть значение
        // NULL, которое не является типом, которое возвращает правило.
        result.add("private Object " + r(rule) + "() {");
        result.add(indent(stack.locals()));
        result.add("");
        for (CharSequence line : lines) {
            result.add(indent(line));
        }
        if (rule.resultTypeClass == null) {
            // Запоминаем выведенный тип правила, если у него он явно не задан.
            rule.resultTypeClass = stack.types.peekLast();
        }
        result.add(indent("return " + s(0) + ";//"+rule.resultTypeClass));
        result.add("}");
        return result;
    }
    /**
     * Генерирует исходный код Java, реализующий абстрактный байт-код правила.
     * @param bc
     * @param ip Указатель на текущую инструкцию. Технически индекс в bc.
     * @param end Указатель на последнюю инструкцию текущего блока кода. Технически индекс в bc.
     * @return 
     */
    private List<CharSequence> generate(byte[] bc, int ip, int end) {
        // Строки генерируемого исходника.
        final List<CharSequence> parts = new ArrayList<CharSequence>();

        while (ip < end) {
            final OP op = decode(bc[ip]);
            switch (op) {
                //<editor-fold defaultstate="collapsed" desc="Работа со стеком">
                
                //<editor-fold defaultstate="collapsed" desc="Помещение элементов в стек">
                case PUSH: {           // PUSH c
                    /*
                    * Hack: One of the constants can be an empty array. It needs to be
                    * handled specially because it can be modified later on the stack
                    * by |APPEND|.
                    */
                    parts.add(// s? = Parser.peg$c#;
                        stack.push(c(bc[ip + 1]), ct(bc[ip + 1]))
                    );
                    ip += 2;
                    break;
                }
                case PUSH_CURR_POS: {  // PUSH_CURR_POS
                    parts.add(stack.push("this.peg$currPos", Integer.class));// s? = this.peg$currPos;
                    ip++;
                    break;
                }
                case PUSH_EMPTY_STRING: {
                    parts.add(stack.push("\"\"", String.class));// s? = "";
                    ++ip;
                    break;
                }
                case PUSH_EMPTY_ARRAY: {
                    parts.add(stack.push("new "+__("ArrayList")+"()", List.class));// s? = new ArrayList();
                    ++ip;
                    break;
                }
                case PUSH_NULL: {
                    parts.add(stack.push("NULL", (String)null));// s? = Parser.NULL;
                    ++ip;
                    break;
                }
                //</editor-fold>

                //<editor-fold defaultstate="collapsed" desc="Выталкивание элементов из стека">
                case POP: {            // POP
                  stack.pop();
                  ip++;
                  break;
                }
                case POP_CURR_POS: {   // POP_CURR_POS
                  parts.add("this.peg$currPos = ((Number)" + stack.pop() + ").intValue();");
                  ip++;
                  break;
                }
                case POP_N: {          // POP_N n
                  stack.pop(bc[ip + 1]);
                  ip += 2;
                  break;
                }
                //</editor-fold>

                //<editor-fold defaultstate="collapsed" desc="Обмен элементов в стеке">
                case NIP: {            // NIP
                  final String type = stack.types.getFirst();
                  final String value = stack.pop();
                  stack.pop();
                  parts.add(stack.push(value, type));
                  ip++;
                  break;
                }
                case NIP_CURR_POS: {   // NIP_CURR_POS
                  final String type = stack.types.getFirst();
                  final String value = stack.pop();
                  parts.add("this.peg$currPos = ((Number)" + stack.pop() + ").intValue();");
                  parts.add(stack.push(value, type));
                  ip++;
                  break;
                }
                //</editor-fold>

                case APPEND: {         // APPEND
                  final String value = stack.pop();
                  parts.add("(("+__("List")+')'+stack.top() + ").add(" + value + ");");
                  ip++;
                  break;
                }
                case WRAP: {           // WRAP n
                  parts.add(
                    stack.push(__("Arrays")+".asList(" + stack.pop(bc[ip + 1]) + ')', List.class)
                  );
                  ip += 2;
                  break;
                }
                case TEXT: {           // TEXT
                  stack.pop();
                  parts.add(
                    stack.push("this.input.subSequence(((Number)" + stack.top() + ").intValue(), this.peg$currPos)", CharSequence.class)
                  );
                  ip++;
                  break;
                }
                //</editor-fold>
                
                //<editor-fold defaultstate="collapsed" desc="Проверка условий">
                case IF: {             // IF t, f
                    ip = compileCondition(bc, ip, parts, "toBool("+stack.top()+")", 0);
                    break;
                }
                case IF_ERROR: {       // IF_ERROR t, f
                    ip = compileCondition(bc, ip, parts, stack.top() + " == NULL", 0);
                    break;
                }
                case IF_NOT_ERROR: {   // IF_NOT_ERROR t, f
                    ip = compileCondition(bc, ip, parts, stack.top() + " != NULL", 0);
                    break;
                }
                case IF_ARRLEN_MIN: {  // IF_ARRLEN_MIN t f
                    final String value = stack.pop();
                    ip = compileCondition(bc, ip, parts, value+"!=null && (("+__("List")+')'+stack.top() + ").size() < ((Number)"+value+").intValue()", 0);
                    break;
                }
                case IF_ARRLEN_MAX: {  // IF_ARRLEN_MAX t f
                    final String value = stack.pop();
                    ip = compileCondition(bc, ip, parts, value+"!=null && (("+__("List")+')'+stack.top() + ").size() >= ((Number)"+value+").intValue()", 0);
                    break;
                }
                case WHILE_NOT_ERROR: {// WHILE_NOT_ERROR b
                  ip = compileLoop(bc, ip, parts, stack.top() + " != NULL");
                  break;
                }
                case MATCH_ANY: {      // MATCH_ANY a, f
                  ip = compileCondition(bc, ip, parts, "this.input.length() > this.peg$currPos", 0);
                  break;
                }
                case MATCH_STRING: {   // MATCH_STRING s, a, f
                  final String value = eval(ast.consts.get(bc[ip + 1]));
                  ip = compileCondition(bc, ip, parts, 
                    value.length() > 1
                      ? "this.test("
                          + value.length()
                          + ", "
                          + c(bc[ip + 1])
                          + ')'
                      : "this.test((char)"
                          + Integer.toString(eval(ast.consts.get(bc[ip + 1])).charAt(0), 10)
                          + "/* "+ast.consts.get(bc[ip + 1])+" */)",
                    1
                  );
                  break;
                }
                case MATCH_STRING_IC: {// MATCH_STRING_IC s, a, f, ...
                  final int value = eval(ast.consts.get(bc[ip + 1])).length();
                  ip = compileCondition(bc, ip, parts, 
                    "this.testi("
                      + value
                      + ", "
                      + c(bc[ip + 1])
                      + ')',
                    1
                  );
                  break;
                }
                case MATCH_REGEXP: {   // MATCH_REGEXP r, a, f, ...
                  ip = compileCondition(bc, ip, parts, 
                    "this.test(" + c(bc[ip + 1]) + ')',
                    1
                  );
                  break;
                }
                //</editor-fold>

                case ACCEPT_N: {       // ACCEPT_N n
                    final int n = bc[ip + 1];
                    if (n > 1) {
                        parts.add(stack.push(
                            "input.subSequence(this.peg$currPos, this.peg$currPos + " + n + ')',
                            CharSequence.class
                        ));
                        parts.add("this.peg$currPos += " + n + ';');
                    } else {
                        parts.add(stack.push(
                            "input.charAt(this.peg$currPos)",
                            Character.class
                        ));
                        parts.add("++this.peg$currPos;");
                    }
                    ip += 2;
                    break;
                }
                case ACCEPT_STRING: {  // ACCEPT_STRING s
                  parts.add(stack.push(c(bc[ip + 1]), String.class));
                  parts.add("this.peg$currPos += " + c(bc[ip + 1]) + ".length();");
                  ip += 2;
                  break;
                }
                case FAIL: {           // FAIL e
                  parts.add(stack.push("NULL", (String)null));
                  parts.add("this.peg$mayBeFail(" + c(bc[ip + 1]) + ");");
                  ip += 2;
                  break;
                }
                case REPORT_SAVED_POS: {// REPORT_SAVED_POS p
                  parts.add("this.peg$reportedPos = ((Number)" + stack.index(bc[ip + 1]) + ").intValue();");
                  ip += 2;
                  break;
                }
                case REPORT_CURR_POS: {// REPORT_CURR_POS
                  parts.add("this.peg$reportedPos = this.peg$currPos;");
                  ip++;
                  break;
                }
                case CALL: {           // CALL f, n, pc, p1, p2, ..., pN
                  ip = compileCall(bc, ip, parts);
                  break;
                }
                case RULE: {           // RULE r
                  parts.add(stack.push(r(bc[ip + 1]) + "()", rt(bc[ip + 1])));
                  ip += 2;
                  break;
                }
                case SILENT_FAILS_ON: {// SILENT_FAILS_ON
                  parts.add("++this.peg$silentFails;");
                  ip++;
                  break;
                }
                case SILENT_FAILS_OFF: {// SILENT_FAILS_OFF
                  parts.add("--this.peg$silentFails;");
                  ip++;
                  break;
                }
                default:
                  throw new PEGException("Unhandled opcode: " + op +" ("+bc[ip] + ").");
            }
        }

        return parts;
    }
    
    private int compileCondition(byte[] bc, int ip, List<CharSequence> parts, String cond, int argCount) {
        // Опкод, [возможные аргументы], длина then части, длина else части
        final int baseLength = argCount + 3;
        final int thenLength = bc[ip + baseLength - 2];
        final int elseLength = bc[ip + baseLength - 1];
        final int baseSp     = stack.sp();

        ip += baseLength;
        final List<CharSequence> thenCode = generate(bc, ip, ip + thenLength);
        ip += thenLength;
        parts.add("if (" + cond + ") {");
        for (CharSequence part : thenCode) {
            parts.add(indent(part));
        }
        
        if (elseLength > 0) {
            stack.restore(baseSp);
            final List<CharSequence> elseCode = generate(bc, ip, ip + elseLength);
            ip += elseLength;

            parts.add("} else {");
            for (CharSequence part : elseCode) {
                parts.add(indent(part));
            }
        }
        parts.add("}");
        return ip;
    }

    private int compileLoop(byte[] bc, int ip, List<CharSequence> parts, String cond) {
        final int baseLength = 2;
        final int bodyLength = bc[ip + baseLength - 1];

        ip += baseLength;
        final List<CharSequence> bodyCode = generate(bc, ip, ip + bodyLength);
        ip += bodyLength;

        parts.add("while (" + cond + ") {");
        for (CharSequence part : bodyCode) {
            parts.add(indent(part));
        }
        parts.add("}");
        return ip;
    }

    private int compileCall(byte[] bc, int ip, List<CharSequence> parts) {
        final int baseLength   = 4;
        final int paramsCount = bc[ip + baseLength - 1];

        // Формирование списка аргументов вызова функции - подставляются локальные
        // регистры абстрактной ВМ, они же - локальные переменные.
        final StringBuilder sb = new StringBuilder(f(bc[ip + 1]));
        sb.append('(');
        boolean first = true;
        for (int i = ip + baseLength; i < ip + baseLength + paramsCount; ++i) {
            if (!first) {
                sb.append(", ");
            }
            sb.append(stack.index(bc[i]));
            first = false;
        }
        sb.append(')');

        stack.pop(bc[ip + 2]);
        parts.add(stack.push(sb.toString(), ft(bc[ip + 1])));
        return ip += baseLength + paramsCount;
    }
    //</editor-fold>
    
    //<editor-fold defaultstate="collapsed" desc="Утилиты">
    
    //<editor-fold defaultstate="collapsed" desc="Генераторы имен">
    /**
     * Получает имя константы с указанным номером.
     * @param i Номер константы в AST-е.
     * @return Имя поля для константы {@code ast.consts[i]}.
     */
    private static String c(int i) { return "peg$c" + i; } // |consts[i]| of the abstract machine
    private String ct(int i) { return type(ast.consts.get(i)); } // |consts[i]| of the abstract machine
    /**
     * Получает имя функции-обработчика действия с указанным индексом.
     * @param i Номер функции-обработчика в AST-е.
     * @return Имя метода для обработки действия {@code ast.actions[i]}.
     */
    private static String f(int i) { return "peg$f" + i; } // |actions[i]| of the abstract machine
    /** @return Тип, возвращаемый функцией-действием или предикатом. */
    private String ft(int i) { return ast.actions.get(i).returnType(); }
    /**
     * Получает имя локальной переменной с указанным индексом.
     * @param i Номер локальной переменной.
     * @return Имя локальной переменной.
     */
    private static String s(int i) { return "s"     + i; } // |stack[i]| of the abstract machine
    /**
     * Получает имя функции-обработчика правила с указанным индексом.
     * @param i Номер правила в AST-е.
     * @return Имя обработчика правила {@code ast.rules[i]}.
     */
    private String r(int i) { return r(ast.rules.get(i)); }
    private String r(RuleNode rule) { return "peg$parse" + rule.name; }
    /** @return Тип, возвращаемый функцией разбора правила с указанным индексом. */
    private String rt(int i) { return ast.rules.get(i).returnType(); }
    //</editor-fold>
    
    private static OP decode(byte op) {
        try {
            return OP.values()[op];
        } catch (ArrayIndexOutOfBoundsException ex) {
            throw new PEGException("Invalid opcode: "+op, ex);
        }
    }
    private String __(String src) {
        if (useFullNames && imports.containsKey(src))
            return imports.get(src);
        return src;
    }
    private static CharSequence indent(CharSequence src) {return new StringBuilder("    ").append(src);}
    /**
     * Вычисляет значение строковой константы JavaScript.
     * @param constant Константы для вычисления, строка с escape-последовательностями,
     *        заключенная в кавычки.
     * @return Строка, как ее видит интерпретатор JavaScript.
     */
    private static String eval(String constant) {
        // Константы заключены в кавычки - удаляем их.
        return unescapeJavaScript(constant.substring(1, constant.length()-1));
    }
    private static String unescapeJavaScript(CharSequence s) {
        if (s == null) {
            return null;
        }

        final StringBuilder sb = new StringBuilder(s.length());
        final int sz = s.length();

        final StringBuilder unicode = new StringBuilder(4);
        boolean hadSlash = false;
        int compositeLen = 0;

        for (int i = 0; i < sz; ++i) {
            final char ch = s.charAt(i);
            if (compositeLen > 0) {
                // if in unicode, then we're reading unicode
                // values in somehow
                unicode.append(ch);
                if (unicode.length() == compositeLen) {
                    // unicode now contains the four hex digits
                    // which represents our unicode character
                    try {
                        final int value = Integer.parseInt(unicode.toString(), 16);
                        if (compositeLen == 2) {
                            sb.append((char) value);
                        } else {
                            sb.append(Character.toChars(value));
                        }
                        unicode.setLength(0);
                        compositeLen = 0;
                        hadSlash = false;
                    } catch (NumberFormatException ex) {
                        throw new IllegalArgumentException("Unable to parse unicode value in position "+i+": " + unicode, ex);
                    }
                }
                continue;
            }

            if (hadSlash) {
                // handle an escaped value
                hadSlash = false;
                switch (ch) {
                case '\\': sb.append('\\'); break;
                case '\'': sb.append('\''); break;
                case '\"': sb.append('\"'); break;
                case 'r':  sb.append('\r'); break;
                case 'f':  sb.append('\f'); break;
                case 't':  sb.append('\t'); break;
                case 'n':  sb.append('\n'); break;
                case 'b':  sb.append('\b'); break;
                case 'x':  compositeLen = 2;break;
                case 'u':  compositeLen = 4;break;
                default:
                    sb.append(ch);
                    break;
                }
                continue;
            } else
            if (ch == '\\') {
                hadSlash = true;
                continue;
            }
            sb.append(ch);
        }

        if (hadSlash) {
            // then we're in the weird case of a \ at the end of the
            // string, let's output it anyway.
            sb.append('\\');
        }

        return sb.toString();
    }
    
    private static Map<String, String> getImports(String... names) {
        final Map<String, String> result = new HashMap<String, String>();
        for (String fullName : names) {
            final int i = fullName.lastIndexOf('.');
            final String name = fullName.substring(i+1);
            if (!"*".equals(name)) {
                result.put(name, fullName);
            }
        }
        return result;
    }
    //<editor-fold defaultstate="collapsed" desc="Генерация таблиц">
    private void generateTables(List<CharSequence> result, GrammarNode ast) {
        result.add("    //<editor-fold defaultstate=\"collapsed\" desc=\"Таблица констант парсера\">");
        int i = 0;
        for (String c : ast.consts) {
            result.add("    private static final " + type(c) + " peg$c" + String.valueOf(i) + " = " + value(c) + ';');
            ++i;
        }
        result.add("    //</editor-fold>");

        result.add("    //<editor-fold defaultstate=\"collapsed\" desc=\"Таблица действий парсера\">");
        i = 0;
        for (Code c : ast.actions) {
            result.add("    @"+__("Action"));
            result.add("    private " + c.returnType() + " " + f(i) + "(" + c.arguments() + ") {");
            result.add(indent(c.content));
            result.add("    }");
            ++i;
        }
        result.add("    //</editor-fold>");
    }
    private String value(String c) {
        return (isPattern(c) ? __("Pattern")+".compile(\""+correct(c.substring(1, c.length()-1))+"\")" :
               (isArray(c) ? "new "+__("ArrayList")+"()" :
               (isNULL(c) ? "null" :
               (isUndefined(c) ? "null" :
               (isExpectedObject(c) ? c : correct(c))))));
    }
    private static boolean isNumber(String s)  {
        try {Integer.parseInt(s); return true;}
        catch(NumberFormatException ex) {return false;}
    }
    private static boolean isString(String s)  { return s.startsWith("\""); }
    private static boolean isPattern(String s) { return s.startsWith("/"); }
    private static boolean isArray(String s)   { return s.startsWith("["); }
    private static boolean isNULL(String s)    { return "null".equals(s); }
    private static boolean isUndefined(String s){ return "void 0".equals(s); }
    private static boolean isExpectedObject(String s) { return s.startsWith("new org.pegjs.java.Error(\""); }
    private static String  correct(String s)   { return s.replaceAll("\\\\x(..)", "\\\\u00$1"); }// \x -> \ u00
    private String  type(String c) {
      if (isNumber(c))  return "Number";
      if (isString(c))  return "String";
      if (isPattern(c)) return __("Pattern");
      if (isArray(c))   return __("ArrayList");
      if (isExpectedObject(c))   return __("Error");
      return "Object";
    }
    //</editor-fold>
    private static void checkBase(Class base) {
        if (base == null)
            return;
        if (base.isPrimitive()) {
            throw new GenerateParserError("Base class for parser cann't be primitive class: "+base.getName());
        }
        if (base.isArray()) {
            throw new GenerateParserError("Base class for parser cann't be array: "+base.getName());
        }
        if ((base.getModifiers() & Modifier.FINAL) != 0) {
            throw new GenerateParserError("Base class for parser cann't be final: "+base.getName());
        }
        if (!AbstractParser.class.isAssignableFrom(base)) {
            throw new GenerateParserError("Temporary restriction: base class must extend "+AbstractParser.class.getName()+" class: "+base.getName());
        }
        if (base.isInterface()) {
            throw new GenerateParserError("Temporary restriction: base class must be a class, not interface: "+base.getName());
        }
        try {
            final Constructor c = base.getDeclaredConstructor(String[].class);
            if ((c.getModifiers() & Modifier.PRIVATE) != 0) {
                throw new GenerateParserError("Temporary restriction: base class must be have public or protected constructor "+base.getSimpleName()+"(String...): "+base.getName());
            }
            if (!c.isVarArgs()) {
                throw new GenerateParserError("Temporary restriction: base class must be have public or protected constructor "+base.getSimpleName()+"(String...): "+base.getName());
            }
        } catch (NoSuchMethodException ex) {
            throw new GenerateParserError("Temporary restriction: base class must be have public or protected constructor "+base.getSimpleName()+"(String...): "+base.getName(), ex);
        }
    }
    //</editor-fold>
}
