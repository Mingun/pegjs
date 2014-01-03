/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java.exceptions;

/**
 *
 * @author Mingun
 */
public class PEGException extends RuntimeException {
    public PEGException() {}
    public PEGException(String message) { super(message); }
    public PEGException(Throwable cause) { super(cause); }
    public PEGException(String message, Throwable cause) { super(message, cause); }
}
