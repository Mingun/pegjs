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
public final class LiteralNode extends LeafNode {
    public final CharSequence value;
    public final boolean ignoreCase;

    public LiteralNode(CharSequence value, boolean ignoreCase) {
        this.value = value;
        this.ignoreCase = ignoreCase;
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }

    @Override
    public void toSource(Appendable a) throws IOException {
        a.append('\'');
        if (value != null) {
            // Экранируем обратный слеш и кавычку.
            a.append(value.toString().replace("\\", "\\\\").replace("'", "\\'"));
        }
        a.append('\'');
        if (ignoreCase) {
            a.append('i');
        }
    }
}
