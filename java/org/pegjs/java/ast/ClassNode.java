/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.pegjs.java.generator.Parser;

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

        public CharacterClass(char begin, char end) {
            this.begin = begin;
            this.end = end;
            this.rawText = quoteForRegexpClass(begin) + '-' + quoteForRegexpClass(end);
        }
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

        public void toSource(Appendable a) throws IOException {
            a.append(begin);
            if (isRange()) {
                a.append('-').append(end);
            }
        }
    }

    public ClassNode(CharSequence pattern) {
        rawText = pattern.toString();
        inverted = pattern.charAt(2) == '^';
        ignoreCase = pattern.charAt(pattern.length()-1) == 'i';
        parts = null;//TODO: implement
        //throw new UnsupportedOperationException("Not yet implemented.");
    }
    public ClassNode(char... parts) {
        this(false, false, parts);
    }
    public ClassNode(boolean inverted, boolean ignoreCase, char... parts) {
        this(createParts(parts), inverted, ignoreCase);
    }
    public ClassNode(char begin, char end, boolean inverted, boolean ignoreCase) {
        this(Arrays.asList(new CharacterClass(begin, end)), inverted, ignoreCase);
    }
    public ClassNode(List<CharacterClass> parts, boolean inverted, boolean ignoreCase) {
        this.parts = parts;
        final StringBuilder sb = new StringBuilder();
        sb.append('[');
        if (inverted) {
            sb.append('^');
        }
        for (CharacterClass cc : this.parts) {
            sb.append(cc.rawText);
        }
        sb.append(']');
        if (ignoreCase) {
            sb.append('i');
        }
        this.rawText = sb.toString();
        
        this.inverted = inverted;
        this.ignoreCase = ignoreCase;
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
    @Override
    public void toSource(Appendable a) throws IOException {
        a.append('[');
        if (inverted) {
            a.append('^');
        }
        if (parts != null) {
            for (CharacterClass cc : parts) {
                cc.toSource(a);
            }
        }
        a.append(']');
        if (ignoreCase) {
            a.append('i');
        }
    }
    private static List<CharacterClass> createParts(char... parts) {
        if (parts.length % 2 != 0) {
            throw new IllegalArgumentException("Expected the even number of chars");
        }
        final List<CharacterClass> result = new ArrayList<CharacterClass>(parts.length/2);
        for (int i = 0; i < parts.length; i += 2) {
            result.add(new CharacterClass(parts[i], parts[i+1]));
        }
        return result;
    }
}
