/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.List;

/**
 *
 * @author Mingun
 */
public final class ClassNode extends LeafNode {
    public final List<CharacterClass> parts;
    public final String rawText;
    public final boolean inverted;
    public final boolean ignoreCase;
    
    public static final class CharacterClass {
        /** Начало диапазона символов или сам символ (см. {@link #isRange}). */
        public final char begin;
        /** Конец диапазона символов или сам символ (см. {@link #isRange}). */
        public final char end;
        public final CharSequence rawText;

        public CharacterClass(CharacterClass begin, CharacterClass end) {
            if (begin.begin > end.begin) {
                throw new IllegalArgumentException(//TODO: SyntaxError
                    "Invalid character range: " + begin.rawText + "-" + end.rawText + "."
                );
            }
            if (begin.isRange()) throw new IllegalArgumentException("Begin symbol is range");
            if (end.isRange()) throw new IllegalArgumentException("End symbol is range");
            this.begin  = begin.begin;
            this.end    = end.begin;
            this.rawText= begin.rawText + "-" + end.rawText;
        }
        public CharacterClass(char ch, CharSequence rawText) {
            this.begin = ch;
            this.end = ch;
            this.rawText = rawText;
        }
        public CharacterClass(Object ch) {
            this(ch.toString().charAt(0), quoteForRegexpClass(ch.toString().charAt(0)));
        }
        public CharacterClass(Object begin, Object end) {
            this((CharacterClass)begin, (CharacterClass)end);
        }
        public boolean isRange() { return begin != end; }
        
        /*
         * Escapes characters inside the string so that it can be used as a list of
         * characters in a character class of a regular expression.
         */
        public static String quoteForRegexpClass(char ch) {
            switch (ch) {
                case '\\': return "\\\\";  // backslash
                case '/': return "\\/";   // closing slash
                case ']': return "\\]";   // closing bracket
                case '^': return "\\^";   // caret
                case '-': return  "\\-";   // dash
                case '\0': return "\\0";   // null
                case '\t': return "\\t";   // horizontal tab
                case '\n': return "\\n";   // line feed
                case '\u000B': return "\\v"; // vertical tab
                case '\f': return "\\f";   // form feed
                case '\r': return "\\r";   // carriage return
                default: return ""+ch;
            }
        }
    }

    public ClassNode(Object parts, Object inverted, Object flags) {
        this.parts = (List<CharacterClass>)parts;
        final StringBuilder sb = new StringBuilder();
        sb.append('[').append(inverted);
        for (CharacterClass cc : this.parts) {
            sb.append(cc.rawText);
        }
        sb.append(']').append(flags);
        this.rawText = sb.toString();
        
        this.inverted = "^".equals(inverted);
        this.ignoreCase = "i".equals(flags);
    }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { return v.visit(this, context); }
}
