const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2] || require('node:path').join(__dirname, 'app-ed0a328a.js'), 'utf8');
const start = source.indexOf('const esc=s=>');
const end = source.indexOf(';const update=()=>', start);
const paint = vm.runInNewContext(source.slice(start, end) + ';paint');
const span = (kind, text) => '<span class="syntax-' + kind + '">' + text + '</span>';
const cases = [
['# Спробуй змінити цей код', span('comment', '# Спробуй змінити цей код')],
['# class print(123) & < >', span('comment', '# class print(123) &amp; &lt; &gt;')],
['print("# це рядок") # коментар', span('builtin','print')+'('+span('string','"# це рядок"')+') '+span('comment','# коментар')],
["x = 'class=\"syntax-comment\"> # 123'", 'x = '+span('string', "'class=\"syntax-comment\"&gt; # 123'")],
['for i in range(3):', span('keyword','for')+' i '+span('keyword','in')+' '+span('builtin','range')+'('+span('number','3')+'):'],
['print("say \\"hi\\" #")', span('builtin','print')+'('+span('string','"say \\"hi\\" #"')+')'],
["'unfinished # class", span('string',"'unfinished # class")],
['if x < 10 and y > 2:', span('keyword','if')+' x &lt; '+span('number','10')+' '+span('keyword','and')+' y &gt; '+span('number','2')+':'],
['call_me()', span('function','call_me')+'()'],
['', ' ']
];
for (const [code, expected] of cases) assert.equal(paint(code), expected, code);
for(const [code] of cases.filter(([code]) => code)){
const restored=paint(code).replace(/<\/?span(?: class="syntax-[a-z]+")?>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
assert.equal(restored,code,'Highlighting must preserve source text');
}
assert(!source.includes('const c=t.code.replace'), 'No recurring source cleanup');
assert(!source.includes('const c=e.value.replace'), 'No recurring editor cleanup');
console.log('Passed: 10 highlighting cases, source preservation, no destructive cleanup timers.');
