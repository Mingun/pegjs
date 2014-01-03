/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.generator;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.objectweb.asm.AnnotationVisitor;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Label;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import static org.objectweb.asm.Opcodes.V1_6;
import org.objectweb.asm.Type;
import org.pegjs.java.AbstractParser;
import org.pegjs.java.IParser;
import org.pegjs.java.annotations.Grammar;
import org.pegjs.java.annotations.Rule;
import org.pegjs.java.ast.GrammarNode;
import org.pegjs.java.ast.RuleNode;
import org.pegjs.java.exceptions.PEGException;

/**
 * Компилирует код абстрактной виртуальной машины, исполняющей грамматику в байт-код
 * виртуальной машины Java.
 * @author Mingun
 */
final class JavaBytecodeGenerator implements Opcodes {
    private GrammarNode ast;
    private final Stack stack = new Stack();
    private MethodVisitor mv;

    /** Список регулярных выражений, используемых в парсере. */
    private final List<String> patterns = new ArrayList<String>();
    /** Внутреннее имя генерируемого класса. */
    private String className;
    /** Класс стека локальных переменных. */
    private static final class Stack {
        int sp = -1;
        int maxSp = -1;

        /**
         * Помещает результат указанного выражения в первую свободную локальную переменную.
         * Если все локальные переменные заняты, создает новую, иначе переписывает значение
         * существующей.
         */
        int push() {
            final int result = ++sp;
            if (sp > maxSp) { maxSp = sp; }
            return result;
        }
        int pop() {
            return sp-- + 1;
        }
        int popN(int count) {
            return (sp -= count) + 1;
        }
        /** Возвращает индекс самой верхней локальной переменной в Java. */
        int top() {
            return sp + 1;
        }
        int index(int i) {
            return this.sp - i;
        }
    }

    //<editor-fold defaultstate="collapsed" desc="Функции компиляции">
    public byte[] generate(GrammarNode ast, String fullClassName) {
        this.ast = ast;
        className = fullClassName.replace('.', '/');
        final ClassWriter w = new ClassWriter(ClassWriter.COMPUTE_FRAMES);
        // Создаем класса-наследника от AbstractParser c указанным именем.
        w.visit(V1_6, Opcodes.ACC_PUBLIC | Opcodes.ACC_SUPER,
            className, null,
            Type.getInternalName(AbstractParser.class),
            null
        );
        // Помечаем его аннотацией Grammar, чтобы указать, что это парсер грамматики.
        final AnnotationVisitor av = w.visitAnnotation(Type.getDescriptor(Grammar.class), true);
        //av.visitArray("startRules").visitEnd();
        av.visitEnd();
        // Создание конструктора <className>()
        generateConstructor(w);
        // Реализация метода Object callRule(String ruleName)
        generateCallRule(w);
        // Реализация метода Object parse(CharSequence input, String startRule)
        generateParse(w, r(0));
        
        for (RuleNode rule : ast.rules) {
            generateRule(w, rule);
        }
        w.visitEnd();
        return w.toByteArray();
    }
    /**
     * 
     * @param bc Байткод абстрактной виртуальной машины, на которой представлена грамматика.
     * @param ip Указатель на текущую инструкцию. Технически индекс в bc.
     * @param end Указатель на последнюю инструкцию текущего блока кода. Технически индекс в bc.
     */
    private void generate(byte[] bc, int ip, int end) {
        while (ip < end) {
            final OP op = decode(bc[ip]);
            switch (op) {
                //<editor-fold defaultstate="collapsed" desc="Работа со стеком">
                
                //<editor-fold defaultstate="collapsed" desc="Помещение элементов в стек">
                case PUSH: {           // PUSH c
                    mv.visitLdcInsn(c(bc[ip + 1]));         // стек: [const]
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = const;
                    ip += 2;
                    break;
                }
                case PUSH_CURR_POS: {  // PUSH_CURR_POS
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [currPos]
                        className, "peg$currPos", "I");
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = this.peg$currPos;
                    ip++;
                    break;
                }
                case PUSH_EMPTY_STRING: {
                    mv.visitLdcInsn("");                    // стек: [""]
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = "";
                    ip++;
                    break;
                }
                case PUSH_EMPTY_ARRAY: {
                    mv.visitTypeInsn(NEW,                   // стек: [obj], new obj()
                        Type.getInternalName(ArrayList.class));
                    mv.visitInsn(DUP);                      // стек: [obj obj]
                    mv.visitMethodInsn(INVOKESPECIAL,       // стек: [obj], obj.obj()
                        Type.getInternalName(ArrayList.class),
                        "<init>", "()V"
                    );
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = new ArrayList();
                    ip++;
                    break;
                }
                case PUSH_NULL: {
                    mv.visitFieldInsn(GETSTATIC,            // стек: [NULL]
                        className, "NULL", "Ljava/lang/Object;");
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = NULL;
                    ip++;
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
                    mv.visitVarInsn(ALOAD, stack.pop());   // стек: [s?]
                    mv.visitTypeInsn(CHECKCAST, Type.getInternalName(Number.class));
                    mv.visitMethodInsn(INVOKEVIRTUAL,       //стек: [r]
                        Type.getInternalName(Number.class),
                        "intValue", "()I"
                    );
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], peg$currPos = ((Number)s?).intValue();
                        className, "peg$currPos", "I");
                    ip++;
                    break;
                }
                case POP_N: {          // POP_N n
                  stack.popN(bc[ip + 1]);
                  ip += 2;
                  break;
                }
                //</editor-fold>

                //<editor-fold defaultstate="collapsed" desc="Обмен элементов в стеке">
                case NIP: {            // NIP
                    mv.visitVarInsn(ALOAD, stack.pop());   // стек: [s?]
                    stack.pop();
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s<x> = s<x+1>
                    ip++;
                    break;
                }
                case NIP_CURR_POS: {   // NIP_CURR_POS
                    mv.visitVarInsn(ALOAD, stack.pop());   // стек: [s2]
                    mv.visitVarInsn(ALOAD, 0);              // стек: [s2 this]
                    mv.visitVarInsn(ALOAD, stack.pop());   // стек: [s2 this s1]
                    mv.visitTypeInsn(CHECKCAST, Type.getInternalName(Number.class));
                    mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [s2 r]
                        Type.getInternalName(Number.class),
                        "intValue", "()I"
                    );
                    mv.visitFieldInsn(PUTFIELD,             // стек: [s2], peg$currPos = ((Number)s1).intValue();
                        className, "peg$currPos", "I");
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s1 = s2
                    ip++;
                    break;
                }
                //</editor-fold>

                case APPEND: {         // APPEND <((List)s1).add(s2)>
                    mv.visitVarInsn(ALOAD, stack.pop());   // стек: [s2]
                    mv.visitVarInsn(ALOAD, stack.top());   // стек: [s2 s1]
                    mv.visitTypeInsn(CHECKCAST, Type.getInternalName(List.class));
                    mv.visitInsn(SWAP);                     // стек: [s1 s2]
                    mv.visitMethodInsn(INVOKEINTERFACE,     // стек: [s1 r], ((List)s1).add(s2)
                        Type.getInternalName(List.class),
                        "add", "(Ljava/lang/Object;)Z"
                    );
                    mv.visitInsn(POP2);                     // стек: []
                    ip++;
                    break;
                }
                case WRAP: {           // WRAP n
                    mv.visitIntInsn(BIPUSH, bc[ip + 1]);    // стек: [n]
                    mv.visitTypeInsn(ANEWARRAY,             // стек: [arr], arr = new Object[n]
                        Type.getInternalName(Object.class)
                    );
                    final int offset = stack.popN(bc[ip + 1]);
                    for (int i = 0; i < bc[ip + 1]; ++i) {
                        mv.visitInsn(DUP);                  // стек: [arr arr]
                        mv.visitIntInsn(BIPUSH, i);         // стек: [arr arr i]
                        mv.visitVarInsn(ALOAD, offset+i+1); // стек: [arr arr i s?]
                        mv.visitInsn(AASTORE);              // стек: [arr]
                    }
                    mv.visitMethodInsn(INVOKESTATIC,        // стек: [list]
                        Type.getInternalName(Arrays.class),
                        "asList", "([Ljava/lang/Object;)Ljava/util/List;"
                    );
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = Arrays.asList(s<x>, s<x+1>, ...)
                    ip += 2;
                    break;
                }
                case TEXT: {           // TEXT
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [input]
                        className, "input", "Ljava/lang/CharSequence;");
                    mv.visitVarInsn(ALOAD, stack.pop());   // стек: [input s?]
                    mv.visitTypeInsn(CHECKCAST, Type.getInternalName(Number.class));
                    mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [input i]
                        Type.getInternalName(Number.class),
                        "intValue", "()I"
                    );
                    mv.visitVarInsn(ALOAD, 0);              // стек: [input i this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [input i currPos]
                        className, "peg$currPos", "I");
                    mv.visitMethodInsn(INVOKEINTERFACE,     // стек: [r], 
                        Type.getInternalName(CharSequence.class),
                        "subSequence", "(II)Ljava/lang/CharSequence;"
                    );
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s<x+1> = input.subSequence(((Number)s<x>).intValue(), peg$currPos)
                    ip++;
                    break;
                }
                //</editor-fold>
                
                //<editor-fold defaultstate="collapsed" desc="Проверка условий">
                case IF: {             // IF t, f
                    mv.visitVarInsn(ALOAD, stack.top());   // стек: [s?]
                    mv.visitMethodInsn(INVOKESTATIC,        // стек: [r]
                        className,
                        "toBool", "(Ljava/lang/Object;)Z"
                    );
                    // toBool(s?) == (toBool(s?) != false) == !(toBool(s?) == false)
                    ip = compileCondition(IFEQ, bc, ip, 0, null);// стек: [], инвертированное условие к (toBool(s?) == true)
                    break;
                }
                case IF_ERROR: {       // IF_ERROR t, f
                    mv.visitVarInsn(ALOAD, stack.top());   // стек: [s?]
                    mv.visitFieldInsn(GETSTATIC,            // стек: [s? NULL]
                        className, "NULL", "Ljava/lang/Object;");
                    // (s? == NULL) == !(s? != NULL)
                    ip = compileCondition(IF_ACMPNE, bc, ip, 0, null);// стек: [], инвертированное условие к (s? == NULL)
                    break;
                }
                case IF_NOT_ERROR: {   // IF_NOT_ERROR t, f
                    mv.visitVarInsn(ALOAD, stack.top());   // стек: [s?]
                    mv.visitFieldInsn(GETSTATIC,            // стек: [s? NULL]
                        className, "NULL", "Ljava/lang/Object;");
                    // (s? != NULL) == !(s? == NULL)
                    ip = compileCondition(IF_ACMPEQ, bc, ip, 0, null);// стек: [], инвертированное условие к (s? != NULL)
                    break;
                }
                case IF_ARRLEN_MIN: {  // IF_ARRLEN_MIN t f
                    // (size < min) == (min > size) == !(min <= size)
                    ip = compileCondition2(IF_ICMPLE, bc, ip);// стек: [], инвертированное условие к (size < min)
                    break;
                }
                case IF_ARRLEN_MAX: {  // IF_ARRLEN_MAX t f
                    // (size >= max) == (max <= size) == !(max > size)
                    ip = compileCondition2(IF_ICMPGT, bc, ip);// стек: [], инвертированное условие к (size >= max)
                    break;
                }
                case WHILE_NOT_ERROR: {// WHILE_NOT_ERROR b
                    final Label beginLoop = new Label();
                    mv.visitLabel(beginLoop);
                    mv.visitVarInsn(ALOAD, stack.top());   // стек: [s?]
                    mv.visitFieldInsn(GETSTATIC,            // стек: [s? NULL]
                        className, "NULL", "Ljava/lang/Object;");
                    // (s? != NULL) == !(s? == NULL)
                    ip = compileLoop(IF_ACMPEQ, bc, ip, beginLoop);// стек: [], инвертированное условие к (s? != NULL)
                    break;
                }
                case MATCH_ANY: {      // MATCH_ANY a, f
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [input]
                        className, "input", "Ljava/lang/CharSequence;");
                    mv.visitMethodInsn(INVOKEINTERFACE,     // стек: [len]
                        Type.getInternalName(CharSequence.class),
                        "length", "()I"
                    );
                    mv.visitVarInsn(ALOAD, 0);              // стек: [len this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [len currPos]
                        className, "peg$currPos", "I");
                    // (len > currPos) == !(len <= currPos)
                    ip = compileCondition(IF_ICMPLE, bc, ip, 0, null);
                    break;
                }
                case MATCH_STRING: {   // MATCH_STRING s, a, f
                    ip = compileCondition1("test", bc, ip);
                    break;
                }
                case MATCH_STRING_IC: {// MATCH_STRING_IC s, a, f
                    ip = compileCondition1("testi", bc, ip);
                    break;
                }
                case MATCH_REGEXP: {   // MATCH_REGEXP r, a, f
                    final String value = p(bc[ip + 1]);

                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitInsn(DUP);                      // стек: [this this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this input]
                        className, "input", "Ljava/lang/CharSequence;");
                    mv.visitInsn(DUP);                      // стек: [this input this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this input pattern]
                        className, value, "Ljava/util/regex/Pattern;");
                    mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [r]
                        className,
                        "test", "(Ljava/lang/CharSequence;Ljava/util/regex/Pattern;)Z"
                    );
                    // test(...) == (test(...) != false) == !(test(...) == false)
                    ip = compileCondition(IFEQ, bc, ip, 1, null);
                    break;
                }
                //</editor-fold>

                case ACCEPT_N: {       // ACCEPT_N n
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [input]
                        className, "input", "Ljava/lang/CharSequence;");
                    mv.visitVarInsn(ALOAD, 0);              // стек: [input this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [input currPos]
                        className, "peg$currPos", "I");
                    if (bc[ip + 1] > 1) {
                        mv.visitLdcInsn((int)bc[ip + 1]);   // стек: [input currPos n]
                        mv.visitMethodInsn(INVOKEVIRTUAL,   // стек: [seq],
                            Type.getInternalName(CharSequence.class),
                            "subSequence", "(II)Ljava/lang/CharSequence;"
                        );
                    } else {
                        mv.visitMethodInsn(INVOKEVIRTUAL,   // стек: [ch],
                            Type.getInternalName(CharSequence.class),
                            "charAt", "(I)C"
                        );
                        mv.visitMethodInsn(INVOKESTATIC,    // стек: [ch],
                            Type.getInternalName(Character.class),
                            "valueOf", "(C)Ljava/lang/Character;"
                        );
                    }
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = seq|ch

                    // Увеличиваем текущую позицию: currPos += n.
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitInsn(DUP);                      // стек: [this this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this currPos]
                        className, "peg$currPos", "I");
                    mv.visitIntInsn(BIPUSH, bc[ip + 1]);    // стек: [this currPos n]
                    mv.visitInsn(IADD);                     // стек: [this (currPos+n)]
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], currPos += n
                        className, "peg$currPos", "I");
                    ip += 2;
                    break;
                }
                case ACCEPT_STRING: {  // ACCEPT_STRING s
                    mv.visitLdcInsn(c(bc[ip + 1]));         // стек: [const]
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = const

                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitInsn(DUP);                      // стек: [this this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this currPos]
                        className, "peg$currPos", "I");
                    mv.visitLdcInsn(c(bc[ip + 1]));         // стек: [this currPos const]
                    mv.visitMethodInsn(INVOKEINTERFACE,     // стек: [this currPos len],
                        Type.getInternalName(CharSequence.class),
                        "length", "()I"
                    );
                    mv.visitInsn(IADD);                     // стек: [this (currPos+len)]
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], currPos += len
                        className, "peg$currPos", "I");
                    ip += 2;
                    break;
                }
                case FAIL: {           // FAIL e
                    mv.visitFieldInsn(GETSTATIC,            // стек: [NULL]
                        className, "NULL", "Ljava/lang/Object;");
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: [], s? = NULL
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitLdcInsn(c(bc[ip + 1]));         // стек: [this const]
                    mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [],
                        className,
                        "peg$mayBeFail", "(Ljava/lang/String;)V"
                    );
                    ip += 2;
                    break;
                }
                case REPORT_SAVED_POS: {// REPORT_SAVED_POS p
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitVarInsn(ALOAD, stack.index(bc[ip + 1]));// стек: [this s?]
                    mv.visitTypeInsn(CHECKCAST, Type.getInternalName(Number.class));
                    mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [this i], ((Number)s?).intValue()
                        Type.getInternalName(Number.class),
                        "intValue", "()I"
                    );
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], peg$reportedPos = ((Number)s?).intValue();
                        className, "peg$reportedPos", "I");
                    ip += 2;
                    break;
                }
                case REPORT_CURR_POS: {// REPORT_CURR_POS
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitInsn(DUP);                      // стек: [this this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this currPos]
                        className, "peg$currPos", "I");
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], peg$reportedPos = peg$currPos
                        className, "peg$reportedPos", "I");
                    ip++;
                    break;
                }
                case CALL: {           // CALL f, n, pc, p1, p2, ..., pN
                    ip = compileCall(bc, ip);
                    break;
                }
                case RULE: {           // RULE r
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [r]
                        className,
                        r(bc[ip + 1]), "()Ljava/lang/Object;"
                    );
                    mv.visitVarInsn(ASTORE, stack.push());  // стек: []
                    ip += 2;
                    break;
                }
                case SILENT_FAILS_ON: {// SILENT_FAILS_ON
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitInsn(DUP);                      // стек: [this this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this f]
                        className, "peg$silentFails", "I");
                    mv.visitInsn(ICONST_1);                 // стек: [this f i]
                    mv.visitInsn(IADD);                     // стек: [this newF]
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], ++peg$silentFails
                        className, "peg$silentFails", "I");
                    ip++;
                    break;
                }
                case SILENT_FAILS_OFF: {// SILENT_FAILS_OFF
                    mv.visitVarInsn(ALOAD, 0);              // стек: [this]
                    mv.visitInsn(DUP);                      // стек: [this this]
                    mv.visitFieldInsn(GETFIELD,             // стек: [this f]
                        className, "peg$silentFails", "I");
                    mv.visitInsn(ICONST_1);                 // стек: [this f i]
                    mv.visitInsn(ISUB);                     // стек: [this newF]
                    mv.visitFieldInsn(PUTFIELD,             // стек: [], --peg$silentFails
                        className, "peg$silentFails", "I");
                    ip++;
                    break;
                }
                default:
                    throw new PEGException("Unhandled opcode: " + op +" ("+bc[ip] + ").");
            }
        }
    }
    /**
     * На стеке должны лежать необходимые для опкода opcode данные.
     * @param opcode Инвертированный опкод требуемой команды. На стеке должны лежать требуемые им данные.
     * @param bc
     * @param ip
     * @param argCount
     * @return Новое значение указателя команд ip.
     */
    private int compileCondition(int opcode, byte[] bc, int ip, int argCount, Label afterThenLabel) {
        final int baseLength = argCount + 3;
        final int thenLength = bc[ip + baseLength - 2];
        final int elseLength = bc[ip + baseLength - 1];

        if (afterThenLabel == null) {
            afterThenLabel = new Label();
        }
        mv.visitJumpInsn(opcode, afterThenLabel); // стек: [], if (???) goto afterThenLabel;

        final int baseSp     = stack.sp;
        // Переходим к телу, компилируем, помечаем конец меткой, пропускаем тело.
        ip += baseLength;
        generate(bc, ip, ip + thenLength);
        ip += thenLength;

        // Если существует else часть, генерируем ее.
        if (elseLength > 0) {
            final Label afterElseLabel = new Label();
            mv.visitJumpInsn(GOTO, afterElseLabel);
            mv.visitLabel(afterThenLabel);
            //mv.visitFrame(F_APPEND, nLocal, local, nStack, stack);

            stack.sp = baseSp;
            generate(bc, ip, ip + elseLength);
            ip += elseLength;
            mv.visitLabel(afterElseLabel);
        } else {
            mv.visitLabel(afterThenLabel);
        }
        return ip;
    }
    private int compileCondition1(String methodName, byte[] bc, int ip) {
        final String value = c(bc[ip + 1]);

        mv.visitVarInsn(ALOAD, 0);              // стек: [this]
        mv.visitInsn(DUP);                      // стек: [this this]
        mv.visitFieldInsn(GETFIELD,             // стек: [this input]
            className, "input", "Ljava/lang/CharSequence;");
        mv.visitLdcInsn(value);                 // стек: [this input const]
        mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [r]
            className,
            methodName, "(Ljava/lang/CharSequence;Ljava/lang/CharSequence;)Z"
        );
        // test(...) == (test(...) != false) == !(test(...) == false)
        return compileCondition(IFEQ, bc, ip, 1, null);
    }
    private int compileCondition2(int opcode, byte[] bc, int ip) {
        mv.visitVarInsn(ALOAD, stack.pop());    // стек: [s2]
        mv.visitInsn(DUP);                      // стек: [s2 s2]
        final Label afterThenLabel = new Label();
        mv.visitJumpInsn(IFNULL, afterThenLabel);//стек: [s2]
        mv.visitTypeInsn(CHECKCAST, Type.getInternalName(Number.class));
        mv.visitMethodInsn(INVOKEVIRTUAL,       // стек: [i], ((Number)s2).intValue()
            Type.getInternalName(Number.class),
            "intValue", "()I"
        );

        mv.visitVarInsn(ALOAD, stack.top());    // стек: [i s1]
        mv.visitTypeInsn(CHECKCAST, Type.getInternalName(List.class));
        mv.visitMethodInsn(INVOKEINTERFACE,     // стек: [i size], ((List)s1).size()
            Type.getInternalName(List.class),
            "size", "()I"
        );
        return compileCondition(opcode, bc, ip, 0, afterThenLabel);// стек: [], s2!=null && ((List)s1).size() ?? ((Number)s2).intValue()
    }

    private int compileLoop(int opcode, byte[] bc, int ip, Label beginLoop) {
        final int baseLength = 2;
        final int bodyLength = bc[ip + baseLength - 1];

        final Label endLoop = new Label();
        // Если условие провалено, завершаем цикл.
        mv.visitJumpInsn(opcode, endLoop);          // стек: [], if (???) goto endLoop;
        ip += baseLength;
        generate(bc, ip, ip + bodyLength);
        ip += bodyLength;
        // После тела идем на следующую итерацию.
        mv.visitJumpInsn(GOTO, beginLoop);
        mv.visitLabel(endLoop);
        
        return ip;
    }

    private int compileCall(byte[] bc, int ip) {
        // Опкод, индекс в таблице действий, сколько выкинуть из стека, количество аргуметов.
        final int baseLength  = 4;
        final int paramsCount = bc[ip + baseLength - 1];

        mv.visitVarInsn(ALOAD, 0);                  // стек: [this]
        // Кладем аргументы на стек Java.
        for (int i = ip + baseLength; i < ip + baseLength + paramsCount; ++i) {
            mv.visitVarInsn(ALOAD, stack.index(bc[i]));
        }

        // Вызываем действие.
        mv.visitMethodInsn(INVOKEVIRTUAL,           // стек: [r]
            className,
            f(bc[ip + 1]), sig(bc[ip + 1])
        );
        stack.popN(bc[ip + 2]);
        mv.visitVarInsn(ASTORE, stack.push());      // стек: []
        
        return ip += baseLength + paramsCount;
    }
    //</editor-fold>
    
    //<editor-fold defaultstate="collapsed" desc="Утилиты">
    /**
     * Получает константу с указанным номером.
     * @param i Номер константы в AST-е.
     * @return {@code ast.consts[i]}.
     */
    private String c(int i) { return ast.consts.get(i); }
    /**
     * Получает имя поля, содержащего RegExp-шаблон для константы с указанным номером.
     * @param i Номер константы в AST-е ({@code ast.consts[i]}).
     * @return Имя {@code private static final Pattern} поля в классе со скомпилированным шаблоном.
     */
    private String p(int i) {
        patterns.add(c(i));
        return "peg$p" + patterns.size();
    }
    /**
     * Получает имя функции-обработчика правила с указанным индексом.
     * @param i Номер правила в AST-е ({@code ast.rules[i]}).
     * @return Имя обработчика правила {@code ast.rules[i]}.
     */
    private String r(int i) { return r(ast.rules.get(i)); }
    private static String r(RuleNode rule) { return "peg$parse" + rule.name; }
    /**
     * Получает имя функции-обработчика действия с указанным индексом.
     * @param i Номер функции-обработчика в AST-е ({@code ast.actions[i]}).
     * @return 
     */
    private static String f(int i) { return "peg$f" + i; }
    /**
     * Возвращает сигнатуру метода-действия с указанным индексом.
     * @param index Номер функции-обработчика в AST-е ({@code ast.actions[i]}).
     * @return 
     */
    private String sig(int index) {
        final StringBuilder sb = new StringBuilder();
        final int count = ast.actions.get(index).params.size();
        sb.append('(');
        for (int i = 0; i < count; ++i) {
            sb.append("Ljava/lang/Object;");
        }
        sb.append(")Ljava/lang/Object;");
        return sb.toString();
    }
    private static OP decode(byte op) throws PEGException {
        try {
            return OP.values()[op];
        } catch (ArrayIndexOutOfBoundsException ex) {
            throw new PEGException("Invalid opcode: "+op, ex);
        }
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Генераторы вспомогательных функций">
    /**
     * Генерирует безаргументный конструктор парсера.
     * @param w
     */
    private static void generateConstructor(ClassWriter w) {
        // public Parser();
        final MethodVisitor mv = w.visitMethod(ACC_PUBLIC,
            "<init>", sig(void.class),
            null, null
        );
        mv.visitCode();

        mv.visitVarInsn(ALOAD, 0);              // стек: [this]
        // Потребляет максимум 4 слота стека.
        pushConstArray(mv, "peg$parsestart");   // стек: [this arr]
        invokeConstructor(mv, AbstractParser.class, String[].class); // стек: []
        mv.visitInsn(RETURN);
        // Слоты стека: this, String[], String[], int, String
        // (this, указатели на массив, индекс массива, значение массива).
        // 1 локальная переменная - this.
        mv.visitMaxs(5, 1);
        mv.visitEnd();
    }

    /**
     * Генерирует реализацию метода {@link IParser#parse(java.lang.CharSequence, java.lang.String)}.
     * @param w
     * @param className
     * @param defaultRule
     */
    private void generateParse(ClassWriter w, String defaultRule) {
        final MethodVisitor mv = w.visitMethod(ACC_PUBLIC,
            "parse", sig(Object.class, CharSequence.class, String.class),
            null, null
        );
        mv.visitAnnotation(Type.getDescriptor(Override.class), true).visitEnd();
        mv.visitCode();

        final Label begin = new Label();
        final Label end = new Label();
        mv.visitLabel(begin);

        mv.visitVarInsn(ALOAD, 0);                  // стек: [this]
        mv.visitInsn(DUP);                          // стек: [this this]
        mv.visitInsn(ICONST_0);                     // стек: [this this 0]
        mv.visitFieldInsn(PUTFIELD, className, "peg$silentFails", "I"); // стек: [this], this.field = 0
        mv.visitVarInsn(ALOAD, 1);                  // стек: [this input]
        mv.visitVarInsn(ALOAD, 2);                  // стек: [this input startRule]
        mv.visitLdcInsn(defaultRule);               // стек: [this input startRule defaultRule]
        invokeVirtual(mv, AbstractParser.class,
            "parse", Object.class, CharSequence.class, String.class, String.class
        );                                          // стек: [result]
        mv.visitInsn(ARETURN);

        // Добавляем названия параметров функции.
        mv.visitLabel(end);
        mv.visitLocalVariable("input", Type.getDescriptor(CharSequence.class), null, begin, end, 1);
        mv.visitLocalVariable("ruleName", Type.getDescriptor(String.class), null, begin, end, 2);
        // 3 локальных переменных - this, input, startRule.
        mv.visitMaxs(4, 3);
        mv.visitEnd();
    }

    /**
     * Генерирует реализацию метода {@link AbstractParser#callRule}.
     * @param w
     * @param className
     */
    private void generateCallRule(ClassWriter w) {
        final MethodVisitor mv = w.visitMethod(ACC_PROTECTED | ACC_FINAL, "callRule", sig(Object.class, String.class), null, null);
        mv.visitAnnotation(Type.getDescriptor(Override.class), true).visitEnd();
        mv.visitCode();

        final Label begin = new Label();
        final Label end = new Label();
        mv.visitLabel(begin);

        mv.visitLdcInsn(Type.getObjectType(className));// стек: [class]
        mv.visitIntInsn(ALOAD, 1);                  // стек: [class ruleName]
        mv.visitInsn(ACONST_NULL);                  // стек: [class ruleName null]
        invokeVirtual(mv, Class.class,
            "getDeclaredMethod", Method.class, String.class, Class[].class
        );                                          // стек: [Method]
        mv.visitInsn(DUP); // стек: [Method Method]
        mv.visitLdcInsn(Type.getType(Rule.class));  // стек: [Method Method class]
        invokeVirtual(mv, Method.class,
            "isAnnotationPresent", boolean.class, Class.class
        );                                          // стек: [Method boolean]
        final Label l = new Label();
        mv.visitJumpInsn(IFNE, l);                  // стек: [Method]
        mv.visitTypeInsn(NEW, Type.getInternalName(PEGException.class));// стек: [Method boolean ex]
        mv.visitInsn(DUP);                          // стек: [Method boolean ex ex]
        mv.visitTypeInsn(NEW, Type.getInternalName(StringBuilder.class));// стек: [Method boolean ex ex sb]
        mv.visitInsn(DUP);                          // стек: [Method boolean ex ex sb sb]
        mv.visitIntInsn(ALOAD, 1);                  // стек: [Method boolean ex ex sb sb ruleName]
        invokeConstructor(mv, StringBuilder.class, String.class);// стек: [Method boolean ex ex sb]
        mv.visitLdcInsn(" not a rule method");      // стек: [Method boolean ex ex sb str]
        invokeVirtual(mv, StringBuilder.class,
            "append", StringBuilder.class, String.class
        );                                          // стек: [Method boolean ex ex sb]
        invokeVirtual(mv, StringBuilder.class,
            "toString", String.class
        );                                          // стек: [Method boolean ex ex str]
        invokeConstructor(mv, PEGException.class, String.class);// стек: [Method boolean ex]
        mv.visitInsn(ATHROW);                       // стек: [ex]
        mv.visitLabel(l);                           // стек: [Method]
        mv.visitIntInsn(ALOAD, 0);                  // стек: [Method this]
        mv.visitInsn(ACONST_NULL);                  // стек: [Method this null]
        invokeVirtual(mv, Method.class,
            "invoke", Object.class, Object.class, Object[].class
        );                                          // стек: [result]
        mv.visitInsn(ARETURN);

        // Добавляем названия параметров функции.
        mv.visitLabel(end);
        mv.visitLocalVariable("ruleName", Type.getDescriptor(String.class), null, begin, end, 1);
        mv.visitMaxs(7, 2);
        mv.visitEnd();
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Генератор функции разбора правила">
    private void generateRule(ClassWriter w, RuleNode rule) {
        mv = w.visitMethod(ACC_PRIVATE, r(rule), sig(Object.class), null, null);
        // Помечаем метод разбора правила аннотацией Rule.
        mv.visitAnnotation(Type.getDescriptor(Rule.class), true).visitEnd();
        mv.visitCode();

        generate(rule.bytecode, 0, rule.bytecode.length);

        mv.visitMaxs(0, 0);
        mv.visitEnd();
        mv = null;
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Утилиты ASM">
    /**
     * Получает сигнатуру метода с указанными параметрами и возвращаемым типом.
     * @param retType
     * @param argTypes
     * @return Строка с Java-описанием сигнатуры метода.
     */
    private static String sig(Class<?> retType, Class<?>... argTypes) {
        final StringBuilder sb = new StringBuilder();
        sb.append('(');
        for (Class<?> cls : argTypes) {
            sb.append(Type.getDescriptor(cls));
        }
        sb.append(')');
        sb.append(Type.getDescriptor(retType));
        return sb.toString();
    }
    /**
     * Оставляет на вершине стека заполненный массив констант. Потребляет 4 слота стека.
     * @param mv
     * @param args Массив констант, которые необходимо подготовить.
     */
    private static void pushConstArray(MethodVisitor mv, String... args) {
        mv.visitIntInsn(SIPUSH, args.length); // стек: [len]
        mv.visitTypeInsn(ANEWARRAY, Type.getInternalName(String.class)); // стек: [arr]
        for (int i = 0; i < args.length; ++i) {
            mv.visitInsn(DUP); // стек: [arr arr]
            mv.visitIntInsn(SIPUSH, i); // стек: [arr arr i]
            mv.visitLdcInsn(args[i]); // стек: [arr arr i val]
            mv.visitInsn(AASTORE); // стек: [arr], arr[i] = val
        } // стек: [arr]
    }

    private static void invokeVirtual(MethodVisitor mv, Class owner, String method, Class retType, Class... argTypes) {
        mv.visitMethodInsn(INVOKEVIRTUAL, Type.getInternalName(owner), method, sig(retType, argTypes));
    }

    private static void invokeConstructor(MethodVisitor mv, Class owner, Class... argTypes) {
        mv.visitMethodInsn(INVOKESPECIAL, Type.getInternalName(owner), "<init>", sig(void.class, argTypes));
    }
    
    //</editor-fold>
}
