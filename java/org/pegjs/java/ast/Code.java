/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.io.IOException;
import java.util.Objects;
import java.util.Set;

/**
 * Элемент для представления кода действий/условий и кода инициализатора.
 * @author Mingun
 */
public final class Code {
    public final CharSequence content;
    public Set<String> params;
    /**
     * Тип результата, который возвращается данным куском кода. Если {@code null} --
     * то {@link Object}.
     * <p>Нет поддержки в грамматике.
     * <p>Еще не реализовано.
     */
    public String resultTypeClass;

    public Code(CharSequence content) {
        if (content == null) {
            throw new IllegalArgumentException("'content' must not be null");
        }
        this.content = content;
    }
    public CharSequence arguments() {
        final StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (String p : params) {
            if (!first) {
                sb.append(", ");
            }
            sb.append("Object ");
            sb.append(p);
            first = false;
        }
        return sb;
    }
    public String returnType() {
        return resultTypeClass == null ? "Object" : resultTypeClass;
    }

    @Override
    public int hashCode() {
        int hash = 7;
        hash = 71 * hash + this.content.hashCode();
        hash = 71 * hash + Objects.hashCode(this.params);
        return hash;
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null) {
            return false;
        }
        if (getClass() != obj.getClass()) {
            return false;
        }
        final Code other = (Code) obj;
        if (!this.content.equals(other.content)) {
            return false;
        }
        if (!Objects.equals(this.params, other.params)) {
            return false;
        }
        return true;
    }

    public void toSource(Appendable a) throws IOException {
        if (content != null) {
            a.append(content);
        }
    }
}
