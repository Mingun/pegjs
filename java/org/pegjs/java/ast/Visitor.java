/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

/**
 * Класс для обхода абстрактного синтаксического дерева грамматики.
 * @param <R> Тип возвращаемого значения для каждой функции обхода.
 * @param <Context> Тип дополнительной информации, передаваемой в каждую функцию обхода.
 * 
 * @author Mingun
 */
public interface Visitor<R, Context> {
    public R visit(GrammarNode node, Context context);
    public R visit(RuleNode node, Context context);
    public R visit(NamedNode node, Context context);
    public R visit(ChoiceNode node, Context context);
    public R visit(ActionNode node, Context context);
    public R visit(SequenceNode node, Context context);
    public R visit(LabeledNode node, Context context);
    public R visit(TextNode node, Context context);
    public R visit(SimpleAndNode node, Context context);
    public R visit(SimpleNotNode node, Context context);
    public R visit(SemanticAndNode node, Context context);
    public R visit(SemanticNotNode node, Context context);
    public R visit(OptionalNode node, Context context);
    public R visit(ZeroOrMoreNode node, Context context);
    public R visit(OneOrMoreNode node, Context context);
    public R visit(RangeNode node, Context context);
    public R visit(RuleRefNode node, Context context);
    public R visit(LiteralNode node, Context context);
    public R visit(ClassNode node, Context context);
    public R visit(AnyNode node, Context context);
}
