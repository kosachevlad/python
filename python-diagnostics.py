"""Local Python diagnostics: CPython compiler/traceback + Pyflakes 3.4.0.

No user code is executed by check(). No code is sent to a server.
Positions in the public result are 1-based Unicode character columns.
"""
import ast
import builtins
import contextlib
import difflib
import io
import json
import linecache
import os
import re
import traceback
import warnings

_sources = {}
_run_sources = {}
_executed = {}
_language = 'uk'
PROJECT = '/home/pyodide/kodik-project/'
LESSONS = '/home/pyodide/kodik-lessons/'


def tr(uk, en):
    return en if _language == 'en' else uk


def register(sources, language='uk', for_run=True):
    global _sources, _run_sources, _executed, _language
    _language = language
    _sources = dict(sources)
    if for_run:
        _run_sources = dict(sources)
        _executed = {}
    for path, code in _sources.items():
        linecache.cache[path] = (len(code), None, code.splitlines(True), path)


def _source(path):
    if path in _sources:
        return _sources[path]
    if path.startswith(PROJECT):
        try:
            with open(path, encoding='utf-8') as f:
                return f.read()
        except (OSError, UnicodeError):
            pass
    return ''


def _column(text, byte):
    return len(text.encode('utf-8')[:max(0, byte)].decode('utf-8', errors='ignore')) + 1


def _item(path, line, column, end, kind, title, hint, details='', severity='error', source_override=None):
    source = _source(path) if source_override is None else source_override
    lines = source.splitlines()
    line = max(1, line or 1)
    text = lines[line - 1] if line <= len(lines) else ''
    column = max(1, min(column or 1, len(text) + 1))
    end = max(column + 1, min(end or column + 1, len(text) + 2))
    return dict(path=path, file=path.removeprefix(PROJECT).removeprefix(LESSONS),
                line=line, column=column, endColumn=end, type=kind, title=title,
                hint=hint, details=details, severity=severity, text=text, source=source)


def _syntax(error):
    path = error.filename or '<string>'
    message = error.msg
    title = tr('Помилка синтаксису', 'Syntax error')
    hint = tr('Перевір написання команди, розділові знаки та попередній рядок. Python указує місце, де не зміг розібрати код.',
              'Check the statement, punctuation and previous line. Python points to where parsing failed.')
    if isinstance(error, TabError):
        title = tr('Змішані табуляції та пробіли', 'Mixed tabs and spaces')
        hint = tr('Використовуй пробіли для всіх відступів у блоці, наприклад по 4 пробіли на рівень.', 'Use spaces consistently, for example four spaces per indentation level.')
    elif 'expected an indented block' in message:
        title = tr('Немає відступу всередині блоку', 'Missing indented block')
        hint = tr('Після рядка з двокрапкою додай команду з відступом. Якщо блок поки порожній, напиши з відступом pass.', 'Indent a statement after the colon. Use an indented pass for an intentionally empty block.')
    elif 'unexpected indent' in message:
        title = tr('Зайвий відступ', 'Unexpected indentation')
        hint = tr('Прибери зайві пробіли на початку цього рядка або перевір, чи попередній рядок відкриває блок двокрапкою.', 'Remove the extra indentation or check that the preceding statement opens a block with a colon.')
    elif 'unindent does not match' in message:
        title = tr('Відступ не збігається з блоком', 'Inconsistent indentation')
        hint = tr('Вирівняй цей рядок із початком відповідного блоку. Не змішуй табуляції й пробіли.', 'Align this line with the matching block. Do not mix tabs and spaces.')
    elif "expected ':'" in message:
        title = tr('Пропущена двокрапка :', 'Missing colon :')
        hint = tr('Додай : після заголовка if, elif, else, for, while, def, class, try, except, finally, with, match або case.', 'Add : after the block header (if, elif, else, for, while, def, class, try, except, finally, with, match or case).')
    elif 'was never closed' in message:
        bracket = re.search(r"['\"]([([{])['\"]", message)
        opening = bracket.group(1) if bracket else '('
        closing = {'(':')', '[':']', '{':'}'}[opening]
        title = tr('Незакрита дужка ' + opening, 'Unclosed bracket ' + opening)
        hint = tr('Знайди пару для ' + opening + ' у цьому рядку та додай ' + closing + ' після відповідного виразу. Перевір і наступні рядки.', 'Match the opening ' + opening + ' on this line with ' + closing + ' after the corresponding expression; check subsequent lines too.')
    elif 'does not match opening' in message:
        title = tr('Дужки різного типу', 'Mismatched brackets')
        hint = tr('Узгодь пари дужок: ( ), [ ], { }. Замінити потрібно неправильну закривальну дужку, а не довільно додати ще одну.', 'Match bracket pairs: ( ), [ ], { }. Replace the mismatched closing bracket.')
    elif 'unmatched' in message:
        title = tr('Зайва закривальна дужка', 'Unmatched closing bracket')
        hint = tr('Прибери зайву закривальну дужку або додай відповідну відкривальну перед виразом.', 'Remove the extra closing bracket or add its matching opening bracket before the expression.')
    elif 'unterminated triple-quoted' in message:
        title = tr('Незакритий багаторядковий текст', 'Unterminated multiline string')
        hint = tr('Закрий текст тією самою трійкою лапок, якою його відкрито: три одинарні або три подвійні лапки.', 'Close the string with the same three single or double quotes that opened it.')
    elif 'unterminated string' in message:
        title = tr('Незакриті лапки', 'Unterminated string')
        hint = tr('Додай таку саму лапку в кінці тексту. Лапку всередині тексту екрануй через \\ або використай інший тип лапок.', 'Close the string with the same quote. Escape an inner quote with \\ or use the other quote type.')
    elif 'f-string' in message:
        title = tr('Помилка у f-рядку', 'Invalid f-string')
        hint = tr('Перевір пари { } навколо виразів та лапки. Для звичайної фігурної дужки у f-рядку напиши {{ або }}.', 'Check expression braces { } and quotes. Use {{ or }} for literal braces in an f-string.')
    elif 'invalid character' in message or 'invalid non-printable' in message:
        title = tr('Недопустимий символ', 'Invalid character')
        hint = tr('Перенабери позначений символ. У командах використовуй звичайні лапки " або \', а не « », “ ” чи типографські апострофи; перевір також невидимі пробіли.', 'Retype the marked character. Use plain ASCII quotes in code and check for invisible spaces.')
    elif 'Perhaps you forgot a comma' in message:
        title = tr('Можливо, пропущена кома', 'Possible missing comma')
        hint = tr('Перевір, чи розділені аргументи функції або елементи списку комами.', 'Check that function arguments or collection items are separated by commas.')
    elif "meant '=='" in message or 'instead of' in message and "'='" in message:
        title = tr('Присвоювання замість порівняння', 'Assignment instead of comparison')
        hint = tr('Умова на рівність використовує ==. Один знак = призначений для присвоювання значення змінній.', 'Use == for an equality test. A single = assigns a value.')
    elif 'Missing parentheses in call' in message:
        title = tr('Виклик функції без дужок', 'Missing call parentheses')
        hint = tr('У Python 3 використовуй дужки: наприклад print("Привіт").', 'Use parentheses in Python 3, for example print("Hello").')
    elif 'leading zeros' in message:
        title = tr('Зайвий нуль на початку числа', 'Leading zero in a number')
        hint = tr('Запиши десяткове число без початкового нуля: 7 замість 07. Для тексту з нулем використовуй лапки.', 'Write decimal numbers without leading zeros: 7 instead of 07. Quote text that must retain the zero.')
    elif 'invalid decimal' in message:
        title = tr('Неправильний запис числа або імені', 'Invalid number or name')
        hint = tr('Ім’я змінної не може починатися з цифри. Між числом і змінною постав оператор, якщо це обчислення.', 'A variable name cannot start with a digit. Add an operator between a number and a name if you intend a calculation.')
    elif 'outside' in message or 'not properly in loop' in message:
        title = tr('Команда поза потрібним блоком', 'Statement outside its required block')
        hint = tr('return і yield використовують усередині функції; break і continue — усередині циклу. Перевір відступи.', 'Use return/yield inside a function and break/continue inside a loop. Check indentation.')
    elif 'duplicate argument' in message:
        title = tr('Повторюється параметр функції', 'Duplicate function parameter')
        hint = tr('Кожен параметр у def повинен мати окреме ім’я.', 'Give every parameter in def a unique name.')
    elif 'non-default argument follows default' in message or 'parameter without a default follows' in message:
        title = tr('Порядок параметрів функції', 'Invalid parameter order')
        hint = tr('Параметри без значення за замовчуванням постав перед параметрами зі значенням.', 'Put required parameters before parameters with default values.')
    elif 'positional argument follows keyword' in message:
        title = tr('Порядок аргументів виклику', 'Invalid argument order')
        hint = tr('Спочатку передай звичайні аргументи, потім іменовані: function(1, name=2).', 'Put positional arguments before keyword arguments: function(1, name=2).')
    elif 'cannot assign' in message:
        title = tr('Некоректне місце присвоювання', 'Invalid assignment target')
        hint = tr('Ліворуч від = має бути змінна, елемент колекції або інше допустиме місце збереження, а не число чи виклик функції.', 'Assign to a variable or another valid target, not a literal or a function call.')
    elif "expected 'except' or 'finally'" in message:
        title = tr('Незавершений try', 'Incomplete try statement')
        hint = tr('Після блоку try додай except або finally з відповідними відступами.', 'Add an except or finally block after try with matching indentation.')
    return _item(path, error.lineno, error.offset, error.end_offset,
                 type(error).__name__, title, hint, message)


def _static(code, path):
    from pyflakes.checker import Checker
    messages = Checker(ast.parse(code, filename=path), filename=path).messages
    result = []
    names = set(dir(builtins)) | {node.id for node in ast.walk(ast.parse(code)) if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store)}
    for message in sorted(messages, key=lambda m: (m.lineno, m.col)):
        kind = type(message).__name__
        args = message.message_args
        name = str(args[0]) if isinstance(args, tuple) and args else str(args)
        title = hint = None
        if kind == 'UndefinedName':
            title = tr('Невідоме ім’я: ', 'Undefined name: ') + name
            hint = tr('Перевір написання, регістр літер або створи цю змінну / імпортуй функцію перед використанням.', 'Check spelling/case, define the variable or import the function before use.')
            similar = difflib.get_close_matches(name, sorted(names - {name}), n=1, cutoff=0.75)
            if similar:
                hint += tr(' Можливо, малося на увазі ', ' Did you mean ') + similar[0] + '?'
        elif kind == 'UndefinedLocal':
            title = tr('Локальна змінна ще не має значення', 'Local variable used before assignment')
            hint = tr('Присвой змінній значення у функції до використання; перевір усі гілки if та область видимості.', 'Assign the local variable before use; check all branches and scope.')
        elif kind in ('MultiValueRepeatedKeyLiteral', 'MultiValueRepeatedKeyVariable'):
            title = tr('Повторюється ключ словника', 'Repeated dictionary key')
            hint = tr('Зміни або прибери повторний ключ: нове значення перезапише попереднє.', 'Change or remove the repeated key; the later value overwrites the earlier one.')
        elif kind in ('IfTuple', 'AssertTuple'):
            title = tr('Умова завжди істинна', 'Condition is always true')
            hint = tr('Непорожній кортеж завжди має значення True. Перевір зайву кому в умові.', 'A non-empty tuple is always truthy. Check for an accidental comma.')
        elif kind == 'IsLiteral':
            title = tr('is замість порівняння значень', 'is used to compare literal values')
            hint = tr('Для порівняння значень використовуй == або !=. is перевіряє, чи це той самий об’єкт.', 'Compare values with == or !=. is checks object identity.')
        elif kind == 'FStringMissingPlaceholders':
            title = tr('f-рядок не містить {виразів}', 'f-string has no placeholders')
            hint = tr('Якщо потрібно підставити змінну, помісти її всередину { }. Інакше префікс f можна прибрати.', 'Wrap interpolated expressions in { }, or remove the unnecessary f prefix.')
        elif kind.startswith(('StringDotFormat', 'PercentFormat')):
            title = tr('Перевір форматування тексту', 'Check string formatting')
            hint = tr('Узгодь поля підстановки та передані аргументи. Технічні деталі нижче вказують, яких значень бракує або які зайві.', 'Match placeholders with the supplied values. See the technical detail for missing or extra arguments.')
        elif kind == 'RaiseNotImplemented':
            title = tr('Використай NotImplementedError', 'Use NotImplementedError')
            hint = tr('Напиши raise NotImplementedError, а не raise NotImplemented.', 'Write raise NotImplementedError, not raise NotImplemented.')
        # Style/unused warnings and star imports are intentionally not treated as errors.
        if title:
            line = code.splitlines()[message.lineno - 1]
            column = _column(line, message.col)
            result.append(_item(path, message.lineno, column, column + max(1, len(name)), kind,
                                title, hint, message.message % message.message_args, 'warning'))
    return result


def check(code, path, lint=True):
    _sources[path] = code
    linecache.cache[path] = (len(code), None, code.splitlines(True), path)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', SyntaxWarning)
            compile(code, path, 'exec')
    except SyntaxError as error:
        return [_syntax(error)]
    return _static(code, path) if lint else []


def check_json(code, path, lint=True):
    return json.dumps(check(code, path, lint), ensure_ascii=False)


def describe(error):
    if isinstance(error, SyntaxError):
        return _syntax(error)
    frames = traceback.extract_tb(error.__traceback__)
    user_frames = [f for f in frames if f.filename in _sources or f.filename.startswith(PROJECT)]
    frame = user_frames[-1] if user_frames else None
    if frame is None:
        return dict(path='', file='', line=None, column=None, endColumn=None, text='', source='',
                    type=type(error).__name__, title=tr('Помилка виконання', 'Runtime error'),
                    hint=tr('Python не надав рядок учнівського коду. Перевір технічні деталі.', 'No user-code location was provided. See the technical detail.'),
                    details=str(error), severity='error')
    title = tr('Помилка виконання', 'Runtime error')
    hint = tr('Перевір значення та операцію в позначеному рядку.', 'Check the values and operation on the indicated line.')
    if isinstance(error, UnboundLocalError):
        title = tr('Локальна змінна ще не має значення', 'Local variable has no value yet')
        hint = tr('Присвой змінній значення до читання у функції. Перевір гілки if та потребу в global/nonlocal.', 'Assign the variable before reading it; check branches and global/nonlocal scope.')
    elif isinstance(error, NameError):
        name = getattr(error, 'name', None) or str(error)
        title = tr('Невідоме ім’я: ', 'Undefined name: ') + str(name)
        hint = tr('Перевір написання та регістр. Спочатку створи змінну або імпортуй потрібну функцію.', 'Check spelling and case. Define the variable or import the function first.')
        tb = error.__traceback__
        while tb and tb.tb_next:
            tb = tb.tb_next
        if tb:
            options = set(tb.tb_frame.f_locals) | set(tb.tb_frame.f_globals) | set(dir(builtins))
            close = difflib.get_close_matches(str(name), sorted(options), n=1, cutoff=0.75)
            if close:
                hint += tr(' Можливо, малося на увазі ', ' Did you mean ') + close[0] + '?'
    elif isinstance(error, ZeroDivisionError):
        title = tr('Ділення на нуль', 'Division by zero')
        hint = tr('Перевір дільник перед /, // або %. Він не повинен дорівнювати 0.', 'Check the divisor before /, // or %. It must not be zero.')
    elif isinstance(error, IndexError):
        title = tr('Індекс поза межами колекції', 'Index out of range')
        hint = tr('Для колекції з n елементів невід’ємні індекси — від 0 до n-1. Перевір довжину через len().', 'For n items, non-negative indexes range from 0 to n-1. Check len().')
    elif isinstance(error, KeyError):
        title = tr('Ключа немає у словнику', 'Dictionary key not found')
        hint = tr('Перевір ключ, зокрема тип та регістр літер. За потреби використовуй key in dictionary або dictionary.get(key).', 'Check the key, its type and case. Consider key in dictionary or dictionary.get(key).')
    elif isinstance(error, ModuleNotFoundError):
        title = tr('Модуль не знайдено', 'Module not found')
        hint = tr('Перевір назву після import і наявність файла модуля в проєкті. Не кожна настільна бібліотека доступна у вебсередовищі.', 'Check the import name and project module file. Not every desktop library is available in the web runtime.')
    elif isinstance(error, ImportError):
        title = tr('Не вдалося імпортувати ім’я', 'Import failed')
        hint = tr('Перевір назву після from/import, її наявність у модулі та можливий циклічний імпорт.', 'Check the imported name, the module contents and possible circular imports.')
    elif isinstance(error, AttributeError):
        title = tr('Об’єкт не має такої властивості або методу', 'Attribute or method not found')
        hint = tr('Перевір написання методу та тип об’єкта. Якщо це наш tkinter/turtle, можливість також може бути ще не реалізована.', 'Check the attribute spelling and object type. A classroom tkinter/turtle feature may also be unsupported.')
    elif isinstance(error, TypeError):
        title = tr('Несумісні типи або аргументи', 'Incompatible types or arguments')
        hint = tr('Перевір типи значень і кількість аргументів. input() повертає текст: для обчислень використай int() або float(), для тексту — str().', 'Check value types and argument count. input() returns text: use int()/float() for numbers or str() for text.')
        message = str(error)
        if 'not callable' in message:
            hint = tr('Дужки ( ) викликають функцію. Для елемента списку використовуй [ ]; перевір, чи не замінив ти ім’я функції звичайним значенням.', 'Parentheses call a function. Use [ ] for indexing and check whether a function name was overwritten by a value.')
        elif 'required positional argument' in message or 'positional arguments but' in message or 'unexpected keyword' in message:
            hint = tr('Узгодь аргументи виклику з параметрами def: кількість, порядок та імена.', 'Match call arguments to the function definition: count, order and names.')
    elif isinstance(error, ValueError):
        title = tr('Неприпустиме значення', 'Invalid value')
        hint = tr('Тип значення підходить, але його вміст — ні. Перевір введення перед int()/float(), а також кількість значень при розпакуванні.', 'The value has an unsuitable content. Check int()/float() input and the number of values in unpacking.')
    elif isinstance(error, FileNotFoundError):
        title = tr('Файл не знайдено', 'File not found')
        hint = tr('Перевір шлях і регістр назви та додай файл у дерево Міні-IDE. Використовується віртуальна файлова система проєкту.', 'Check the path and case and add the file to the Mini-IDE project tree. Files are in the project virtual filesystem.')
    elif isinstance(error, RecursionError):
        title = tr('Забагато рекурсивних викликів', 'Recursion limit reached')
        hint = tr('Додай або виправ умову завершення рекурсії; кожен виклик має наближати її до завершення.', 'Add or correct the base case and ensure recursive calls make progress toward it.')
    elif isinstance(error, AssertionError):
        title = tr('Перевірка assert не пройшла', 'Assertion failed')
        hint = tr('Умова після assert має значення False. Перевір очікуване й фактичне значення.', 'The assert condition is false. Compare the expected and actual values.')
    original_source = _run_sources.get(frame.filename, _source(frame.filename))
    lines = original_source.splitlines()
    text = lines[frame.lineno - 1] if frame.lineno <= len(lines) else ''
    column = _column(text, frame.colno or 0)
    end = _column(text, frame.end_colno) if frame.end_colno is not None else column + 1
    executed_lines = _executed.get(frame.filename, '').splitlines()
    if executed_lines and frame.lineno <= len(executed_lines) and executed_lines[frame.lineno - 1] != text:
        column, end = 1, len(text) + 1
    return _item(frame.filename, frame.lineno, column, end, type(error).__name__, title, hint, str(error), source_override=original_source)


def format_diagnostic(item):
    location = (item['file'] + ':' + str(item['line'])) if item['line'] else item.get('file', '')
    parts = ['❌ ' + location + ' — ' + item['title'], item['hint']]
    if item.get('text'):
        parts += [item['text'], ' ' * (item['column'] - 1) + '^' * max(1, min(60, item['endColumn'] - item['column']))]
    parts += [tr('Деталі: ', 'Details: ') + item['type'] + ': ' + item['details']]
    return '\n'.join(parts)


def report_exception(error):
    item = describe(error)
    try:
        from js import kodikReportDiagnostic
        kodikReportDiagnostic(json.dumps(item, ensure_ascii=False))
    except (ImportError, AttributeError):
        pass
    return format_diagnostic(item)


def execute_simple(code, path):
    _executed[path] = code
    output = io.StringIO()
    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
        try:
            exec(compile(code, path, 'exec'), {'__name__':'__main__', '__file__':path})
        except SystemExit as error:
            if error.code not in (None, 0):
                print(report_exception(error))
        except Exception as error:
            print(report_exception(error))
    return output.getvalue()
