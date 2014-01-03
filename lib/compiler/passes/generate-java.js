var utils = require("../../utils"),
    op    = require("../opcodes");

String.prototype.dup = function(count) { return new Array(count+1).join(this); };
Array.prototype.addAll = function(x, f) {
  if (typeof(f) !== 'undefined') {
    x = utils.map(x, f);
  }
  Array.prototype.push.apply(this, x);
  return this;
};

/* Generates parser Java code. */
module.exports = function(ast, options) {
  //{ Вспомогательные функции
  /** Делает отступы только для непустых строк, чтобы не генерировать бесполезные пробелы. */
  function indent(count) {
    var indent = '    '.dup(count);
    return function(code) { return code.replace(/^(.+)$/gm, indent+'$1'); };
  }
  var indent1 = indent(1);

  function arg(a) { return 'Object '+a; }
  function args(params) { return utils.map(params, arg).join(', '); }

  function getImports() {
    var result = {};
    for (var i = 0; i < arguments.length; ++i) {
      var fullName = arguments[i];
      var j = fullName.lastIndexOf('.');
      var name = fullName.substring(j+1);
      if (name !== '*') {
        result[name] = fullName;
      }
    }
    return result;
  }
  function getOptions(options) {
    options = utils.clone(options);
    utils.defaults(options, {
      className:'Parser',
      package:  '',
      useFullNames: true,
    });

    var className = options.className.split('.');
    var package = className.slice(0,-1).join('.');

    if (package !== '') {
      options.package = package;
    }
    options.className = className[className.length-1];

    options._imports = getImports(
      'java.lang.reflect.InvocationTargetException',
      'java.lang.reflect.Method',
      'java.util.ArrayList',
      'java.util.Arrays',
      'java.util.HashMap',
      'java.util.List',
      'java.util.Map',
      'java.util.regex.Pattern',
      'org.pegjs.java.AbstractParser',
      'org.pegjs.java.Error',
      'org.pegjs.java.annotations.Rule',
      'org.pegjs.java.annotations.Grammar',
      'org.pegjs.java.exceptions.PEGException'
    );
    return options;
  }
  function _(x) {
    var y = x;
    if (options.useFullNames)
      y = options._imports[x];
    if (!y) {
      throw new Error('Unknown import for '+x);
    }
    return y;
  }
  //}
  //{ Генераторы кода
  function generateTables() {
    function isNumber(s)  { return !isNaN(parseFloat(s)) && isFinite(s); }
    function isString(s)  { return (/^"/).test(s); }
    function isPattern(s) { return (/^\//).test(s); }
    function isArray(s)   { return (/^\[/).test(s); }
    function isNULL(s)    { return (/^null/).test(s); }
    function isUndefined(s)    { return (/^void 0/).test(s); }
    function isExpectedObject(s) { return (/^\{ type: .* \}/).test(s); }
    function correct(s)   { return s ? s.toString().replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1') : null; } // \x -> \u00
    function expected(s) {
      function q(s) {return s ? correct(utils.quote(s)) : 'null';}
      eval('s='+s);
      // Почему-то не работает. Просто s = eval(s) тоже падает с ошибкой.
      // s = JSON.parse(s);
      return 'new '+_('Error')+'('+q(s.type)+', '+q(s.value)+', '+q(s.description)+')';
    }
    function type(c) {
      if (isNumber(c))  return 'int';
      if (isString(c))  return 'String';
      if (isPattern(c)) return _('Pattern');
      if (isArray(c))   return _('ArrayList');
      if (isExpectedObject(c)) return _('Error');
      return 'Object';
    }
    function printConst(c, i) {
      return 'private static final '+type(c)+' peg$c' + i + ' = ' + 
             (isPattern(c) ? _('Pattern')+'.compile("'+correct(c.substring(1, c.length-1))+'")' :
             (isArray(c) ? 'new '+_('ArrayList')+'()' :
             (isNULL(c) ? 'null' :
             (isUndefined(c) ? 'null' :
             (isExpectedObject(c) ? expected(c) : correct(c))))))
        + ';';
    }
    return [
      '//<editor-fold defaultstate="collapsed" desc="Таблица констант парсера">'
    ].addAll(
      ast.consts, printConst
    ).concat([
      '//</editor-fold>',
      '',
      '//<editor-fold defaultstate="collapsed" desc="Таблица действий парсера">',
    ]).addAll(
      ast.actions,
      // a[0] - массив имен параметров функции.
      // a[1] - код тела функции.
      function(a, i) {return 'private Object peg$f'+i+'('+args(a[0])+') {'+a[1]+'}';}
    ).concat([
      '//</editor-fold>',
    ]);
  }
  //{ Кеширование результатов
  function generateCacheHeader(ruleIndexCode) {
    return [
      'final Integer key = this.peg$currPos * ' + ast.rules.length + ' + ' + ruleIndexCode + ';',
      'final CacheEntry cached = this.peg$cache.get(key);',
      '',
      'if (cached != null) {',
      '  this.peg$currPos = cached.nextPos;',
      '  return cached.result;',
      '}',
      ''
    ];
  }
  function generateCacheFooter(resultCode) {
    return [
      '// Кешируем результат разбора правила',
      'this.peg$cache.put(key, new CacheEntry(this.peg$currPos, ' + resultCode + ');'
    ];
  }
  //}
  function generateRuleFunction(rule) {
    var parts = [], code;

    function c(i) { return options.className+'.peg$c' + i; } // |consts[i]| of the abstract machine
    function f(i) { return 'peg$f' + i; } // |actions[i]| of the abstract machine
    function s(i) { return 's'     + i; } // |stack[i]| of the abstract machine

    var stack = {
      sp:    -1,
      maxSp: -1,

      push: function(exprCode) {
        var code = s(++this.sp) + ' = ' + exprCode + ';';

        if (this.sp > this.maxSp) { this.maxSp = this.sp; }

        return code;
      },

      pop: function() {
        var n, values;

        if (arguments.length === 0) {
          return s(this.sp--);
        } else {
          n = arguments[0];
          values = utils.map(utils.range(this.sp - n + 1, this.sp + 1), s);
          this.sp -= n;

          return values;
        }
      },

      top: function() {
        return s(this.sp);
      },

      index: function(i) {
        return s(this.sp - i);
      }
    };

    function compile(bc) {
      var ip    = 0,
          end   = bc.length,
          parts = [],
          value;

      function compileCondition(cond, argCount) {
        var baseLength = argCount + 3,
            thenLength = bc[ip + baseLength - 2],
            elseLength = bc[ip + baseLength - 1],
            baseSp     = stack.sp,
            thenCode, elseCode, thenSp, elseSp;

        ip += baseLength;
        thenCode = compile(bc.slice(ip, ip + thenLength));
        thenSp = stack.sp;
        ip += thenLength;

        if (elseLength > 0) {
          stack.sp = baseSp;
          elseCode = compile(bc.slice(ip, ip + elseLength));
          elseSp = stack.sp;
          ip += elseLength;

          if (thenSp !== elseSp) {
            throw new Error(
              "Branches of a condition must move the stack pointer in the same way."
            );
          }
        }

        parts.push('if (' + cond + ') {');
        parts.push(indent1(thenCode));
        if (elseLength > 0) {
          parts.push('} else {');
          parts.push(indent1(elseCode));
        }
        parts.push('}');
      }

      function compileLoop(cond) {
        var baseLength = 2,
            bodyLength = bc[ip + baseLength - 1],
            baseSp     = stack.sp,
            bodyCode, bodySp;

        ip += baseLength;
        bodyCode = compile(bc.slice(ip, ip + bodyLength));
        bodySp = stack.sp;
        ip += bodyLength;

        if (bodySp !== baseSp) {
          throw new Error("Body of a loop can't move the stack pointer.");
        }

        parts.push('while (' + cond + ') {');
        parts.push(indent1(bodyCode));
        parts.push('}');
      }

      function compileCall() {
        var baseLength   = 4,
            paramsLength = bc[ip + baseLength - 1];

        var value = f(bc[ip + 1]) + '('
              + utils.map(
                  bc.slice(ip + baseLength, ip + baseLength + paramsLength),
                  stackIndex
                ).join(', ')
              + ')';
        stack.pop(bc[ip + 2]);
        parts.push(stack.push(value));
        ip += baseLength + paramsLength;
      }

      /*
       * Extracted into a function just to silence JSHint complaining about
       * creating functions in a loop.
       */
      function stackIndex(p) {
        return stack.index(p);
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH:             // PUSH c
            /*
             * Hack: One of the constants can be an empty array. It needs to be
             * handled specially because it can be modified later on the stack
             * by |APPEND|.
             */
            parts.push(
              stack.push(ast.consts[bc[ip + 1]] === '[]' ? 'new '+_('ArrayList')+'()' : c(bc[ip + 1]))
            );
            ip += 2;
            break;

          case op.PUSH_CURR_POS:    // PUSH_CURR_POS
            parts.push(stack.push('this.peg$currPos'));
            ip++;
            break;

          case op.POP:              // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS:     // POP_CURR_POS
            parts.push('this.peg$currPos = ((Number)' + stack.pop() + ').intValue();');
            ip++;
            break;

          case op.POP_N:            // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP:              // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND:           // APPEND
            value = stack.pop();
            parts.push('(('+_('List')+')'+stack.top() + ').add(' + value + ');');
            ip++;
            break;

          case op.WRAP:             // WRAP n
            parts.push(
              stack.push(_('Arrays')+'.asList(' + stack.pop(bc[ip + 1]).join(', ') + ')')
            );
            ip += 2;
            break;

          case op.TEXT:             // TEXT
            stack.pop();
            parts.push(
              stack.push('this.input.subSequence(((Number)' + stack.top() + ').intValue(), this.peg$currPos)')
            );
            ip++;
            break;

          case op.IF:               // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR:         // IF_ERROR t, f
            compileCondition(stack.top() + ' == peg$FAILED', 0);
            break;

          case op.IF_NOT_ERROR:     // IF_NOT_ERROR t, f
            compileCondition(stack.top() + ' != peg$FAILED', 0);
            break;
          /*
          case op.IF_ARRLEN_MIN:    // IF_ARRLEN_MIN t f
            value = stack.pop();
            compileCondition(value+'!=null && (('+_('List')+')'+stack.top() + ').size() < ((Number)'+value+').intValue()', 0);
            break;

          case op.IF_ARRLEN_MAX:    // IF_ARRLEN_MAX t f
            value = stack.pop();
            compileCondition(value+'!=null && (('+_('List')+')'+stack.top() + ').size() >= ((Number)'+value+').intValue()', 0);
            break;*/

          case op.WHILE_NOT_ERROR:  // WHILE_NOT_ERROR b
            compileLoop(stack.top() + ' != peg$FAILED', 0);
            break;

          case op.MATCH_ANY:        // MATCH_ANY a, f, ...
            compileCondition('this.input.length() > this.peg$currPos', 0);
            break;

          case op.MATCH_STRING:     // MATCH_STRING s, a, f, ...
            value = eval(ast.consts[bc[ip + 1]]);
            compileCondition(
              value.length > 1
                ? 'this.test(' + c(bc[ip + 1]) + ')'
                : 'this.test((char)' + value.charCodeAt(0) + '/* '+ast.consts[bc[ip + 1]]+' */)',
              1
            );
            break;

          case op.MATCH_STRING_IC:  // MATCH_STRING_IC s, a, f, ...
            compileCondition(
              'this.testi('
                + eval(ast.consts[bc[ip + 1]]).length
                + ', '
                + c(bc[ip + 1])
                + ')',
              1
            );
            break;

          case op.MATCH_REGEXP:     // MATCH_REGEXP r, a, f, ...
            compileCondition(
              'this.test(' + c(bc[ip + 1]) + ')',
              1
            );
            break;

          case op.ACCEPT_N:         // ACCEPT_N n
            parts.push(stack.push(
              bc[ip + 1] > 1
                ? 'this.input.subSequence(this.peg$currPos, this.peg$currPos + ' + bc[ip + 1] + ')'
                : 'this.input.charAt(this.peg$currPos)'
            ));
            parts.push(
              bc[ip + 1] > 1
                ? 'this.peg$currPos += ' + bc[ip + 1] + ';'
                : '++this.peg$currPos;'
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:    // ACCEPT_STRING s
            parts.push(stack.push(c(bc[ip + 1])));
            value = eval(ast.consts[bc[ip + 1]]).length;
            parts.push(
              value > 1
                ? 'this.peg$currPos += ' + value + ';'
                : '++this.peg$currPos;'
            );
            ip += 2;
            break;

          case op.FAIL:             // FAIL e
            parts.push(stack.push('peg$FAILED'));
            parts.push('this.peg$mayBeFail(' + c(bc[ip + 1]) + ');');
            ip += 2;
            break;

          case op.REPORT_SAVED_POS: // REPORT_SAVED_POS p
            parts.push('this.peg$reportedPos = ((Number)' + stack.index(bc[ip + 1]) + ').intValue();');
            ip += 2;
            break;

          case op.REPORT_CURR_POS:  // REPORT_CURR_POS
            parts.push('this.peg$reportedPos = this.peg$currPos;');
            ip++;
            break;

          case op.CALL:             // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE:             // RULE r
            parts.push(stack.push('this.peg$parse' + ast.rules[bc[ip + 1]].name + '()'));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:  // SILENT_FAILS_ON
            parts.push('++this.peg$silentFails;');
            ip++;
            break;

          case op.SILENT_FAILS_OFF: // SILENT_FAILS_OFF
            parts.push('--this.peg$silentFails;');
            ip++;
            break;

          default:
            throw new Error("Invalid opcode: " + bc[ip] + ".");
        }
      }

      return parts.join('\n');
    }

    code = compile(rule.bytecode);

    parts.push(
      '@'+_('Rule'),
      '@SuppressWarnings("unused")',
      'private Object peg$parse' + rule.name + '() {',
      // '    System.out.println("Enter |'+rule.name+'|");',
      // Переменные стека.
      '    Object ' + utils.map(utils.range(0, stack.maxSp + 1), s).join(', ') + ';',
      ''
    );

    if (options.cache) {
      parts.addAll(
        generateCacheHeader(utils.indexOfRuleByName(ast, rule.name)),
        indent1
      );
    }

    parts.push(indent1(code));

    if (options.cache) {
      parts.addAll(generateCacheFooter(s(0)), indent1);
    }

    parts.push(
      '',
      // '    System.out.println("Leave |'+rule.name+'|="+'+s(0)+');',
      '    return ' + s(0) + ';',
      '}'
    );

    return parts;
  }
  //}
  options = getOptions(options);
  var parts = [];
  var startRuleFunctions = utils.map(
    options.allowedStartRules,
    function(r) { return '"peg$parse' + r+'"'; }
  );
  var startRuleFunction = 'peg$parse' + options.allowedStartRules[0];

  //{ Генерация заголовков
  if (options.package !== '') {
    parts.push(
    'package ' + options.package + ';',
    ''
    );
  }
  if (!options.useFullNames) {
    parts.addAll(utils.values(options._imports), function(i) {return 'import '+i+';'});
  }
  if (ast.initializer) {
    parts.push(
    '//<editor-fold defaultstate="collapsed" desc="Код инициализатора">',
    ast.initializer.code,
    '//</editor-fold>'
    );
  }
  //}

  //{ Генекрация костяка
  parts.push(
    '/**',
    ' * Generated by PEG.js 0.8.0.',
    ' *',
    ' * http://pegjs.majda.cz/',
    ' */',
    '@'+_('Grammar'),
    'public class ' + options.className + ' extends '+_('AbstractParser')+' {',
    ''
  );
  parts.addAll(generateTables(), indent1);
  parts.push('');

  if (options.cache) {
    parts.push(
    '    /**',
    '     * Кеш результатов разбора правил. Ключ содержит позицию, по которой',
    '     * расположен результат и место окончания разбора.',
    '     */',
    '    private final '+_('Map')+'<Integer, CacheEntry> peg$cache = new '+_('HashMap')+'<Integer, CacheEntry>();'
    );
  }
  parts.push(
    '    public ' + options.className + '() {',
    '        super(',
    '        //<editor-fold defaultstate="collapsed" desc="Список правил, с которых возможно начало разбора">'
  );
  parts.addAll(startRuleFunctions, indent(3));
  parts.push(
    '        //</editor-fold>',
    '        );',
    '    }',
    '    @Override',
    '    public Object parse(CharSequence input, String startRule) {'
  );
  if (options.cache) {
    parts.push(
    '        this.peg$cache.clear();'
    );
  }
  parts.push(
    '        return this.parse(input, startRule, "'+startRuleFunction+'");',
    '    }',
    '    //<editor-fold defaultstate="collapsed" desc="Вспомогательные функции">',
    '    // Объявляем в текущем классе, т.к. вызов private методов разбора правил,',
    '    // объявленных в данном классе, из AbstractParser невозможен.',
    '    @Override',
    '    protected final Object callRule(String ruleName) {',
    '        try {',
    '            final '+_('Method')+' m = this.getClass().getDeclaredMethod(ruleName, (Class[]) null);',
    '            if (!m.isAnnotationPresent('+_('Rule')+'.class)) {',
    '                throw new '+_('PEGException')+'(ruleName+" not rule name");',
    '            }',
    '            return m.invoke(this, (Object[]) null);',
    '        } catch (IllegalAccessException ex) {',
    '            throw new '+_('PEGException')+'(ex);',
    '        } catch (IllegalArgumentException ex) {',
    '            throw new '+_('PEGException')+'(ex);',
    '        } catch ('+_('InvocationTargetException')+' ex) {',
    '            throw new '+_('PEGException')+'(ex);',
    '        } catch (NoSuchMethodException ex) {',
    '            throw new '+_('PEGException')+'(ex);',
    '        } catch (SecurityException ex) {',
    '            throw new '+_('PEGException')+'(ex);',
    '        }',
    '    }',
    '    //</editor-fold>',
    '',
    '    //<editor-fold defaultstate="collapsed" desc="Функции разбора правил">'
  );
  utils.each(ast.rules, function(rule) {
    parts.addAll(generateRuleFunction(rule), indent1);
  });
  parts.push(
    '    //</editor-fold>',
    '}'
  );
  //}

  ast.code = parts.join('\n');
};
