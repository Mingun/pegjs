/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java;

import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.nio.ByteBuffer;

/**
 *
 * @author Mingun
 * @param <R> Тип результата разбора.
 */
public interface IParser<R> {
    /**
     * Класс для хранения информации о текущей позиции в разбираемых данных.
     * Используется генерируемым кодом парсера для хранения информации о текущем
     * месте разбора.
     */
    public final class State {
        private static final char LINE_SEPARATOR = '\u2028';
        private static final char PARAGRAPH_SEPARATOR = '\u2029';
        private int line = 1;
        private int column = 1;
        private int offset = 0;
        private boolean seenCR = false;

        /**
         * Возвращает текущий номер строки (отсчет с 1) в разбираемом входе.
         * Номер строки увеличивается каждый раз при встрече последовательности
         * символов или одного символа {@literal '\\r\\n'}, {@literal '\\r'} или
         * {@literal '\\n'}.
         */
        public int line() { return line; }
        /**
         * Возвращает текущий номер столбца (отсчет с 1) в разбираемом входе.
         * Номер столбца увеличивается с каждым символом и сбрасывается на 1 при
         * встрече последовательности символов или одного символа {@literal '\\r\\n'},
         * {@literal '\\r'} или {@literal '\\n'}.
         */
        public int column() { return column; }
        /**
         * Возвращает текущее смещение в символах (отсчет с 1) от начала разбираемого
         * входа.
         */
        public int offset() { return offset; }
        protected void next(char ch) {
            ++offset;
            if (ch == '\n') {
                // Так как предыдущий символ был '\\r', на котором мы уже увеличили
                // номер строки, опять его увеличивать не нужно.
                if (!seenCR) {
                    ++line;
                }
                column = 1;
                seenCR = false;
            } else
            if (ch == '\r' || ch == LINE_SEPARATOR || ch == PARAGRAPH_SEPARATOR) {
                ++line;
                column = 1;
                seenCR = true;
            } else {
                ++column;
                seenCR = false;
            }
        }
        protected void reset() {
            line = 1;
            column = 1;
            offset = 0;
            seenCR = false;
        }
    }

    /** Специальный singleton-объект, сигнализирующий о неуспешности разбора правила. */
    public final Object NULL = new Object() {
        @Override
        public String toString() {
            return "<FAILED>";
        }
    };

    public R parse(CharSequence input);
    public R parse(CharSequence input, String startRule);

    public R parse(Reader input) throws IOException;
    public R parse(Reader input, String startRule) throws IOException;

    public R parse(Readable input) throws IOException;
    public R parse(Readable input, String startRule) throws IOException;

    public R parse(InputStream input) throws IOException;
    public R parse(InputStream input, String startRule) throws IOException;

    public R parse(ByteBuffer input);
    public R parse(ByteBuffer input, String startRule);

    public R parse(byte[] input);
    public R parse(byte[] input, String startRule);
}
