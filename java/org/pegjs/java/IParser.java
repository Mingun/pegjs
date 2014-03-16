/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java;

import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.pegjs.java.exceptions.SyntaxError;
import org.pegjs.java.generator.OP;

/**
 *
 * @author Mingun
 * @param <R> Тип результата разбора.
 */
public interface IParser<R> {
    //<editor-fold defaultstate="collapsed" desc="Внутренние классы и интерфейсы">
    /**
     * Класс для хранения информации о текущей позиции в разбираемых данных.
     * Используется генерируемым кодом парсера для хранения информации о текущем
     * месте разбора.
     */
    public final class State implements Cloneable, Comparable<State> {
        private static final char LINE_SEPARATOR = '\u2028';
        private static final char PARAGRAPH_SEPARATOR = '\u2029';
        private int line = 1;
        private int column = 1;
        private int offset = 0;
        private boolean seenCR = false;

        //<editor-fold defaultstate="collapsed" desc="Публичный интерфейс">
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
        //</editor-fold>
        
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
        protected void moveTo(CharSequence input, int pos) {
            // Мы и так в требуемом месте, ничего делать не требуется.
            if (offset == pos) return;
            // Если текущая позиция после запрошенной позиции, то все надо начинать
            // с начала.
            if (offset > pos) {
                reset();
            }
            for (int i = offset; i < pos; ++i) {
                char ch = input.charAt(i);
                next(ch);
            }
            offset = pos;
        }
        protected void reset() {
            line = 1;
            column = 1;
            offset = 0;
            seenCR = false;
        }

        //<editor-fold defaultstate="collapsed" desc="Функции проверки соответствия в текущей позиции">
        /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_STRING}. */
        protected final boolean test(CharSequence input, char ch) {
            if (input.length() <= offset) return false;
            return input.charAt(offset) == ch;
        }
        /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_STRING}. */
        protected final boolean test(CharSequence input, CharSequence seq) {
            final int end = offset + seq.length();
            if (input.length() <= end) return false;
            return input.subSequence(offset, end).toString().contentEquals(seq);
        }
        /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_STRING_IC}. */
        protected final boolean testi(CharSequence input, CharSequence seq) {
            final int end = offset + seq.length();
            if (input.length() <= end) return false;
            return input.subSequence(offset, end).toString().equalsIgnoreCase(seq.toString());
        }
        /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_REGEXP}. */
        protected final boolean test(CharSequence input, Pattern p) {
            if (input.length() <= offset) return false;
            final char ch = input.charAt(offset);
            return p.matcher(String.valueOf(ch)).matches();
        }
        //</editor-fold>

        @Override
        public int compareTo(State o) {
            // Объект всегда больше, чем null.
            return o == null ? 1 : Integer.compare(offset, o.offset);
        }
    }
    public final class Expected {
        /**
         * Позиция, в которой ожидается появление элементов грамматики,
         * перечисленных в {@link #candidates}.
         */
        protected int pos;
        /**
         * Список имен правил подстрок или классов символов, которые могут
         * ожидаться при разборе правила в позиции {@link pos}. Храним в виде
         * списка а не множества, потому как добавление в список быстрее, а он
         * нам может и не понадобиться. Поэтому сортируется он только тогда,
         * когда это действительно нужно.
         */
        protected final List<Error> candidates = new ArrayList<Error>();
        
        public void add(int currentPos, Error expected) {
            if (currentPos < pos) {
                return;
            }
            // Если ошибка произошла позднее, то значит, мы уже продвинулись вперед
            // следовательно, ошибка ранее не произошло (мы бы ее не миновали),
            // следовательно, старые данные нужно почистить.
            if (currentPos > pos) {
                pos = currentPos;
                candidates.clear();
            }
            candidates.add(expected);
        }
        public void reset() {
            pos = 0;
            candidates.clear();
        }
        public SyntaxError generate(CharSequence input, String message) {
            final Character found = pos < input.length() ? input.charAt(pos) : null;
            final State s = new State();
            s.moveTo(input, pos);
            return new SyntaxError(message, candidates, found, pos, s.line, s.column);
        }
    }
    public final class CachedResult {
        /** Позиция, где должен окончится разбор закешированного результата. */
        public final int nextPos;
        /** Результат разбора. */
        public final Object result;

        public CachedResult(int nextPos, Object result) {
            this.nextPos = nextPos;
            this.result = result;
        }
    }
    //</editor-fold>

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
