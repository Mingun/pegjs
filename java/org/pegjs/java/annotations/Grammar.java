/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Данной аннотацией помечаются классы, реализующие парсеры грамматик, генерируемой
 * данной библиотекой.
 * @author Mingun
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Grammar {
    /**
     * Список правил, с которых можно начинать разбор. Первое правило в этом списке
     * является правилом по умолчанию. Данный список всегда имеет хотя бы один элемент.
     * @return 
     */
    //String[] startRules();
    /**
     * Исходный код грамматики, по которому был сгенерирован данный парсер. Если
     * пусто, то исходный код грамматики недоступен.
     * @return 
     */
    //String source() default "";
}
