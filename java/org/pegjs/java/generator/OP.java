/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.generator;

import org.pegjs.java.IParser;
import org.pegjs.java.Utils;
import org.pegjs.java.ast.GrammarNode;
import org.pegjs.java.exceptions.SyntaxError;

/**
 * Список опкодов байткода. Каждый опкод и каждый аргумент опкода занимает по одному байту.
 * @author Mingun
 */
public enum OP {
    //<editor-fold defaultstate="collapsed" desc="Работа со стеком">
    /**
     * Сохраняет в стеке константу с указанным индексом.
     * <p>Аргументы:
     * <ol>
     * <li>Индекс константы в {@linkplain GrammarNode#consts таблице констант}.</li>
     * </ol>
     * <p>Стек: {@code [] => [ ast.consts[i] ]}.
     */
    PUSH(1),            // 0,    // PUSH c
    /**
     * Сохраняет в стеке текущую позицию в разбираемой последовательности.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [] => [currPos]}.
     */
    PUSH_CURR_POS(0),   // 1,    // PUSH_CURR_POS
    /**
     * Выталкивает из стека один элемент.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [x] => []}.
     */
    POP(0),             // 2,    // POP
    /**
     * Выталкивает из стека элемент, приводит его к числу и трактует, как новую
     * текущую позицию в разбираемой последовательности.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [x] => [], currPos = ((Number)x).intValue()}.
     */
    POP_CURR_POS(0),    // 3,    // POP_CURR_POS
    /**
     * Выталкивает из стека указанное количество элементов.
     * <p>Аргументы:
     * <ol>
     * <li>{@code N} - количество выталкиваемых элементов.</li>
     * </ol>
     * <p>Стек: {@code [x1 x2 ... xN] => []}.
     */
    POP_N(1),           // 4,    // POP_N n
    /**
     * Удаляет из стека один элемент, находящийся непосредственно под вершиной стека.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [x1 x2 x3] => [x1 x3]}.
     */
    NIP(0),             // 5,    // NIP
    /**
     * Удаляет из стека один элемент, находящийся непосредственно под вершиной стека,
     * приводит его к числу и трактует, как новую текущую позицию в разбираемой
     * последовательности.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [x1 x2 x3] => [x1 x3], currPos = ((Number)x2).intValue()}.
     */
    NIP_CURR_POS(0),    // 6,    // NIP_CURR_POS
    /**
     * Выталкивает из стека верхний элемент и помещает его в список, который находится
     * под вершиной стека. После операции на вершине оказывается элемент-список.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [l e] => [l], ((List)l).add(e)}.
     */
    APPEND(0),          // 7,    // APPEND
    /**
     * Выталкивает из стека указанное количество аргументов, объединяет их в список
     * и кладет полученный список на стек.
     * <p>Аргументы:
     * <ol>
     * <li>{@code N} - количество объединяемых в список элементов.</li>
     * </ol>
     * <p>Стек: {@code [x1 x2 ... xN] => [l], l = Arrays.asList(x1, x2, ..., xN)}.
     */
    WRAP(1),            // 8,    // WRAP n
    /**
     * Помещает в стек регион текста между позицией, сохраненной в стеке на одну
     * ниже вершины и текущей позицией в разбираемой последовательности.
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [x1 x2] => [x1 r], r = input.subSequence(x1, currPos).
     */
    TEXT(0),            // 9,    // TEXT
    //</editor-fold>
   
    //<editor-fold defaultstate="collapsed" desc="Условия и циклы">
    /**
     * Опкод ветвления по результатам вызова функции (семантического предиката).
     * Если значение на вершине стека вычисляется в {@code true} (более формально:
     * если значение функции {@link Utils#toBool} от объекта на вершине стека
     * равно {@code true}), то выполняется then-часть, иначе else-часть.
     * 
     * <p>Аргументы: нет.
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    IF(0),              // 10,   // IF t, f
    /**
     * Опкод ветвления по результатам разбора последнего выражения. Если предыдущее
     * выражение <b>не было</b> разобрано (на вершине стека лежит его результат и он
     * <b>равен</b> {@linkplain IParser#NULL}), то выполняется then-часть, иначе
     * выполняется else-часть.
     * 
     * <p>Аргументы: нет.
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    IF_ERROR(0),        // 11,   // IF_ERROR t, f
    /**
     * Опкод ветвления по результатам разбора последнего выражения. Если предыдущее
     * выражение <b>успешно</b> разобрано (на вершине стека лежит его результат и он
     * <b>не равен</b> {@linkplain IParser#NULL}), то выполняется then-часть, иначе
     * выполняется else-часть.
     * 
     * <p>Аргументы: нет.
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    IF_NOT_ERROR(0),    // 12,   // IF_NOT_ERROR t, f
    /**
     * Опкод цикла результатам разбора последнего выражения. Цикл продолжается, пока
     * предыдущее выражение <b>успешно</b> разбирается (на вершине стека лежит его результат
     * и он <b>не равен</b> {@linkplain IParser#NULL}).
     * 
     * <p>После опкода находится длина body-части цикла и сам байткод body-части.
     * Если тело отсутствует, длина равна 0.
     * 
     * <p>Аргументы: нет.
     */
    WHILE_NOT_ERROR(0), // 13,   // WHILE_NOT_ERROR b
    /**
     * Опкод ветвления по результатам проверки соответствия текущего символа
     * любому символу. Если текущая позиция меньше длины разбираемой последовательности,
     * сопоставление успешно и выполняется then-часть, иначе выполняется else-часть.
     * 
     * <p>Аргументы: нет.
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    MATCH_ANY(0),       // 14,   // MATCH_ANY a, f
    /**
     * Опкод ветвления по результатам проверки соответствия подстроки, начинающейся
     * с текущей позиции разбора со строкой из {@linkplain GrammarNode#consts таблицы констант}.
     * Если подстрока, начинающаяся с текущей позиции, начинается с подстроки из таблицы констант,
     * сопоставление успешно и выполняется then-часть, иначе выполняется else-часть.
     * <p>Аргументы:
     * <ol>
     * <li>{@code s} - индекс строки для проверки соответствия в {@linkplain GrammarNode#consts таблице констант}.</li>
     * </ol>
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    MATCH_STRING(1),    // 15,   // MATCH_STRING s, a, f
    /**
     * Опкод ветвления по результатам регистронезависимой проверки соответствия подстроки,
     * начинающейся с текущей позиции разбора со строкой из {@linkplain GrammarNode#consts таблицы констант}.
     * Если подстрока, начинающаяся с текущей позиции, начинается с подстроки из таблицы констант,
     * сопоставление успешно и выполняется then-часть, иначе выполняется else-часть.
     * <p>Аргументы:
     * <ol>
     * <li>{@code s} - индекс строки для проверки соответствия в {@linkplain GrammarNode#consts таблице констант}.</li>
     * </ol>
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    MATCH_STRING_IC(1), // 16,   // MATCH_STRING_IC s, a, f
    /**
     * Опкод ветвления по результатам проверки соответствия подстроки, начинающейся
     * с текущей позиции разбора с указанным регулярным выражением из 
     * {@linkplain GrammarNode#consts таблицы констант}. Если начало подстроки,
     * начинающейся с текущей позиции, соответствует регулярному выражению из
     * таблицы констант, сопоставление успешно и выполняется then-часть, иначе
     * выполняется else-часть.
     * <p>Аргументы:
     * <ol>
     * <li>{@code r} - индекс регулярного выражения для проверки соответствия в 
     * {@linkplain GrammarNode#consts таблице констант}.</li>
     * </ol>
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    MATCH_REGEXP(1),    // 17,   // MATCH_REGEXP r, a, f
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Проверка соответствия">
    /**
     * Сохраняет в стеке подстроку указанной длины, начиная с текущей позиции разбора.
     * Сдвигает текущую позицию вперед на указанную длину.
     * <p>Аргументы:
     * <ol>
     * <li>{@code N} - длина сохраняемой подстроки.</li>
     * </ol>
     * <p>Стек: {@code [] => [s], s = input.subSequence(currPos, currPos + N)}.
     */
    ACCEPT_N(1),        // 18,   // ACCEPT_N n
    /**
     * Сохраняет в стеке указанную строковую константу.
     * Сдвигает текущую позицию вперед на длину константы.
     * <p>Аргументы:
     * <ol>
     * <li>{@code S} - индекс константы в {@linkplain GrammarNode#consts таблице констант}.</li>
     * </ol>
     * <p>Стек: {@code [] => [s], s = ast.consts[S]}.
     */
    ACCEPT_STRING(1),   // 19,   // ACCEPT_STRING s
    /**
     * Кладет на стек {@linkplain IParser#NULL индикатор} ошибки разбора и
     * пытается {@linkplain SyntaxError возбудить ошибку} с указанным сообщением.
     * <p>Аргументы:
     * <ol>
     * <li>{@code e} - индекс сообщения об ошибке в {@linkplain GrammarNode#consts таблице констант}.</li>
     * </ol>
     * <p>Стек: {@code [] => [NULL]}.
     */
    FAIL(1),            // 20,   // FAIL e
    //</editor-fold>
   
    //<editor-fold defaultstate="collapsed" desc="Вызовы">
    /**
     * Извлекает в позицию начала разбора правила, используемой в предикатах и
     * действиях, как текущая позиция, числовое значение из стека.
     * <p>Аргументы:
     * <ol>
     * <li>{@code p} - Индекс в стеке, где записана позиция.</li>
     * </ol>
     * <p>Стек: не меняется.
     */
    REPORT_SAVED_POS(1),// 21,   // REPORT_SAVED_POS p
    /**
     * Извлекает в позицию начала разбора правила, используемой в предикатах и
     * действиях, как текущая позиция, значение текущей позиции разбора.
     * <p>Аргументы: нет.
     * <p>Стек: не меняется, {@code savedPos = currPos}.
     */
    REPORT_CURR_POS(0), // 22,   // REPORT_CURR_POS
    /**
     * Команда вызова функции.
     * <p>Аргументы:
     * <ol>
     * <li>{@code f} - Индекс функции в {@linkplain GrammarNode#actions таблице действий}.</li>
     * <li>{@code n} - Сколько элементов выкинуть из стека после вызова.</li>
     * <li>{@code pc} - Количество аргументов функции.</li>
     * <li>{@code pX} - и дальше: Аргументы.</li>
     * </ol>
     * <p>Стек: {@code [f, n, pc, p1, p2, ..., pN] => [r], r = ast.actions[f](p1, p2, ..., pN)}.
     */
    CALL(-3),           // 23,   // CALL f, n, pc, p1, p2, ..., pN
    //</editor-fold>
   
    /* Rules */
    /**
     * Команда вызова разбора указанного правила.
     * <p>Аргументы:
     * <ol>
     * <li>{@code r} - индекс правила в {@linkplain GrammarNode#rules списке правил разбора}.</li>
     * </ol>
     */
    RULE(1),            // 24,   // RULE r
   
    /* Failure Reporting */
   
    /**
     * Включает подавление генерирования кандидатов для разбора при формировании
     * синтаксической ошибки.
     * <p>Аргументы: нет.
     */
    SILENT_FAILS_ON(0), // 25,   // SILENT_FAILS_ON
    SILENT_FAILS_OFF(0),// 26,   // SILENT_FAILS_OFF
    
    /* Checking array length */
    
    /**
     * Опкод ветвления по результатам проверки минимальной длины списка. В вершины
     * стека снимается значение длины. После этого на вершине стека оказывается
     * проверяемый список. Если длина списка <b>больше или равна (>=)</b> минимальной
     * длине, то выполняется then-часть, иначе выполняется else-часть.
     * 
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [l min] => [l], if (l.size() >= min)}.
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    IF_ARRLEN_MIN(0),   // 27,   // IF_ARRLEN_MIN t f
    /**
     * Опкод ветвления по результатам проверки максимальной длины списка. В вершины
     * стека снимается значение длины. После этого на вершине стека оказывается
     * проверяемый список. Если длина списка <b>строго меньше (&lt;)</b> максимальной
     * длины, то выполняется then-часть, иначе выполняется else-часть.
     * 
     * <p>Аргументы: нет.
     * 
     * <p>Стек: {@code [l max] => [l], if (l.size() < max)}.
     * 
     * <p>Все опкоды ветвления устроены одинаково: сначала идет сам опкод, потом (не у всех)
     * его аргументы, потом длина then-части, длина else-части и байткод then и else
     * частей. Если одна из частей отсутствует, ее длина равна 0.
     */
    IF_ARRLEN_MAX(0),   // 28,   // IF_ARRLEN_MAX t f

    /**
     * Сохраняет в стеке пустую строку.
     * <p>Аргументы: нет.
     * <p>Стек: {@code [] => [""]}.
     */
    PUSH_EMPTY_STRING(0),//30,   // PUSH_EMPTY_STRING: stack: +""
    /**
     * Сохраняет в стеке новый пустой список.
     * <p>Аргументы: нет.
     * <p>Стек: {@code [] => [new List()]}.
     */
    PUSH_EMPTY_ARRAY(0),// 31,   // PUSH_EMPTY_ARRAY: stack: +[]
    /**
     * Сохраняет в стеке {@linkplain IParser#NULL признак} неудачи разбора.
     * <p>Аргументы: нет.
     * <p>Стек: {@code [] => [NULL]}.
     */
    PUSH_NULL(0);       // 32,   // PUSH_EMPTY_ARRAY: stack: +null
    
    /** Количество аргументов опкода. */
    public final byte count;
    OP(int count) { this.count = (byte)count; }
    public byte v() { return (byte)ordinal(); }
    public byte[] a() {check(0);return new byte[]{v()};}
    public byte[] a(int arg1) {check(1);return new byte[]{v(), (byte)arg1};}
    public byte[] a(int arg1, int arg2) {check(2);return new byte[]{v(), (byte)arg1, (byte)arg2};}
    public byte[] a(int arg1, int arg2, int arg3) {check(3);return new byte[]{v(), (byte)arg1, (byte)arg2, (byte)arg3};}
    
    private void check(int cnt) {
        if (count > 0 && cnt != count) {
            throw new IllegalArgumentException("Opcode "+name()+" require "+count+" arguments, but "+cnt+" given");
        }
    }
}