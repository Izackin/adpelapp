const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../js/navigation.js'),'utf8');
const elements={};
for(const id of ['home','word','learn','community-hub','more','courses','profile','bible']){let hidden=id!=='home';elements[id]={classList:{add(){hidden=true;},remove(){hidden=false;},contains(){return hidden;}}};}
let session=null,homeLoads=0,courseLoads=0,modal=0,active='home',scrolls=0;
const window={innerWidth:800,location:{hash:''},history:{pushState(_,__,hash){window.location.hash=hash;}},scrollTo(){scrolls++;},ADPELAppShell:{contextForSection:x=>x,setActive:x=>{active=x;}}};
const ctx={window,document:{getElementById:id=>elements[id]||null},getCurrentUserInfo:()=>session?{isLoggedIn:true,user:{id:session}}:{isLoggedIn:false},openModal(){modal++;},loadHomeData(){homeLoads++;},loadCoursesData(){courseLoads++;},console:{log(){}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
window.navigateTo('unknown');assert.equal(elements.home.classList.contains('hidden'),false);
window.navigateTo('courses');assert.equal(modal,1);assert.equal(active,'home');assert.equal(courseLoads,0);
window.navigateTo('community-hub');assert.equal(homeLoads,1);assert.equal(active,'community-hub');
window.location.hash='';window.handleNavigationHash();assert.equal(active,'home');assert.equal(homeLoads,2);
session='u1';window.navigateTo('courses');assert.equal(courseLoads,1);
session='u2';window.navigateTo('courses');assert.equal(courseLoads,2);
assert.equal(elements.courses.classList.contains('hidden'),false);
console.log('navigation state: PASS');
