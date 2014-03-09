/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.io.IOException;

/**
 *
 * @author Mingun
 */
public final class ActionNode extends ExpressionNode {
    public final Code code;

    public ActionNode(Code code, Node expression) {
        super(expression);
        this.code = code;
    }
    public ActionNode(Object code, Object expression) {
        this((Code)code, (Node)expression);
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
    @Override
    public void toSource(Appendable a) throws IOException {
        a.append('(');
        if (expression != null) {
            expression.toSource(a);
        }
        a.append(" {");
        if (code != null) {
            code.toSource(a);
        }
        a.append("})");
    }
}
