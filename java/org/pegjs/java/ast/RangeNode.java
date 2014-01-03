/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 *
 * @author Mingun
 */
public final class RangeNode extends ExpressionNode {
    public final Number min;
    public final Number max;
    public final Node delimiter;

    public RangeNode(Number min, Number max, Node delimiter, Node expression) {
        super(expression);
        this.min = min;
        this.max = max;
        this.delimiter = delimiter;
    }
    public RangeNode(Number min, Number max, Object delimiter, Object expression) {
        this(min, max, (Node)delimiter, (Node)expression);
    }

    @Override
    public List<Node> childs() {
        return Collections.unmodifiableList(Arrays.asList(expression, delimiter));
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
