/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java;

import java.nio.ByteBuffer;
import java.util.Arrays;

/**
 * Предоставляет сервисные функции, которые могут быть полезны генерируемым классам
 * парсеров.
 * @author Mingun
 */
public final class Utils {
    private Utils() {}
    //<editor-fold defaultstate="collapsed" desc="Внутренние классы и интерфейсы">
    /**
     * Представляет массив байт как последовательность символов. Каждый байт массива
     * рассматривается как один символ.
     */
    private static final class ByteArrayAsCharSequence implements CharSequence, Cloneable {
        private final byte[] content;
        private final int offset;
        private final int length;
        
        public ByteArrayAsCharSequence(byte[] content) {this(content, 0, content.length);}
        public ByteArrayAsCharSequence(byte[] content, int offset, int length) {
            if (length < 0) {
                throw new IllegalArgumentException("'length' must be > 0: "+length);
            }
            if (offset < 0 || offset > content.length - length) {
                throw new IndexOutOfBoundsException("Bounds: [0; "+(content.length - length)+"], offset="+offset);
            }
            this.content = content;
            this.offset = offset;
            this.length = length;
        }
        @Override
        public int length() { return length; }
        @Override
        public char charAt(int index) { return (char)content[offset + index]; }
        @Override
        public CharSequence subSequence(int start, int end) {
            return new ByteArrayAsCharSequence(content, offset + start, end - start);
        }
        @Override
        public ByteArrayAsCharSequence clone() {
            return new ByteArrayAsCharSequence(Arrays.copyOfRange(content, offset, offset + length));
        }
    }
    /**
     * Представляет буфер байт как последовательность символов. Каждый байт буфера
     * рассматривается как один символ.
     */
    private static final class ByteBufferAsCharSequence implements CharSequence {
        private final ByteBuffer content;
        
        public ByteBufferAsCharSequence(ByteBuffer content) {
            this.content = content.duplicate();
        }
        @Override
        public int length() { return content.remaining(); }
        @Override
        public char charAt(int index) { return (char)content.get(index); }
        @Override
        public CharSequence subSequence(int start, int end) {
            content.position(start);
            return new ByteBufferAsCharSequence((ByteBuffer)content.slice().limit(end));
        }
    }
    //</editor-fold>

    public static CharSequence asCharSequence(byte[] content) {
        return new ByteArrayAsCharSequence(content);
    }
    public static CharSequence asCharSequence(byte[] content, int offset, int length) {
        return new ByteArrayAsCharSequence(content, offset, length);
    }
    public static CharSequence asCharSequence(ByteBuffer content) {
        return new ByteBufferAsCharSequence(content);
    }
    public static boolean toBool(Object o) {
        if (o instanceof Boolean) {
            return ((Boolean)o).booleanValue();
        }
        if (o instanceof Number) {
            return ((Number)o).intValue() != 0;
        }
        return o != null;
    }
}
