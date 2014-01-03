/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java;

import java.nio.ByteBuffer;

/**
 *
 * @author Mingun
 * @param <R> Тип результата разбора.
 */
public interface IParser<R> {
    public R parse(CharSequence input);
    public R parse(CharSequence input, String startRule);

    public R parse(ByteBuffer input);
    public R parse(ByteBuffer input, String startRule);

    public R parse(byte[] input);
    public R parse(byte[] input, String startRule);
}
