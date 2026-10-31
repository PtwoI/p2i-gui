import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const model=process.env.P2I_DEMO??'transformer';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try{
 await page.goto(process.env.P2I_URL??'http://127.0.0.1:8000');
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByText('Structured action JSON (batch / replace / insert / remove / wrap)',{exact:true}).click();
 const edits={
  mlp:[['layers.0','out_features',24],['layers.2','in_features',24]],
  cnn:[['features.0','out_channels',6],['features.3','in_channels',6]],
  transformer:[['blocks.0.mlp.0','out_features',96],['blocks.0.mlp.2','in_features',96]],
 }[model];
 const action={type:'batch',actions:edits.map(([target,parameter,value])=>({type:'set_parameter',target,parameter,value}))};
 await page.getByLabel('Action JSON',{exact:true}).fill(JSON.stringify(action));
 await page.getByRole('button',{name:'Preview & validate',exact:true}).click();
 await expect(page.locator('.validation-result')).toContainText('Validation passed');
 await page.getByRole('button',{name:'Commit edit',exact:true}).click();
 await page.getByRole('button',{name:'Build & Re-trace',exact:true}).click();
 await expect(page.locator('.local')).toContainText('architecture r1 / observed r1');
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download checkpoint',exact:true}).click();
 const file=await downloaded;
 await mkdir('../docs',{recursive:true});
 const path=`../docs/checkpoint-${model}.p2i`;
 await file.saveAs(path);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('button',{name:'Build & Re-trace',exact:true}).click();
 await expect(page.locator('.local')).toContainText('architecture r2 / observed r2');
 await page.getByLabel('Checkpoint file',{exact:true}).setInputFiles(path);
 await expect(page.locator('.checkpoint-panel')).toContainText('Checkpoint restored',{timeout:30000});
 await expect(page.locator('.local')).toContainText('architecture r1 / observed r1');
 await expect(page.locator('.revision-list')).toContainText('r1 · Session baseline');
 const state=await (await page.request.get(new URL('/api/harness',page.url()).href)).json();
 for(const [target,parameter,value] of edits){
  if(state.architecture.nodes.find(n=>n.qualified_name===target)?.parameters[parameter]!==value)throw Error('Restored architecture differs');
 }
 const validation=await page.request.post(new URL('/api/harness/validate',page.url()).href,{data:{backward:true}});
 if(!(await validation.json()).result.backward_valid)throw Error('Restored model cannot backpropagate');
 await page.locator('.checkpoint-panel').scrollIntoViewIfNeeded();
 await page.screenshot({path:`../docs/checkpoint-${model}.png`,fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`PASS checkpoint ${model}: atomic dimension edit, retrace, download, undo, upload, restored revision, backward`);
}finally{await browser.close()}
