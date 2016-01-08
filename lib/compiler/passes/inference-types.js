"use strict";

var GrammarError = require("../../grammar-error"),
    asts         = require("../asts"),
    visitor      = require("../visitor");

/* Выводит типы всех узлов грамматики на основе типов action-узлов? размеченных аннотациями. */
function inferenceTypes(ast) {
  var primitives = {
    'boolean': 'java.lang.Boolean',
    'char': 'java.lang.Character',
    'void': 'java.lang.Void',

    'byte': 'java.lang.Byte',
    'short': 'java.lang.Short',
    'int': 'java.lang.Integer',
    'long': 'java.lang.Long',

    'float': 'java.lang.Float',
    'double': 'java.lang.Double',
  };
  function boxed(type) {
    var boxed = primitives[type];
    return boxed ? boxed : type;
  }
  var types = {
    /// Тип для возвращаемого значения из семантических предикатов
    bool: 'boolean',
    /// Тип одиночного символа входного потока
    unit: 'char',
    /// Тип диапазона символов входного потока
    range: 'java.lang.CharSequence',

    /// Тип-объединение всех переданных типов
    enum: function(types) { return 'java.lang.Object'; },
    /// Тип для массива возвращаемых значений указанного типа
    list: function(type) { return 'java.util.List<' + boxed(type) + '>'; },
    /// Тип для множества возвращаемых типов, упакованных в один
    tuple: function(types) { return 'java.lang.Object[]'; },
    /// Тип для представления опционального значения
    option: function(type) { return boxed(type); },
    /// Уникальный фантомный тип для узла. Используется для возможности описания
    /// рекурсивных типов. На вход передается узел описания правила (type='rule')
    self: function(node) { return '?' + node.name; },
  };

  function none()  { return types.bool; }
  function unit()  { return types.unit; }
  function range() { return types.range; }
  function list(node) { return types.list(inference(node.expression)); }

  var initTypes = visitor.build({
    action: function(node) {
      var a = asts.findAnnotation(node, 'Return');
      if (!a || a.params.length < 1) {
        throw new GrammarError("Cann't inference type for action result: missing @Return(type) annotation", node.location);
      }
      node.returnType = a.params[0];
      initTypes(node.expression);
    },
  });

  var inference = visitor.build({
    rule:         function(node) {
      if (!node.returnType) {
        // Так как тип правила может оказаться рекурсивным, то мы вначале присваеваем ему
        // фантомный тип, а затем выводим тип правила, который может оказаться зависим сам от себя
        node.returnType = types.self(node);
        node.returnType = inference(node.expression);
      }
      return node.returnType
    },
    choice:       function(node) {
      return types.enum(node.alternatives.map(function(n) { return inference(n); }));
    },
    action:       function(node) {
      if (node.returnType) {
        return node.returnType;
      }
      throw new GrammarError("Action result type not defined", node.location);
    },
    sequence:     function(node) {
      return types.tuple(node.elements.map(function(n) { return inference(n); }));
    },
    text:         range,
    simple_and:   none,
    simple_not:   none,
    optional:     function(node) { return types.option(inference(node.expression)); },
    zero_or_more: list,
    one_or_more:  list,
    range:        list,
    semantic_and: none,
    semantic_not: none,
    rule_ref:     function(node) { return inference(asts.findRule(ast, node.name)); },
    literal:      range,
    "class":      unit,
    any:          unit,
  });

  initTypes(ast);
  inference(ast);
}

module.exports = inferenceTypes;
