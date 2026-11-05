const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=process.env.PYODIDE_DIR||path.resolve(__dirname,'../../turtle/pyodide');
const {loadPyodide}=require(path.join(dir,'pyodide.js'));
(async()=>{
const py=await loadPyodide({indexURL:dir+path.sep}),bundle=JSON.parse(fs.readFileSync(path.join(__dirname,'pyflakes-bundle.json')));
const root='/home/pyodide/kodik_tools';py.FS.mkdirTree(root+'/pyflakes');for(const [p,s] of Object.entries(bundle.files))py.FS.writeFile(root+'/pyflakes/'+p,s);
py.FS.writeFile(root+'/python_diagnostics.py',fs.readFileSync(path.join(__dirname,'python-diagnostics.py'),'utf8'));
const received=[];globalThis.kodikReportDiagnostic=value=>received.push(JSON.parse(value));
py.runPython(`import sys, importlib.util\nsys.path.insert(0, '${root}')\nimport python_diagnostics as _kd\nsys.modules['_kodik_diagnostics'] = _kd`);
const filename='/home/pyodide/kodik-lessons/main.py';
const check=(code,lint=true)=>{py.runPython('_kd.register({'+JSON.stringify(filename)+':'+JSON.stringify(code)+'})');return JSON.parse(py.runPython('_kd.check_json('+JSON.stringify(code)+','+JSON.stringify(filename)+','+(lint?'True':'False')+')'))};
const syntax=[
['if True\n    print(1)',1,'двокрапка'],['if True:\n    pass\nelif False\n    pass',3,'двокрапка'],['if True:\n    pass\nelse\n    pass',3,'двокрапка'],
['for i in range(3)\n    pass',1,'двокрапка'],['while False\n    pass',1,'двокрапка'],['def f()\n    pass',1,'двокрапка'],['class A\n    pass',1,'двокрапка'],['try\n    pass',1,'двокрапка'],['try:\n    pass\nexcept ValueError\n    pass',3,'двокрапка'],['try:\n    pass\nfinally\n    pass',3,'двокрапка'],['with open("x") as f\n    pass',1,'двокрапка'],
['print(1',1,'Незакрита дужка'],['x = [1,\n 2',1,'Незакрита дужка'],['x = {"a":1',1,'Незакрита дужка'],['print(1))',1,'Зайва'],['x = [1, 2)',1,'різного типу'],
['print("привіт)',1,'Незакриті лапки'],["x = 'text",1,'Незакриті лапки'],['x = """text\ntext',1,'багаторядковий'],['x = f"{1"',1,'f-рядку'],['print(“привіт”)',1,'символ'],
['if True:\nprint(1)',2,'відступу'],['    print(1)',1,'Зайвий відступ'],['if True:\n    print(1)\n  print(2)',3,'Відступ'],['if True:\n\tprint(1)\n        print(2)',3,'табуляції'],
['for i range(3):\n    pass',1,'Пропущено in'],['If True:\n    pass',1,'регістр'],['if True:\n    pass\nelse if False:\n    pass',3,'elif'],['if True && False:\n    pass',1,'and'],['if True || False:\n    pass',1,'or'],['if 1 =< 2:\n    pass',1,'порівняння'],['if 2 => 1:\n    pass',1,'порівняння'],['if 1 <> 2:\n    pass',1,'порівняння'],['class = 1',1,'змінної'],['print(1 2)',1,'кома'],['if x = 3:\n    pass',1,'порівняння'],['print "hello"',1,'дужок'],['x = 07',1,'нуль'],['2name = 1',1,'числа'],
['return 3',1,'блоком'],['break',1,'блоком'],['continue',1,'блоком'],['def f(a,a):\n    pass',1,'параметр'],['def f(a=1,b):\n    pass',1,'Порядок'],['print(a=1,2)',1,'Порядок'],['3 = x',1,'присвоювання'],['try:\n    pass\nprint(1)',3,'try']
];
for(const [code,line,hint] of syntax){const result=check(code,false);assert.equal(result.length,1,code);assert.equal(result[0].line,line,code);assert((result[0].title+' '+result[0].hint).includes(hint),code+' -> '+JSON.stringify(result));assert.equal(result[0].severity,'error');assert(result[0].column>=1);assert.equal(result[0].source,code)}
assert(check('if True\\n    pass',false)[0].hint.includes('заголовка if'));
const lint=[['pritn("hi")','UndefinedName','print'],['x=0\ndef f():\n    print(x)\n    x = 2','UndefinedLocal',''],['x = {"a":1,"a":2}','MultiValueRepeatedKeyLiteral',''],['if (False, True):\n    pass','IfTuple',''],['x=1\nif x is 1:\n    pass','IsLiteral',''],['print(f"hello")','FStringMissingPlaceholders',''],['"{} {}".format(1)','StringDotFormatMissingArgument','']];
for(const [code,type,hint] of lint){const result=check(code);assert(result.some(d=>d.type===type),code+' -> '+JSON.stringify(result));if(hint)assert(result.some(d=>d.hint.includes(hint)))}
for(const code of ['print("# текст: [ ( { ")','# "незакрита лапка в коментарі\nprint("ok")','x = """текст\n( [ {\n"""','from robot import *\nforward()','raise RuntimeError("must not execute")','print("Привіт 👋")','x = "it\\\'s fine"'])assert.equal(check(code).filter(d=>d.severity==='error').length,0,code);
const runtime=[
['x=2\nprint(pritn)',2,'NameError'],['x=3\ny=0\nprint(x/y)',3,'ZeroDivisionError'],['x=[]\nprint(x[0])',2,'IndexError'],['x={}\nprint(x["a"])',2,'KeyError'],['import missing_kodik_module',1,'ModuleNotFoundError'],
['from math import does_not_exist',1,'ImportError'],['x=1\nx.append(2)',2,'AttributeError'],['print("1"+1)',1,'TypeError'],['x=int("abc")',1,'ValueError'],['open("missing-file.txt")',1,'FileNotFoundError'],['assert False',1,'AssertionError'],
['def f():\n    return 1/0\nf()',2,'ZeroDivisionError'],['def f():\n    f()\nf()',2,'RecursionError'],['def f():\n    print(x)\n    x=2\nf()',2,'UnboundLocalError'],['print("💡"); unknown',1,'NameError']
];
for(const [code,line,type] of runtime){check(code,false);received.length=0;const output=py.runPython('_kd.execute_simple('+JSON.stringify(code)+','+JSON.stringify(filename)+')');assert(received.length,output);const d=received.at(-1);assert.equal(d.line,line,code);assert.equal(d.type,type,code);assert(output.includes('main.py:'+line));assert(d.hint);assert.equal(d.source,code);if(code.includes('💡'))assert.equal(d.column,Array.from(code.slice(0,code.indexOf('unknown'))).length+1)}
// Imported files retain their own filename/line, and checks have no side effects.
py.FS.mkdirTree('/home/pyodide/kodik-project');py.FS.writeFile('/home/pyodide/kodik-project/helper.py','def bad():\n    return 1/0\n');
py.runPython('sys.path.insert(0,"/home/pyodide/kodik-project")');check('from helper import bad\nbad()',false);received.length=0;py.runPython('_kd.execute_simple("from helper import bad\\nbad()",'+JSON.stringify(filename)+')');assert.equal(received.at(-1).file,'helper.py');assert.equal(received.at(-1).line,2);
py.FS.writeFile('/home/pyodide/kodik-project/broken.py','if True\n    pass');received.length=0;py.runPython('_kd.execute_simple("import broken",'+JSON.stringify(filename)+')');assert.equal(received.at(-1).file,'broken.py');assert.equal(received.at(-1).line,1);
py.runPython('_kd.register({},"en")');const english=JSON.parse(py.runPython('_kd.check_json("if True\\n    pass",'+JSON.stringify(filename)+')'));assert(english[0].title.includes('colon'));
console.log(`PASS: ${syntax.length} syntax cases, ${lint.length} Pyflakes cases, ${runtime.length} runtime cases, valid strings/comments, imported-file locations, Unicode columns, English and no-execution checks`);
})().catch(e=>{console.error(e);process.exitCode=1});
