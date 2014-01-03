/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java;

public class Error implements Comparable<Error> {
    public final String type;
    public final String value;
    public final String description;
    public Error(String type, String value, String description) {
        this.type = type;
        this.value = value;
        this.description = description;
    }
    @Override
    public int compareTo(Error other) {
        return description.compareTo(other.description);
    }
}
