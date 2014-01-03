/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

/**
 * Узел, представляющий одно правило разбора. Каждое правило имеет имя, тип возвращаемого
 * значения и признак кешируемости результатов разбора. Видимое в ошибках название правила
 * содержится в узле {@link NamedNode}, если этот узел является непосредственным потомком
 * данного узла.
 * 
 * @author Mingun
 */
public final class RuleNode extends ExpressionNode {
    public final String name;
    public byte[] bytecode;
    /**
     * Тип результата, который возвращается данным правилом. Если {@code null} --
     * то {@link Object}.
     * <p>Нет поддержки в грамматике.
     * <p>Еще не реализовано.
     */
    public String resultTypeClass;
    /**
     * Определяет, кешируются ли результаты разбора данного правила.
     * <p>Нет поддержки в грамматике.
     * <p>Еще не реализовано.
     */
    public boolean cashed;
    /**
     * Комментарий r правилу, если есть.
     * <p>Нет поддержки в грамматике.
     * <p>Еще не реализовано.
     */
    public String comment;

    public RuleNode(String name, Node expression) {
        super(expression);
        this.name = name;
    }

    public RuleNode(String name, String displayName, Node expression) {
        this(name, displayName == null ? expression : new NamedNode(displayName, expression));
    }
    public RuleNode(Object name, Object displayName, Object expression) {
        this((String)name, (String)displayName, (Node)expression);
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }

    public String returnType() {
        return resultTypeClass == null ? "Object" : resultTypeClass;
    }
}
