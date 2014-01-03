/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

/**
 *
 * @author Mingun
 */
public final class NamedNode extends ExpressionNode {
    public final String name;

    public NamedNode(String name, Node expression) {
        super(expression);
        this.name = name;
    }
    public NamedNode(Object name, Object expression) {
        this((String)name, (Node)expression);
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
