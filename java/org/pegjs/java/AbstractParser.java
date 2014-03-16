/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java;

import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Pattern;
import org.pegjs.java.exceptions.PEGException;
import org.pegjs.java.exceptions.SyntaxError;
import org.pegjs.java.generator.OP;

/**
 *
 * @author Mingun
 * @param <R> Тип результата разбора.
 */
@Deprecated
public abstract class AbstractParser<R> implements IParser<R> {
    //<editor-fold defaultstate="collapsed" desc="Поля и константы">
    /** Специальный singleton-объект, сигнализирующий о неуспешности разбора правила. */
    @Deprecated//TODO: Использовать NULL
    protected static final Object peg$FAILED = NULL;
    protected CharSequence input;

    /** Текущая позиция в строке. Активно используется генерируемыми методами разбора. */
    protected int peg$currPos;
    /**
     * Внутри действий/предикатов эта позиция является текущей, возвращаемой функцией
     * {@link #offset()}, а также в этой позиции будут генерироваться пользовательские
     * {@link #error(java.lang.String) ошибки}.
     */
    protected int peg$reportedPos;
    protected int peg$silentFails;

    /** Позиция, обновляемая каждый раз, как требуется информация о строке или столбце. */
    private final Pos cachedPosDetails = new Pos();
    /** Содержит список ожидаемых в указанной позиции вариантов разбора символа. */
    private final Expected expected = new Expected();

    /** Список возможных стартовых правил. */
    private final List<String> startRuleFunctions;
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Внутренние классы и интерфейсы">
    /** Информация о текущей позиции в разбираемой строке. */
    @Deprecated//TODO: Заменить на State
    private final static class Pos {
        private static final char LINE_SEPARATOR = '\u2028';
        private static final char PARAGRAPH_SEPARATOR = '\u2029';
        private int line = 1;
        private int column = 1;
        private int offset = 0;
        private boolean seenCR = false;

        public int line() { return line; }
        public int column() { return column; }
        public int offset() { return offset; }
        private void next(char ch) {
            if (ch == '\n') {
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
        private void reset() {
            line = 1;
            column = 1;
            offset = 0;
            seenCR = false;
        }
        private void moveTo(CharSequence input, int pos) {
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
    }
    //</editor-fold>

    /**
     * 
     * @param startRules Список возможных стартовых правил.
     */
    protected AbstractParser(String... startRules) {
        startRuleFunctions = Arrays.asList(startRules);
        Collections.sort(startRuleFunctions);
    }
    //<editor-fold defaultstate="collapsed" desc="Функции разбора">
    @Override
    public final R parse(CharSequence input) {
        return parse(input, null);
    }
    @Override
    public final R parse(Reader input) throws IOException {
        return parse(input, null);
    }
    @Override
    public final R parse(Reader input, String startRule) throws IOException {
        throw new UnsupportedOperationException("Not yet implemented");
    }
    @Override
    public final R parse(Readable input) throws IOException {
        return parse(input, null);
    }
    @Override
    public final R parse(Readable input, String startRule) throws IOException {
        throw new UnsupportedOperationException("Not yet implemented");
    }
    @Override
    public final R parse(InputStream input) throws IOException {
        return parse(input, null);
    }
    @Override
    public final R parse(InputStream input, String startRule) throws IOException {
        throw new UnsupportedOperationException("Not yet implemented");
    }
    @Override
    public final R parse(ByteBuffer input) {
        return parse(Utils.asCharSequence(input));
    }
    @Override
    public final R parse(ByteBuffer input, String startRule) {
        return parse(Utils.asCharSequence(input), startRule);
    }
    @Override
    public final R parse(byte[] input) {
        return parse(Utils.asCharSequence(input));
    }
    @Override
    public final R parse(byte[] input, String startRule) {
        return parse(Utils.asCharSequence(input), startRule);
    }
    protected final R parse(CharSequence input, String startRule, String defaultRule) {
        // Сбрасываем состояние парсера.
        clear();
        this.input = input;
        this.peg$silentFails = 0;
        
        // Начинаем разбор с указанного стартового правила.
        final R result = (R)callRule(this.startRule(startRule, defaultRule));

        // Если разбор успешно завершен и поглощен весь ввод, возвращаем результат.
        if (result != peg$FAILED && peg$currPos == this.input.length()) {
            return result;
        } else {
            // В противном случае формируем сообщение об ошибке.
            if (result != peg$FAILED && peg$currPos < this.input.length()) {
                fail(new Error("end", null, "end of input"));
            }

            throw buildSyntaxError(null, expected.candidates, expected.pos);
        }
    }
    //</editor-fold>

    public final void expected(String description) {
        throw buildSyntaxError(
            null,
            Arrays.asList(new Error("other", null, description)),
            peg$reportedPos
        );
    }

    public final void error(String message) {
        throw buildSyntaxError(message, null, peg$reportedPos);
    }

    //<editor-fold defaultstate="collapsed" desc="Функции, вызываемые в генерируемых подкласах">
    /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_STRING}. */
    protected final boolean test(char ch) {
        if (input.length() <= this.peg$currPos) return false;
        return input.charAt(this.peg$currPos) == ch;
    }
    /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_STRING}. */
    protected final boolean test(CharSequence seq) {
        final int end = this.peg$currPos + seq.length();
        if (input.length() <= end) return false;
        return input.subSequence(this.peg$currPos, end).toString().contentEquals(seq);
    }
    /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_STRING_IC}. */
    protected final boolean testi(CharSequence seq) {
        final int end = this.peg$currPos + seq.length();
        if (input.length() <= end) return false;
        return input.subSequence(this.peg$currPos, end).toString().equalsIgnoreCase(seq.toString());
    }
    /** Функция проверки соответствия для опкода {@linkplain OP#MATCH_REGEXP}. */
    protected final boolean test(Pattern p) {
        if (input.length() <= this.peg$currPos) return false;
        final char ch = input.charAt(this.peg$currPos);
        return p.matcher(String.valueOf(ch)).matches();
    }
    protected static boolean toBool(Object o) {
        return Utils.toBool(o);
    }
    protected final void peg$mayBeFail(Error expected) {
        if (peg$silentFails == 0) {
            fail(expected);
        }
    }
    //</editor-fold>
    
    //<editor-fold defaultstate="collapsed" desc="Внутренние функции">
    private void clear() {
        peg$currPos = 0;
        peg$reportedPos = 0;
        cachedPosDetails.reset();
        expected.reset();
    }
    /**
     * Получает стартовое правило, с которого начать разбор.
     * @param startRule Имя правила, с которого начинать разбор.
     * @param defaultRule Правило по-умолчанию, если указанное стартовое правило
     *        равно {@code null}.
     * @throws PEGException Если указанное правило не может быть начальным.
     * @return Имя функции, осуществляющей разбор.
     */
    private String startRule(String startRule, String defaultRule) {
        if (startRule != null) {
            if (Collections.binarySearch(this.startRuleFunctions, startRule) < 0) {
                throw new PEGException("Can't start parsing from rule \"" + startRule + "\".");
            }
            return "peg$parse"+startRule;
        }
        return "peg$parse"+defaultRule;
    }
    /**
     * Добавляет указанную строку в список ожидаемых альтернатив для текущей
     * позиции разбора.
     * @param expected
     */
    private void fail(Error expected) {
        this.expected.add(peg$currPos, expected);
    }
    //</editor-fold>
    
    //<editor-fold defaultstate="collapsed" desc="Манипуляции с позицией">
    /**
     * 
     * @param pos Текущая позиция в разбираемом тексте.
     * @return 
     */
    private Pos computePosDetails(int pos) {
        // Пододвигаем текущую позицию вперед в новое положение.
        cachedPosDetails.moveTo(input, pos);
        return cachedPosDetails;
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Создание исключения синтаксической ошибки">
    /**
     * 
     * @param message
     * @param expected
     * @param pos Позиция, в которой возбуждается синтаксическая ошибка.
     * @return 
     */
    private SyntaxError buildSyntaxError(String message, List<Error> expected, int pos) {
        // Вычисляем строку и столбец.
        final Pos p = computePosDetails(pos);
        final Character found = pos < input.length() ? input.charAt(pos) : null;

        return new SyntaxError(
            message, expected, found,
            pos, p.line, p.column
        );
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Получение информации о тексте">
    protected CharSequence text() {
        return input.subSequence(peg$reportedPos, peg$currPos);
    }
    protected final int offset() {
        return peg$reportedPos;
    }
    protected final int line() {
        return computePosDetails(peg$reportedPos).line();
    }
    protected final int column() {
        return computePosDetails(peg$reportedPos).column();
    }
    //</editor-fold>
    protected abstract Object callRule(String ruleName);
    
    public static String join(Iterable list) {
        return join(list, null);
    }
    public static String join(Iterable list, Object delimiter) {
        final StringBuilder sb = new StringBuilder();
        if (delimiter == null || "".equals(delimiter)) {
            for (Object e : list) {
                sb.append(e);
            }
        } else {
            final Iterator it = list.iterator();
            if (it.hasNext()) sb.append(it.next());

            while (it.hasNext()) {
                sb.append(delimiter);
                sb.append(it.next());
            }
        }
        return sb.toString();
    }
}