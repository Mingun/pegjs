/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.pegjs.java.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Данной аннотацией помечаются методы, которые осуществляют разбор правил.
 * @author Mingun
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Rule {
    /**
     * Определяет, возможно ли с этого правила начать разбор грамматики.
     * @return 
     */
    //public boolean isStart();
    //public boolean isCashable();
    public String title() default "";
}
