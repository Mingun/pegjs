/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java.exceptions;

import java.util.List;
import org.pegjs.java.Error;

/**
 *
 * @author Mingun
 */
public class SyntaxError extends PEGException {
    private final List<Error> expected;
    private final Character found;
    private final int offset;
    private final int line;
    private final int column;

    /**
     * 
     * @param expected Список ожидаемых символов или имен правил.
     * @param found Текущий символ или {@code null} в случае {@code EOF}.
     * @param offset Позиция в разбираемой строке, в котрой возникла исключение.
     * @param line Номер строки в разбираемой строке.
     * @param column Номер столбца в разбираемой строке.
     */
    public SyntaxError(String message, List<Error> expected, Character found, int offset, int line, int column) {
        super(message != null ? message : buildMessage(expected, found, line, column));
        this.expected = expected;
        this.found    = found;
        this.offset   = offset;
        this.line     = line;
        this.column   = column;
    }
    private static String buildMessage(List<Error> expected, Character found, int line, int column) {
        //"Line %d, column %d: Expected %s, but %s found.";
        final StringBuilder sb = new StringBuilder();
        sb.append("Line ").append(line).append(", column ").append(column);
        sb.append(": Expected ");

        final int last = expected.size()-1;
        if (last > 0) {
            for (int i = 0; i < last; ++i) {
                sb.append(expected.get(i).description).append(", ");
            }
            sb.append("or ");
        }
        sb.append(expected.get(last).description);

        sb.append(" but ");
        if (found != null) {
            sb.append('"').append(stringEscape(found)).append('"');
        } else {
            sb.append("end of input");
        }
        sb.append(" found.");
        return sb.toString();
    }
    /**
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
     * literal except for the closing quote character, backslash, carriage
     * return, line separator, paragraph separator, and line feed. Any character
     * may appear in the form of an escape sequence.
     *
     * For portability, we also escape all control and non-ASCII characters.
     * Note that "\0" and "\v" escape sequences are not used because JSHint does
     * not like the first and IE the second.
     */
    private static Character stringEscape(Character s) {
        return s;
        /*function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

        return s
          .replace(/\\/g,   '\\\\')
          .replace(/"/g,    '\\"')
          .replace(/\x08/g, '\\b')
          .replace(/\t/g,   '\\t')
          .replace(/\n/g,   '\\n')
          .replace(/\f/g,   '\\f')
          .replace(/\r/g,   '\\r')
          .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
          .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
          .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
          .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });*/
    }
}
