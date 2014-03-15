/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.pegjs.java.generator;

import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.net.URI;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.tools.FileObject;
import javax.tools.ForwardingJavaFileManager;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileManager;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;
import org.pegjs.java.IParser;
import org.pegjs.java.ast.GrammarNode;
import org.pegjs.java.exceptions.GenerateParserError;

/**
 * Генератор парсера по грамматике. Может {@link #build  генерировать} как готовый
 * к использованию класс, так и только {@link #generate байткод} класса для дальнейшей
 * загрузки другим {@link ClassLoader}-ом.
 * <p>
 * В случае генерации готового класса класс будет загружен классом генератора.
 * <p>
 * Парсер может быть сгенерирован как из текстового описания грамматики, так
 * и из заранее созданного {@link GrammarNode AST-а} грамматики.
 * @author Mingun
 */
public final class ParserGenerator extends ClassLoader {
    private static final String AutoClassNamePrefix = "org.pegjs.java.generated.Parser";

    //<editor-fold defaultstate="collapsed" desc="Публичный интерфейс">
    //<editor-fold defaultstate="collapsed" desc="Не рекомендуемые к использованию методы">
    /**
     * Генерирует и загружает класс с автоматически сгенерированным именем для
     * разбора указанной грамматики. Класс генерируется в пакете {@code org.pegjs.java.generated}
     * и имеет имя вида {@code Parser<16-значный UUID>}.
     * @param <R> Тип результата, возвращаемого генерируемым парсером.
     * @param grammar Описание грамматики (см. <a href="https://github.com/Mingun/pegjs/tree/master#grammar-syntax-and-semantics">синтаксис</a>).
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     * @deprecated Используйте этот метод только для быстрого тестирования. Во избежание
     *             коллизий, сами назначайте имена генерируемым классам.
     * @see #generate(java.lang.CharSequence, java.lang.String).
     */
    @Deprecated
    public <R> IParser<R> build(CharSequence grammar) {
        return build(grammar, autoClassName());
    }
    /**
     * Генерирует и загружает класс с автоматически сгенерированным именем для
     * разбора указанной грамматики. Класс генерируется в пакете {@code org.pegjs.java.generated}
     * и имеет имя вида {@code Parser<16-значный UUID>}.
     * @param <R> Тип результата, возвращаемого генерируемым парсером.
     * @param ast Дерево грамматики.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     * @deprecated Используйте этот метод только для быстрого тестирования. Во избежание
     *             коллизий, сами назначайте имена генерируемым классам.
     * @see #generate(java.lang.CharSequence, java.lang.String).
     */
    @Deprecated
    public <R> IParser<R> build(GrammarNode ast) {
        return build(ast, autoClassName());
    }
    /**
     * Генерирует и загружает класс с указанным именем, унаследованный от переданного
     * класса, для разбора указанной грамматики. Класс генерируется в пакете {@code org.pegjs.java.generated}
     * и имеет имя вида {@code Parser<16-значный UUID>}.
     * @param <P> Тип возвращаемого парсера. Этот тип является наследником указанного
     *        в параметрах класса и реализует интерфейс {@link IParser}.
     * @param <R> Тип возвращаемого сгенерированным парсером значения.
     * @param grammar Описание грамматики (см. <a href="https://github.com/Mingun/pegjs/tree/master#grammar-syntax-and-semantics">синтаксис</a>).
     * @param base Базовый класс для генерируемого парсера. Как правило, содержит
     *        дополнительные переменные, описывающие состояние парсера, а также
     *        содержит реализацию действий и предикатов, которые будут выполняться
     *        во время разбора.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     * @deprecated Используйте этот метод только для быстрого тестирования. Во избежание
     *             коллизий, сами назначайте имена генерируемым классам.
     */
    @Deprecated
    public <P extends IParser<? extends R>, R> P build(CharSequence grammar, Class<? super P> base) {
        return build(grammar, autoClassName(), base);
    }
    /**
     * Генерирует и загружает класс с указанным именем, унаследованный от переданного
     * класса, для разбора указанной грамматики. Класс генерируется в пакете {@code org.pegjs.java.generated}
     * и имеет имя вида {@code Parser<16-значный UUID>}.
     * @param <P> Тип возвращаемого парсера. Этот тип является наследником указанного
     *        в параметрах класса и реализует интерфейс {@link IParser}.
     * @param <R> Тип возвращаемого сгенерированным парсером значения.
     * @param ast Дерево грамматики.
     * @param base Базовый класс для генерируемого парсера. Как правило, содержит
     *        дополнительные переменные, описывающие состояние парсера, а также
     *        содержит реализацию действий и предикатов, которые будут выполняться
     *        во время разбора.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     * @deprecated Используйте этот метод только для быстрого тестирования. Во избежание
     *             коллизий, сами назначайте имена генерируемым классам.
     */
    @Deprecated
    public <P extends IParser<? extends R>, R> P build(GrammarNode ast, Class<? super P> base) {
        return build(ast, autoClassName(), base);
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Генерация класса парсера">
    /**
     * Генерирует и загружает класс с указанным именем для разбора указанной грамматики.
     * @param <R> Тип результата, возвращаемого генерируемым парсером.
     * @param grammar Описание грамматики (см. <a href="https://github.com/Mingun/pegjs/tree/master#grammar-syntax-and-semantics">синтаксис</a>).
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     */
    public <R> IParser<R> build(CharSequence grammar, String className) {
        final byte[] byteCode = generate(grammar, className);
        try {
            return (IParser<R>)defineClass(className, byteCode, 0, byteCode.length).newInstance();
        } catch (InstantiationException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        } catch (IllegalAccessException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        }
    }
    /**
     * Генерирует и загружает класс с указанным именем для разбора указанной грамматики.
     * @param <R> Тип результата, возвращаемого генерируемым парсером.
     * @param ast Дерево грамматики.
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     */
    public <R> IParser<R> build(GrammarNode ast, String className) {
        final byte[] byteCode = generate(ast, className);
        try {
            return (IParser<R>)defineClass(className, byteCode, 0, byteCode.length).newInstance();
        } catch (InstantiationException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        } catch (IllegalAccessException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        }
    }
    /**
     * Генерирует и загружает класс с указанным именем, унаследованный от переданного
     * класса, для разбора указанной грамматики.
     * @param <P> Тип возвращаемого парсера. Этот тип является наследником указанного
     *        в параметрах класса и реализует интерфейс {@link IParser}.
     * @param <R> Тип возвращаемого сгенерированным парсером значения.
     * @param grammar Описание грамматики (см. <a href="https://github.com/Mingun/pegjs/tree/master#grammar-syntax-and-semantics">синтаксис</a>).
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @param base Базовый класс для генерируемого парсера. Как правило, содержит
     *        дополнительные переменные, описывающие состояние парсера, а также
     *        содержит реализацию действий и предикатов, которые будут выполняться
     *        во время разбора.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     */
    public <P extends IParser<? extends R>, R> P build(CharSequence grammar, String className, Class<? super P> base) {
        final byte[] byteCode = generate(grammar, className, base);
        try {
            return (P)defineClass(className, byteCode, 0, byteCode.length).newInstance();
        } catch (InstantiationException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        } catch (IllegalAccessException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        }
    }
    /**
     * Генерирует и загружает класс с указанным именем, унаследованный от переданного
     * класса, для разбора указанной грамматики.
     * @param <P> Тип возвращаемого парсера. Этот тип является наследником указанного
     *        в параметрах класса и реализует интерфейс {@link IParser}.
     * @param <R> Тип возвращаемого сгенерированным парсером значения.
     * @param ast Дерево грамматики.
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @param base Базовый класс для генерируемого парсера. Как правило, содержит
     *        дополнительные переменные, описывающие состояние парсера, а также
     *        содержит реализацию действий и предикатов, которые будут выполняться
     *        во время разбора.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     */
    public <P extends IParser<? extends R>, R> P build(GrammarNode ast, String className, Class<? super P> base) {
        final byte[] byteCode = generate(ast, className, base);
        try {
            return (P)defineClass(className, byteCode, 0, byteCode.length).newInstance();
        } catch (InstantiationException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        } catch (IllegalAccessException ex) {
            // Невозможно - у парсера есть публичный конструктор без аргументов
            throw (InternalError)new InternalError().initCause(ex);
        }
    }
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="Генерация байт-кода класса парсера">
    /**
     * Разбирает указанную грамматику и генерирует байткод парсера для ее разбора.
     * @param grammar Описание грамматики (см. <a href="https://github.com/Mingun/pegjs/tree/master#grammar-syntax-and-semantics">синтаксис</a>).
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @return Java-байткод класса, реализующего разбор грамматики.
     * @see #generate(org.pegjs.java.ast.GrammarNode, java.lang.String) 
     */
    public static byte[] generate(CharSequence grammar, String className) {
        final Parser p = new Parser();
        final GrammarNode ast = (GrammarNode)p.parse(grammar);
        return generate(ast, className);
    }
    /**
     * Генерирует байткод класса парсера с указанным именем, для разбора указанной грамматики.
     * @param ast Описание грамматики, для которой генерируется парсер.
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @return Java-байткод класса, реализующего разбор грамматики.
     * @see #generate(java.lang.CharSequence, java.lang.String)
     */
    public static byte[] generate(GrammarNode ast, String className) {
        // Генерируем байт-код правил.
        ast.compile();
        // Преобразуем байткод правил в байт-код Java.
        // Для этого генерируем исходник класса и компилируем его. Лучше было бы,
        // конечно, генерировать класс сразу в байткоде, но действия нам все равно
        // придется компилировать, т.к. в них содержится Java-код.
        final StringBuilder sb = new StringBuilder();
        final SourceCodeGenerator c = new SourceCodeGenerator();

        for (CharSequence line : c.generate(ast, className)) {
            sb.append(line).append('\n');
        }
        try {
            new FileOutputStream("source.java").write(sb.toString().getBytes("UTF-8"));
        } catch (IOException ex){}
        final JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();

        final JavaFileObject src = new MemorySource(className, sb);
        final MemoryFileManager fm = new MemoryFileManager(compiler);
        final StringWriter errors = new StringWriter();
        final JavaCompiler.CompilationTask task = compiler.getTask(
            errors, fm,
            null,
            Arrays.asList("-Xlint:unchecked"),// Опции компиляции.
            null,// Список классов-обработчиков аннотаций.
            Arrays.asList(src)// Список исходных файлов.
        );
        if (!task.call()) {
            throw new GenerateParserError("Cann't compile generated class:\n"+errors);
        }
        return fm.classData(className);
    }
    /**
     * Разбирает указанную грамматику и генерирует байткод парсера для ее разбора
     * унаследованный от переданного класса.
     * @param grammar Описание грамматики (см. <a href="https://github.com/Mingun/pegjs/tree/master#grammar-syntax-and-semantics">синтаксис</a>).
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @param base Базовый класс для генерируемого парсера. Как правило, содержит
     *        дополнительные переменные, описывающие состояние парсера, а также
     *        содержит реализацию действий и предикатов, которые будут выполняться
     *        во время разбора.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     */
    public static byte[] generate(CharSequence grammar, String className, Class<?> base) {
        final Parser p = new Parser();
        final GrammarNode ast = (GrammarNode)p.parse(grammar);
        return generate(ast, className, base);
    }
    /**
     * Генерирует байткод класса парсера с указанным именем, унаследованный от 
     * переданного класса, для разбора указанной грамматики.
     * @param ast Дерево грамматики.
     * @param className Полностью квалифицированное имя генерируемого класса,
     *        реализующего разбор грамматики, например, {@code org.pegjs.java.generator.Parser}.
     * @param base Базовый класс для генерируемого парсера. Как правило, содержит
     *        дополнительные переменные, описывающие состояние парсера, а также
     *        содержит реализацию действий и предикатов, которые будут выполняться
     *        во время разбора.
     * @return Класс парсера, загруженный {@linkplain ParserGenerator}-ом.
     */
    public static byte[] generate(GrammarNode ast, String className, Class<?> base) {
        throw new UnsupportedOperationException("Not yet implemented");
    }
    //</editor-fold>
    //</editor-fold>
    private static String autoClassName() {
        return AutoClassNamePrefix + UUID.randomUUID().toString().replace("-", "");
    }
}

final class MemorySource extends SimpleJavaFileObject {
    private final CharSequence source;
    MemorySource(String name, CharSequence code) {
        super(URI.create("memory:///" +name.replace('.', '/') + Kind.SOURCE.extension), Kind.SOURCE);
        this.source = code;
    }

    @Override
    public CharSequence getCharContent(boolean ignoreEncodingErrors) {
        return source;
    }
}
final class MemoryOutput extends SimpleJavaFileObject {
    private final ByteArrayOutputStream os = new ByteArrayOutputStream();
    MemoryOutput(String className, Kind kind) {
        super(URI.create("memory:///" + className.replace('.', '/') + kind.extension), kind);
    }
    public byte[] toByteArray() {
        return os.toByteArray();
    }
    @Override
    public ByteArrayOutputStream openOutputStream() {
        return os;
    }
}
/** Класс, хранящий результат компиляции Java-файлов в памяти и отдающий его по требованию. */
final class MemoryFileManager extends ForwardingJavaFileManager {
    /** Отображение полного имени класса на его скомпилированное содержимое в памяти. */
    private final Map<String, MemoryOutput> results = new HashMap<String, MemoryOutput>();

    MemoryFileManager(JavaCompiler compiler) {
        super(compiler.getStandardFileManager(null, null, null));
    }

    @Override
    public MemoryOutput getJavaFileForOutput(JavaFileManager.Location location, String className, JavaFileObject.Kind kind, FileObject source) {
        final MemoryOutput mc = new MemoryOutput(className, kind);
        results.put(className, mc);
        return mc;
    }
    public byte[] classData(String className) {
        return results.get(className).toByteArray();
    }
}