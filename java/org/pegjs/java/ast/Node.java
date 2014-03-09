/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Базовый узел абстрактного синтаксического дерева грамматики.
 * @author Mingun
 */
public abstract class Node {
    /**
     * Возвращает неизменяемый список дочерних элементов.
     * @return Список дочерних элементов. Никогда не бывает {@code null}.
     */
    public abstract List<Node> childs();
    public abstract <R, Context> R visit(Visitor<R, Context> v, Context context);
    public abstract void toSource(Appendable a) throws IOException;
    public final String toSource() {
        try {
            final StringBuilder sb = new StringBuilder();
            toSource(sb);
            return sb.toString();
        } catch (IOException ex) {
            throw (InternalError)new InternalError("Must be unreachable").initCause(ex);
        }
    }
}
abstract class ExpressionNode extends Node {
    public final Node expression;

    protected ExpressionNode(Node expression) { this.expression = expression; }

    @Override
    public List<Node> childs() { return Collections.singletonList(expression); }

    @Override
    public void toSource(Appendable a) throws IOException {
        if (expression != null) {
            final boolean isComplex = !(
                expression instanceof ExpressionNode
             || expression instanceof LeafNode
            );
            // В случае сложных выражений берем вложенное выражение в скобки.
            // Если же выражение простое, скобки не нужны.
            if (isComplex) a.append('(');
            expression.toSource(a);
            if (isComplex) a.append(')');
        }
    }
}
/** Базовый класс для узлов, у которых не может быть потомков. */
abstract class LeafNode extends Node {
    @Override
    public final List<Node> childs() { return Collections.emptyList(); }
}
