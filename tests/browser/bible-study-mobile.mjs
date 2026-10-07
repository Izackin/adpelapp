// Optional browser check. Requires Playwright; starts a local app server by default.
// ADPEL_PLAYWRIGHT_MODULE may point to an installed Playwright package.
// ADPEL_BROWSER_EXECUTABLE may point to a separately installed Chromium binary.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.ADPEL_PLAYWRIGHT_MODULE||'playwright');
let base=process.env.ADPEL_TEST_URL;
let server;
if(!base){
  const root=resolve(new URL('../..',import.meta.url).pathname);
  server=createServer(async(req,res)=>{
    try{
      const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2'};
      res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(await fs.readFile(path));
    }catch(_){res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base='http://127.0.0.1:'+server.address().port;
}
const output=process.env.ADPEL_TEST_SCREENSHOTS;
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/bible-study.json',import.meta.url),'utf8'));
const proxyUrl=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const browser=await chromium.launch({proxy:proxyUrl?{server:new URL(proxyUrl).origin,bypass:'127.0.0.1,localhost'}:undefined,headless:true,executablePath:process.env.ADPEL_BROWSER_EXECUTABLE||undefined,args:process.env.ADPEL_BROWSER_EXECUTABLE?['--no-sandbox','--disable-dev-shm-usage','--no-zygote']:[]});
try {
  for(const width of [320,390,768,1280]){
    const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(process.env.ADPEL_TEST_DEBUG){page.on('requestfailed',r=>console.log('NETWORK',r.url(),r.failure()?.errorText));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});}
    await page.route('**/*',async route=>{
      const url=route.request().url();
      if(url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js')&&process.env.ADPEL_TEST_SUPABASE_UMD)return route.fulfill({contentType:'text/javascript',body:await fs.readFile(process.env.ADPEL_TEST_SUPABASE_UMD)});
      if(url.includes('cdn.tailwindcss.com')&&process.env.ADPEL_TEST_TAILWIND)return route.fulfill({contentType:'text/javascript',body:await fs.readFile(process.env.ADPEL_TEST_TAILWIND)});
      if(!process.env.ADPEL_TEST_LIVE&&new URL(url).hostname==='piqlrjzlepcpqootpyvq.supabase.co'){
        const query=new URL(url),table=query.pathname.split('/').at(-1),joined=query.searchParams.get('select')?.includes('!inner');
        let rows=joined?fixture.occurrences:[...(fixture[table]||[])];
        if(!joined)for(const [field,filter] of query.searchParams){
          if(filter.startsWith('eq.'))rows=rows.filter(row=>String(row[field])===filter.slice(3));
          if(filter.startsWith('in.(')){const values=filter.slice(4,-1).split(',');rows=rows.filter(row=>values.includes(String(row[field])));}
        }
        const or=query.searchParams.get('or');
        if(or){const refs=[...or.matchAll(/book_id\.eq\.([A-Z0-9]+),chapter\.eq\.(\d+),verse\.eq\.(\d+)/g)].map(m=>`${m[1]}:${m[2]}:${m[3]}`);rows=rows.filter(row=>refs.includes(`${row.book_id}:${row.chapter}:${row.verse}`));}
        const offset=Number(query.searchParams.get('offset')||0),limit=Number(query.searchParams.get('limit')||rows.length),count=joined?fixture.occurrence_count:rows.length;
        rows=rows.slice(offset,offset+limit);
        const single=route.request().headers().accept?.includes('vnd.pgrst.object');
        return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':`${offset}-${offset+rows.length-1}/${count}`},body:JSON.stringify(single?rows[0]||null:rows)});
      }
      if(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url))return route.abort();
      return route.continue();
    });
    const surface=process.env.ADPEL_TEST_PAGE||'bible.html';
    await page.goto(base+'/'+surface,{waitUntil:'domcontentloaded'});
    if(surface==='index.html'){
      await page.waitForFunction(()=>typeof window.navigateTo==='function'&&window.ADPELBible?.getContext().book);
      await page.evaluate(async()=>{window.navigateTo('bible');await window.abrirBiblia();});
    }
    await page.getByRole('button',{name:'Capítulo 1',exact:true}).waitFor();
    await page.locator('#bible-current-book').filter({hasText:'Gênesis'}).waitFor();
    await page.locator('.bible-verse[data-verse="1"]').waitFor();
    await page.getByRole('button',{name:'Estudo',exact:true}).click();
    await page.getByRole('heading',{name:'Leia no contexto',exact:true}).waitFor();
    assert.equal(await page.locator('.study-token').count(),0,'Passage comes before original-word requests');
    assert.match(await page.locator('.study-context-verse.is-current').innerText(),/No princípio/);
    assert.equal(await page.locator('#bible-verses-content').isVisible(),false,'No duplicate chapter in Study');
    assert.equal(await page.locator('#bible-current-book').isVisible(),false,'No duplicate chapter heading in Study');
    assert.equal(await page.locator('#study-chapter-select').isVisible(),true);
    assert.equal(await page.locator('#bible-translation-select').isVisible(),false);
    await page.getByRole('button',{name:'Opções de leitura',exact:true}).click();
    assert.equal(await page.locator('#bible-translation-select').isVisible(),true);
    await page.getByRole('button',{name:'Aumentar fonte',exact:true}).click();
    assert.equal(await page.locator('.study-context-verse.is-current').evaluate(el=>getComputedStyle(el).fontSize),'20px');
    await page.getByRole('button',{name:'Diminuir fonte',exact:true}).click();
    await page.getByRole('button',{name:'Opções de leitura',exact:true}).click();
    await page.getByRole('button',{name:'Próximo versículo',exact:true}).click();
    assert.equal(await page.locator('#study-reference').innerText(),'Gênesis 1:2');
    await page.getByRole('button',{name:'Versículo anterior',exact:true}).click();
    assert.equal(await page.locator('#study-reference').innerText(),'Gênesis 1:1');
    if(output){await fs.mkdir(output,{recursive:true});await page.locator('#bible-study-panel').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/passagem-'+width+'.png'});}
    await page.getByRole('button',{name:'Palavras',exact:true}).click();
    await page.getByRole('button',{name:'Estudar אֱלֹהִ֑ים',exact:true}).waitFor({timeout:30000});
    await page.evaluate(()=>document.fonts.load('27px "ADPEL Hebrew"','אֱלֹהִ֑ים'));
    assert(await page.evaluate(()=>document.fonts.check('27px "ADPEL Hebrew"','אֱלֹהִ֑ים')),'Bundled font covers Hebrew pointing and accents');
    assert.equal(await page.locator('.study-original-sentence .study-token').count(),7);
    assert(await page.locator('.study-token').evaluateAll(words=>words.every(word=>{const r=word.getBoundingClientRect();return r.width>=44&&r.height>=44;})),'Original words have 44px touch targets');
    await page.getByRole('button',{name:'Estudar אֱלֹהִ֑ים',exact:true}).click();
    await page.getByText('Significados possíveis',{exact:true}).waitFor();
    assert.match(await page.locator('.study-word-context').innerText(),/No princípio criou Deus/);
    assert.equal(await page.locator('summary').filter({hasText:'Gramática e identificação'}).locator('..').getAttribute('open'),null);
    const quote=await page.locator('.study-word-context').boundingBox(),meaning=await page.locator('.study-meaning').boundingBox();
    assert(quote.y<meaning.y,'Verse appears before lexical meanings');
    const dialogWidth=await page.locator('#study-word-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth);
    assert(dialogWidth,'No horizontal overflow in word dialog');
    if(output)await page.screenshot({path:output+'/palavra-'+width+'.png'});
    await page.getByRole('button',{name:'Próxima →',exact:true}).click();
    await page.getByText('Palavra 4 de 7',{exact:true}).waitFor();
    await page.getByRole('button',{name:'← Anterior',exact:true}).click();
    await page.getByText('Palavra 3 de 7',{exact:true}).waitFor();
    if(width===390){
      await page.getByRole('button',{name:'Ver em outras passagens',exact:true}).click();
      await page.locator('#study-occurrences h4').waitFor();
      assert.equal(await page.locator('.study-occurrence-list button').count(),10);
      assert.match(await page.locator('.study-occurrence-list').innerText(),/No princípio/);
      await page.locator('#study-occurrences').getByRole('button',{name:'Próxima',exact:true}).click();
      await page.locator('.study-pagination').getByText(/^2 de /).waitFor();
    }
    await page.getByRole('button',{name:'Fechar estudo da palavra',exact:true}).click();
    if(width===390){
      await page.getByRole('button',{name:'Passagem',exact:true}).click();
      await page.getByRole('button',{name:'Estudar versículo 3',exact:true}).click();
      assert.equal(await page.locator('#study-reference').innerText(),'Gênesis 1:3');
      await page.getByRole('button',{name:'Comentários',exact:true}).click();
      await page.getByText('Ainda não há comentário publicado para este versículo.',{exact:false}).waitFor();
      await page.getByRole('button',{name:'Referências',exact:true}).click();
      await page.getByText('Nenhuma referência cruzada cadastrada para este versículo.',{exact:true}).waitFor();
      await page.locator('#bible-book-select').selectOption('JHN');
      await page.locator('#study-reference').filter({hasText:'João 1:1'}).waitFor();
      assert.equal(await page.locator('#study-chapter-select option').count(),21);
      await page.getByRole('button',{name:'Palavras',exact:true}).click();
      await page.locator('.study-token').nth(16).waitFor();
      assert.equal(await page.locator('#study-content .study-original-sentence').getAttribute('dir'),'ltr');
      await page.locator('.study-token').first().click();
      await page.getByText('Significados possíveis',{exact:true}).waitFor();
      assert.match(await page.locator('.study-word-context').innerText(),/No princípio era o Verbo/);
      await page.getByRole('button',{name:'Fechar estudo da palavra',exact:true}).click();
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
    await page.getByRole('button',{name:'Leitura',exact:true}).click();
    assert.equal(await page.locator('#bible-verses-content').isVisible(),true);
    assert.equal(await page.locator('#bible-chapter-selector').isVisible(),true);
    assert.equal(await page.locator('#bible-translation-select').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS mobile study flow at '+width+'px');
    await context.close();
  }
} finally { await browser.close(); if(server)await new Promise(r=>server.close(r)); }
