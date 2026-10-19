// Optional browser regression suite. See docs/textured-miniatures.md. Uses mocked storage only.
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.cwd()+'/package.json');
const {build}=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const postcss=require('postcss');
const tailwind=require('@tailwindcss/postcss');
const dir=process.env.MINIATURE_BROWSER_OUTPUT || '/tmp/miniature-browser';
await fs.mkdir(dir,{recursive:true});
await build({entryPoints:['tests/miniature-browser-harness.tsx'],bundle:true,outfile:dir+'/app.js',platform:'browser',format:'iife',define:{'process.env':'{}','process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"http://127.0.0.1:4173"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"test-public-key"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process('@import "tailwindcss";',{from:process.cwd()+'/app/globals.css'});
await fs.writeFile(dir+'/app.css',css.css+'\nbody{background:#080e1a;color:#eee;font-family:Arial;margin:0;padding:24px}main{max-width:1400px;margin:auto}h1,h2{padding:16px 0;font-weight:bold}output{display:block;padding:12px;overflow-wrap:anywhere}');
await fs.writeFile(dir+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer(async(req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname; const path=pathname==='/'?'/index.html':pathname;try{res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(dir+path));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let fixture;
 await page.route('**/rest/v1/campaigns*',r=>r.fulfill({json:[{id:'test',name:'Nattau test'}]}));
 await page.route('**/rest/v1/rpc/list_campaign_miniature_roster',r=>r.fulfill({json:[{player_id:'pippo',display_name:'Pippo',miniature_id:'pippo-model',storage_path:'test/pippo.glb',web_storage_path:'test/pippo.glb',original_name:'pippo.glb'}]}));
 await page.route('**/storage/v1/object/**',async r=>{await page.waitForFunction(()=>typeof window.makeFixture==='function');fixture??=Buffer.from(await page.evaluate(()=>Array.from(new Uint8Array(window.makeFixture(true)))));await r.fulfill({body:fixture,contentType:'model/gltf-binary'});});
 await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>typeof window.makeFixture==='function');
 fixture??=Buffer.from(await page.evaluate(()=>Array.from(new Uint8Array(window.makeFixture(true)))));
 await page.getByLabel('Miniature file',{exact:true}).setInputFiles({name:'Textured hero.glb',mimeType:'model/gltf-binary',buffer:fixture});
 await page.getByText('2 model part(s)',{exact:false}).waitFor();
 await page.getByRole('button',{name:"Match Pippo's height"}).waitFor();
 const percent=page.getByLabel('Default visual scale percent',{exact:true});
 await percent.fill('250');
 await page.getByRole('button',{name:'Fit view'}).click();
 await page.getByRole('button',{name:'Save and reload GLB'}).click();
 await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('"scale":2.5'));
 const legacy=await page.evaluate(()=>window.checkLegacyStl());assert.deepEqual(legacy,{triangles:12,scale:1.25,colorVertices:36,originalMaterials:false});
 const result=JSON.parse(await page.locator('#result').textContent());assert.equal(result.textured,1);assert.equal(result.meshes,2);
 await page.getByRole('button',{name:"Match Pippo's height"}).click();assert.equal(await percent.inputValue(),'100');
 await percent.fill('');await percent.pressSequentially('50');assert.equal(await percent.inputValue(),'50');
 await page.getByRole('button',{name:"Match Pippo's height"}).click();
 await page.getByLabel('Token visual scale percent',{exact:true}).fill('175');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 assert.equal(await page.locator('#token-scale').textContent(),'1.75');assert.equal(await page.locator('#token-footprint').textContent(),'1');
 await page.getByRole('button',{name:'Fit view'}).click();
 await page.screenshot({path:dir+'/desktop.png',fullPage:true});
 assert.equal(await page.getByRole('alert').count(),0);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Fit view'}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:dir+'/mobile.png',fullPage:true});

 const registrations=[]; const uploads=[]; let failRegistration=false; let deletes=0;
 await page.route('**/rest/v1/character_miniatures*',r=>r.fulfill({json:[]}));
 await page.route('**/rest/v1/vtt_enemy_models*',r=>r.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/register_*',r=>{
   registrations.push(r.request().postDataJSON());
   return r.fulfill(failRegistration?{status:500,json:{message:'Synthetic lost confirmation'}}:{json:'saved-model'});
 });
 await page.unroute('**/storage/v1/object/**');
 await page.route('**/storage/v1/object/**',r=>{
   if(r.request().method()==='DELETE'){deletes++;return r.fulfill({json:[]});}
   if(r.request().method()==='POST'){
     const data=r.request().postDataBuffer();
     const offset=data.indexOf(Buffer.from('glTF'));
     const jsonLength=data.readUInt32LE(offset+12);
     uploads.push({url:r.request().url(),json:JSON.parse(data.subarray(offset+20,offset+20+jsonLength).toString())});
     return r.fulfill({json:{Key:'saved-model'}});
   }
   return r.fulfill({body:fixture,contentType:'model/gltf-binary'});
 });
 for(const mode of ['manager','enemy']){
   await page.goto('http://127.0.0.1:4173/?mode='+mode);
   await page.getByLabel('Miniature file',{exact:true}).waitFor({state:'attached'});
   await page.waitForFunction(()=>!document.querySelector('input[type=file]').disabled);
   await page.getByLabel('Miniature file',{exact:true}).setInputFiles({name:'Import.glb',mimeType:'model/gltf-binary',buffer:fixture});
   await page.getByLabel('Default visual scale percent',{exact:true}).fill('220');
   await page.getByRole('button',{name:'Upload miniature & save scale'}).click();
   await page.waitForFunction(()=>!document.querySelector('input[type=file]').disabled);
   assert.equal(registrations.at(-1).p_original_name,'Import.glb');
   assert.equal(registrations.at(-1).p_triangle_count,2);
   assert.equal(uploads.at(-1).json.asset.extras.nattauMiniature.visualScale,2.2);
   assert.equal(uploads.at(-1).json.images.length,1);
   assert.equal(uploads.at(-1).json.meshes.length,2);
 }
 failRegistration=true;
 await page.getByLabel('Miniature file',{exact:true}).setInputFiles({name:'Retry.glb',mimeType:'model/gltf-binary',buffer:fixture});
 await page.getByLabel('Default visual scale percent',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Upload miniature & save scale'}).click();
 await page.getByText('Save could not be confirmed.',{exact:false}).waitFor();
 assert.equal(deletes,0);
 // The synthetic HTTP 500 is expected; application/rendering errors are not.
 const unexpectedErrors=errors.filter(message=>!message.includes('500 (Internal Server Error)'));
 assert.deepEqual(unexpectedErrors,[]);

 console.log(JSON.stringify({status:'PASS',checks:['embedded texture decoded after saved GLB reload','all meshes preserved','reference matching','50% manual typing','per-token scale with unchanged footprint','desktop and mobile render without errors','legacy STL export preserves triangle order and paint','character and enemy upload payloads retain textures and scale','uncertain registration never deletes uploaded assets'],legacy,result,screenshots:dir},null,2));
} finally {await browser?.close();server.close();}
