/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java;

public final class ErrorDescription implements Comparable<ErrorDescription> {
    public enum Type {
        ANY,
        CLASS,
        LITERAL,
        EOF,
        USER;

        @Override
        public String toString() {
            return Type.class.getName().replace('$', '.')+'.'+name();
        }
    }
    public final Type type;
    public final String value;
    public final String description;
    public ErrorDescription(Type type, String value, String description) {
        this.type = type;
        this.value = value;
        this.description = description;
    }
    @Override
    public int compareTo(ErrorDescription other) {
        return description.compareTo(other.description);
    }

    @Override
    public String toString() {
        return "Error(type="+type.name()+",value="+value+",description="+description+")";
    }
}
