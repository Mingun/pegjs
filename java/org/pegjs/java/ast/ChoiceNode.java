/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 *
 * @author Mingun
 */
public final class ChoiceNode extends Node {
    public final List<Node> alternatives;

    public ChoiceNode(List<Node> alternatives) { this.alternatives = alternatives; }
    public ChoiceNode(Object head, List<List<Node>> tail) {
        alternatives = new ArrayList<Node>(tail.size() + 1);
        alternatives.add((Node)head);
        // Каждый элемент хвоста - последовательность из двух элементов: '/' <expr>
        for (List<Node> n : tail) {
            alternatives.add(n.get(1));
        }
    }

    @Override
    public List<Node> childs() { return Collections.unmodifiableList(alternatives); }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
