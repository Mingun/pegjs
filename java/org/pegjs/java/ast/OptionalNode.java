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
public final class OptionalNode extends ExpressionNode {
    public OptionalNode(Node expression) { super(expression); }
    public OptionalNode(Object expression) { this((Node)expression); }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
    @Override
    public void toSource(Appendable a) throws IOException {
        super.toSource(a);
        a.append('?');
    }
}
