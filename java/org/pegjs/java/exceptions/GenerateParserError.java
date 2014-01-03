/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java.exceptions;

/**
 * Исключение кидается, когда генерация парсера по грамматике невозможна по каким-либо причинам.
 * @author Mingun
 */
public class GenerateParserError extends PEGException {
    public GenerateParserError() {}
    public GenerateParserError(String message) { super(message); }
    public GenerateParserError(Throwable cause) { super(cause); }
    public GenerateParserError(String message, Throwable cause) { super(message, cause); }
}
