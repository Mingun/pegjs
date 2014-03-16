/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 *
 * @author Mingun
 */
public final class RangeNode extends ExpressionNode {
    public final Number min;
    public final Number max;
    public final Node delimiter;

    public RangeNode(Node expression, int min, int max) {
        this(min, max, null, expression);
    }
    public RangeNode(Node expression, int exact) {
        this(exact, exact, null, expression);
    }
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

    @Override
    public void toSource(Appendable a) throws IOException {
        super.toSource(a);
        a.append('|');
        if (min != null) {
            a.append(min.toString());
        }
        if (!Objects.equals(min, max)) {
            a.append("..");
            if (max != null) {
                a.append(max.toString());
            }
        }
        if (delimiter != null) {
            a.append(',');
            delimiter.toSource(a);
        }
        a.append('|');
    }
}