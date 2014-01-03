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
public final class LabeledNode extends ExpressionNode {
    public final String label;

    public LabeledNode(String label, Node expression) {
        super(expression);
        this.label = label;
    }
    public LabeledNode(Object label, Object expression) {
        this((String)label, (Node)expression);
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
