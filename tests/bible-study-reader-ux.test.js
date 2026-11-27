const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
const bible=read('js/bible.js'),study=read('js/bible-study.js');
function classes(){const s=new Set();return{add(x){s.add(x)},remove(x){s.delete(x)},contains(x){return s.has(x)},toggle(x,on){if(on)s.add(x);else s.delete(x)}};}
const nodes=[1,2,3].map(v=>({dataset:{verse:String(v)},classList:classes(),setAttribute(){},insertAdjacentElement(where,menu){assert.equal(where,'afterend');menu.after=v;},scrollIntoView(){this.scrolled=true;}}));
const menu={classList:classes(),getBoundingClientRect:()=>({top:720})},label={},colors={classList:classes()};
const context={state:{book:{id:'JHN',name_pt:'João'},chapter:3,selection:null,selectionAnchor:null},window:{innerHeight:760},$:(id)=>({'bible-selection-menu':menu,'bible-selection-label':label,'bible-highlight-colors':colors}[id]),document:{querySelectorAll:selector=>selector.includes('.selected')?nodes.filter(n=>n.classList.contains('selected')):nodes,querySelector:s=>nodes.find(n=>s.includes('"'+n.dataset.verse+'"')),body:{appendChild(m){m.after=null;}}},makeReferenceLabel:(book,ch,start,end)=>book+' '+ch+':'+start+'-'+end};
vm.createContext(context);vm.runInContext(slice(bible,'  function selectVerse','  function selectionMatch'),context);
context.selectVerse(3);assert.equal(menu.after,3);assert.equal(menu.classList.contains('hidden'),false);assert.equal(nodes[2].scrolled,true);
context.selectVerse(1);assert.equal(menu.after,3);assert.equal(context.state.selection.verse_start,1);
context.clearSelection();assert.equal(menu.after,null);assert.equal(menu.classList.contains('hidden'),true);assert.equal(nodes.some(n=>n.classList.contains('selected')),false);
const els={};for(const id of ['bible-study-panel','bible-verses-content','study-verse-select','study-reference','study-translation','study-portuguese','study-word-dialog'])els[id]={classList:classes(),scrollIntoView(){},open:false};
const buttons=Object.fromEntries(['note','previous-verse','next-verse'].map(k=>[k,{}]));
const state={enabled:false,context:null,verse:1,tab:'comments',generation:0,wordRequest:0,catalogs:new Map()};
const c={book:{id:'JHN',name_pt:'João'},chapter:3,verses:[{verse:1,text:'a'},{verse:2,text:'b'}],translation:{short_name:'ACF'}};
let calls=0,focus=null;
const studyCtx={state,$:id=>els[id],window:{ADPELBible:{getContext:()=>c,clearSelection(){},focusReadingVerse:n=>{focus=n;}}},document:{querySelectorAll:()=>[],querySelector:s=>buttons[s.match(/"([^"]+)"/)[1]]},reference:(b,ch,v)=>b+' '+ch+':'+v,loadView:async()=>{calls++;}};
vm.createContext(studyCtx);vm.runInContext(slice(study,'  function availableVerses','  async function getSource'),studyCtx);
(async()=>{
 await studyCtx.openVerse(2);assert.equal(state.enabled,true);assert.equal(els['bible-verses-content'].classList.contains('study-reading-hidden'),true);assert.equal(els['study-portuguese'].textContent,'b');assert.equal(buttons['next-verse'].disabled,true);assert.equal(calls,1);
 state.tab='comments';await studyCtx.stepVerse(-1);assert.equal(state.verse,1);assert.equal(state.tab,'comments');assert.equal(buttons['previous-verse'].disabled,true);
 await studyCtx.setEnabled(false);assert.equal(focus,1);assert.equal(els['bible-verses-content'].classList.contains('study-reading-hidden'),false);
 assert.match(read('bible.css'),/\.bible-selection-panel\s*\{\s*position:static/);
 assert.match(read('bible-study.css'),/#bible-verses-content\.study-reading-hidden\s*\{display:none!important;\}/);
 for(const page of ['index.html','bible.html'])assert.match(read(page),/bible-study\.js\?v=2/);
 for(const action of ['highlight','note','bookmark','share','study','tutor'])assert.ok(bible.includes('data-bible-action="'+action+'"'));
 console.log('Bible selection layout and study navigation: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
