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
public final class LiteralNode extends LeafNode {
    public final String value;
    public final boolean ignoreCase;

    public LiteralNode(String value, boolean ignoreCase) {
        this.value = value;
        this.ignoreCase = ignoreCase;
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
