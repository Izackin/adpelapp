const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
const bible=read('js/bible.js');
function classes(){const s=new Set();return{add(x){s.add(x)},remove(x){s.delete(x)},contains(x){return s.has(x)},toggle(x,on){if(on)s.add(x);else s.delete(x)}};}
const nodes=[1,2,3].map(v=>({dataset:{verse:String(v)},classList:classes(),setAttribute(){},insertAdjacentElement(where,menu){assert.equal(where,'afterend');menu.after=v;},scrollIntoView(){this.scrolled=true;}}));
const menu={classList:classes(),getBoundingClientRect:()=>({top:720})},label={},colors={classList:classes()};
const context={state:{book:{id:'JHN',name_pt:'João'},chapter:3,selection:null,selectionAnchor:null},window:{innerHeight:760},$:(id)=>({'bible-selection-menu':menu,'bible-selection-label':label,'bible-highlight-colors':colors}[id]),document:{querySelectorAll:selector=>selector.includes('.selected')?nodes.filter(n=>n.classList.contains('selected')):nodes,querySelector:s=>nodes.find(n=>s.includes('"'+n.dataset.verse+'"')),body:{appendChild(m){m.after=null;}}},makeReferenceLabel:(book,ch,start,end)=>book+' '+ch+':'+start+'-'+end};
vm.createContext(context);vm.runInContext(slice(bible,'  function selectVerse','  function selectionMatch'),context);
context.selectVerse(3);assert.equal(menu.after,3);assert.equal(menu.classList.contains('hidden'),false);assert.equal(nodes[2].scrolled,true);
context.selectVerse(1);assert.equal(menu.after,3);assert.equal(context.state.selection.verse_start,1);
context.clearSelection();assert.equal(menu.after,null);assert.equal(menu.classList.contains('hidden'),true);assert.equal(nodes.some(n=>n.classList.contains('selected')),false);
assert.match(read('bible.css'),/\.bible-selection-panel\s*\{\s*position:static/);
for(const page of ['index.html','bible.html']){
 const html=read(page);
 assert.doesNotMatch(html,/js\/bible-study\.js|bible-study\.css/);
 assert.match(html,/js\/bible\.js\?v=bible-2\.4-reading/);
}
for(const action of ['highlight','note','bookmark','share'])assert.ok(bible.includes('data-bible-action="'+action+'"'));
for(const action of ['study','tutor'])assert.ok(!bible.includes('data-bible-action="'+action+'"'));
assert.doesNotMatch(bible,/ADPELBibleStudy|openTutorForSelection|adpel:bible-chapter/);
assert.doesNotMatch(read('admin.html'),/crud-bible-study/);
assert.doesNotMatch(read('admin.js'),/loadAdminBibleStudy|['"]bible-study['"]/);
assert.match(read('index.html'),/js\/tutor\.js/);
for(const p of ['js/bible-study.js','bible-study.css','admin/crud-bible-study.js'])assert.ok(!fs.existsSync(path.resolve(__dirname,'..',p)));
console.log('Bible reading-only selection and removal: PASS');
