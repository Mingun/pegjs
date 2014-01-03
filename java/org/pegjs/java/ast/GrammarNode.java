/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.ast;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Корневой узел грамматики. В каждой грамматике существует в единственном экземпляре
 * и является корневым. Содержит инициализатор и список правил.
 * @author Mingun
 */
public final class GrammarNode extends Node {
    /**
     * Код, добавляемый в файл класса до его объявления. Может использоваться для
     * добавление директив импорта классов и добавления дополнительных классов.
     */
    public final Code initializer;
    /** Список правил грамматики. */
    public final List<RuleNode> rules;
    /**
     * Таблица констант парсера. Константы - это литералы грамматики, названия
     * правил, регулярные выражения, описывающие классы символов. Все константы
     * уникальные.
     */
    public final List<String> consts = new ArrayList<String>();
    /** Таблица действий и семантических предикатов парсера. */
    public final List<Code> actions = new ArrayList<Code>();

    public GrammarNode(Code initializer, List<RuleNode> rules) {
        if (rules == null) {
            throw new IllegalArgumentException("'rules' must not be null");
        }
        this.initializer = initializer;
        this.rules = rules;
    }
    public GrammarNode(Object initializer, Object rules) {
        this("".equals(initializer) ? null : (Code)initializer, (List<RuleNode>)rules);
    }

    @Override
    public List<Node> childs() { return Collections.unmodifiableList((List)rules); }
    @Override
    public <R, Context> R visit(Visitor<R, Context> v, Context context) { v.visit(this, context); return null; }
    
    public int addConstError(String type, String value, String description) {
        return addConst("new org.pegjs.java.Error(\""+type+"\", "+value+", "+description+")");
    }
    public int addConst(String constant) {
        int i = consts.indexOf(constant);
        if (i < 0) {
            consts.add(constant);
            i = consts.size()-1;
        }
        return i;
    }
    public int addAction(Map<String, Integer> env, Code code) {
        code.params = env.keySet();
        int i = actions.indexOf(code);
        if (i < 0) {
            actions.add(code);
            i = actions.size()-1;
        }
        return i;
    }

    public int indexOfRuleByName(String name) {
        int i = 0;
        for (RuleNode rule : rules) {
            if (rule.name.equals(name)) return i;
            ++i;
        }
        return -1;
    }
    /** Обходит все правила в грамматике и генерирует для них байткод. */
    public void compile() {
        visit(new GenerateVisitor(), null);
    }
}
