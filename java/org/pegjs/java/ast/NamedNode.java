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
    @Override
    public void toSource(Appendable a) throws IOException {
        a.append('\'');
        if (name != null) {
            // Экранируем обратный слеш и кавычку.
            a.append(name.replace("\\", "\\\\").replace("'", "\\'"));
        }
        a.append("'\n  = ");
        super.toSource(a);
    }
}
