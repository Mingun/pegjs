/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.Collections;
import java.util.List;

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
}
abstract class ExpressionNode extends Node {
    public final Node expression;

    protected ExpressionNode(Node expression) { this.expression = expression; }

    @Override
    public List<Node> childs() { return Collections.singletonList(expression); }
}
/** Базовый класс для узлов, у которых не может быть потомков. */
abstract class LeafNode extends Node {
    @Override
    public final List<Node> childs() { return Collections.emptyList(); }
}
