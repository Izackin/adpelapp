const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
function extract(p,a,b){const s=read(p),i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);}
function element(){return {value:'',textContent:'',innerHTML:'',children:[],classList:{add(){},remove(){},toggle(){}},replaceChildren(...items){this.children=items;},appendChild(item){this.children.push(item);},setAttribute(){}};}
(async()=>{
 let owner='u1',calls=0,visible=[];
 const els={};const doc={getElementById:id=>els[id]||(els[id]=element()),createElement:()=>element()};
 const ctx={document:doc,getCurrentUserInfo:()=>({isLoggedIn:true,user:{id:owner}}),ADPEL:{fetch:{courses(){calls++;return Promise.resolve([{id:'1',title:'Teologia Bíblica',category:'Formação',is_published:true,lesson_count:3},{id:'2',title:'Música',is_published:true,is_paid:true,lesson_count:4},{id:'3',title:'Oculto',is_published:false}]);}}},getAllLessonProgress:()=>Promise.resolve([{course_id:'1',lesson_index:0}]),paidCoursesAccessMap:()=>Promise.resolve({}),paidRenderCoursesList:rows=>{visible=rows;},console:{error(){}}};
 vm.createContext(ctx);vm.runInContext(extract('js/paid-courses.js','var paidCatalog =','function paidCourseCarouselCard('),ctx);
 await ctx.paidLoadCoursesData();assert.equal(visible.length,2);assert.equal(visible[0].status,'in-progress');assert.equal(visible[1].status,'locked');assert.equal(visible[1].hasAccess,false);
 doc.getElementById('course-catalog-search').value='biblica';ctx.filterCourseCatalog();assert.equal(visible.length,1);assert.equal(visible[0].id,'1');
 doc.getElementById('course-catalog-search').value='';doc.getElementById('course-catalog-filter').value='not-started';ctx.filterCourseCatalog();assert.equal(visible[0].id,'2');assert.equal(calls,1);
 let books=[],libraryCalls=0;
 const lib={document:doc,getCurrentUserInfo:ctx.getCurrentUserInfo,bookUrls:{},ADPEL:{fetch:{library(){libraryCalls++;return Promise.resolve([{title:'Oração',author:'João',category:'Devocionais',is_published:true},{title:'História',category:'História',is_published:true},{title:'Privado',is_published:false}]);}}},renderBooksGrid:rows=>{books=rows;},console:{error(){}}};
 vm.createContext(lib);vm.runInContext(extract('js/library.js','let libraryCatalog =','function renderFeaturedBooks'),lib);await lib.loadLibraryData();assert.equal(books.length,2);assert.equal(doc.getElementById('library-category').children.length,3);
 doc.getElementById('library-search').value='joao';lib.filterLibraryCatalog();assert.equal(books.length,1);assert.equal(books[0].title,'Oração');
 doc.getElementById('library-search').value='';doc.getElementById('library-category').value='historia';lib.filterLibraryCatalog();assert.equal(books[0].title,'História');assert.equal(libraryCalls,1);
 let panel=element(),oldPanel=panel,journeyPanel,summaryPanel,headerRenders=0;
 const profile={currentProfileTab:'summary',currentProfileUserInfo:{isLoggedIn:true,user:{id:'u1'}},getCurrentUserInfo:()=>({isLoggedIn:true,user:{id:'u1'}}),document:{getElementById:()=>panel,createElement(){const node=element();node.replaceWith=newNode=>{panel=newNode;};return node;},querySelectorAll:()=>[]},renderProfile(){headerRenders++;},renderProfileJourneyTab:node=>{journeyPanel=node;},renderProfileSummaryTab:node=>{summaryPanel=node;},escapeHtml:String};
 panel.replaceWith=node=>{panel=node;};vm.createContext(profile);vm.runInContext(extract('js/profile.js','function profileTabButton','function renderProfileSummaryTab'),profile);profile.setProfileTab('journey');profile.setProfileTab('summary');assert.ok(journeyPanel!==summaryPanel);assert.ok(oldPanel!==summaryPanel);journeyPanel.innerHTML='old';assert.equal(summaryPanel.innerHTML,'');assert.equal(headerRenders,0);
 console.log('internal interface: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
