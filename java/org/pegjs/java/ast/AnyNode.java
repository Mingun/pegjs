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
public final class AnyNode extends LeafNode {
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }

    @Override
    public void toSource(Appendable a) throws IOException {
        a.append('.');
    }
}
