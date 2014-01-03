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
public final class RuleRefNode extends LeafNode {
    public final String name;

    public RuleRefNode(String name) { this.name = name; }
    public RuleRefNode(Object name) { this((String)name); }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
