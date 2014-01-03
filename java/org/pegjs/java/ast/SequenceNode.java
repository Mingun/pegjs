/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.Collections;
import java.util.List;

/**
 *
 * @author Mingun
 */
public final class SequenceNode extends Node {
    public final List<Node> elements;

    public SequenceNode(List<Node> elements) { this.elements = elements; }
    public SequenceNode(Object elements) { this((List<Node>)elements); }

    @Override
    public List<Node> childs() { return Collections.unmodifiableList(elements); }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
