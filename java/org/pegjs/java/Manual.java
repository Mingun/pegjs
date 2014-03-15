/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java;

import org.pegjs.java.ast.ActionNode;
import org.pegjs.java.ast.ChoiceNode;
import org.pegjs.java.ast.ClassNode;
import org.pegjs.java.ast.Code;
import org.pegjs.java.ast.LabeledNode;
import org.pegjs.java.ast.LiteralNode;
import org.pegjs.java.ast.Node;
import org.pegjs.java.ast.RangeNode;
import org.pegjs.java.ast.RuleNode;
import org.pegjs.java.ast.SequenceNode;
import org.pegjs.java.ast.TextNode;

/**
 * Содержит методы для более удобного генерирования парсера вручную. Для
 * использования сделайте статический импорт:
 * {@code import static org.pegjs.java.Manual.*;}
 * @author Mingun
 */
public final class Manual {
    private Manual() {}
    //<editor-fold defaultstate="collapsed" desc="Базовые правила">
    public static RuleNode rule(String name, Node expression) {
        return new RuleNode(name, expression);
    }
    public static LabeledNode l(String label, Node expression) {
        return new LabeledNode(label, expression);
    }
    public static ActionNode a(CharSequence content, Node expression) {
        return new ActionNode(new Code(content), expression);
    }
    public static ChoiceNode ch(Node... alternatives) {
        return new ChoiceNode(alternatives);
    }
    public static SequenceNode s(Node... elements) {
        return new SequenceNode(elements);
    }
    public static RangeNode r(Node expression, int exact) {
        return new RangeNode(expression, exact);
    }
    public static RangeNode r(Node expression, int min, int max) {
        return new RangeNode(expression, min, max);
    }
    public static LiteralNode li(CharSequence content) {
        return new LiteralNode(content);
    }
    public static TextNode t(Node expression) {
        return new TextNode(expression);
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Сложные правила">
    public static Node digits(int base, int size) {
        if (base < 2 || base > 36) {
            throw new IllegalArgumentException("Number base must be in range [2; 36]: "+base);
        }
        final ClassNode digit;
        if (base <= 10) {
            digit = new ClassNode('0', (char)('0'+base-1));
        } else {
            digit = new ClassNode(false, true, '0','9', 'A',(char)('A'+base-10-1));
        }
        if (size < 0) {
            return new RangeNode(1, null, null, digit);
        }
        if (size == 1) {
            return digit;
        }
        return new RangeNode(digit, size);
    }
    public static Node num(int size) {
        return num(10, size);
    }
    public static Node num(int base, int size) {
        if (size > 1) {
            return t(ch(
                s(li("-"), digits(base, size-1)),
                s(li("+"), digits(base, size-1)),
                digits(base, size)
            ));
        }
        return t(digits(base, size));
    }
    //</editor-fold>
}
