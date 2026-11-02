import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const model=process.env.P2I_DEMO??'mlp';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:1100}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try {
 await page.goto(process.env.P2I_URL??'http://127.0.0.1:8000');
 const recurrent=['rnn','lstm','gru'].includes(model);
 const target=recurrent?'recurrent':model==='cnn'?'features.0':'layers.0';
 if(!recurrent)await page.getByRole('button',{name:`Explore ${model==='cnn'?'features':'layers'}`,exact:true}).click();
 await page.getByRole('button',{name:`Explore ${target}`,exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 if(recurrent) {
  await page.getByText('Batch edit without JSON',{exact:true}).click();
  await page.getByRole('button',{name:'Add parameter change',exact:true}).click();
  await page.getByLabel('Batch module 1',{exact:true}).selectOption({label:`recurrent · ${model.toUpperCase()}`});
  await page.getByLabel('Batch parameter 1',{exact:true}).selectOption('hidden_size');
  await page.getByLabel('Batch value 1',{exact:true}).fill('12');
  await page.getByRole('button',{name:'Preview & validate',exact:true}).click();
  await expect(page.locator('.validation-result')).toContainText('Edit rejected');
  await expect(page.getByRole('button',{name:'Commit edit',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Add parameter change',exact:true}).click();
  await page.getByLabel('Batch module 2',{exact:true}).selectOption({label:'head · Linear'});
  await page.getByLabel('Batch parameter 2',{exact:true}).selectOption('in_features');
  await page.getByLabel('Batch value 2',{exact:true}).fill('12');
 } else {
  await page.getByLabel('Constructor parameter',{exact:true}).selectOption(model==='cnn'?'out_channels':'out_features');
  await page.getByLabel('Proposed value',{exact:true}).fill('6');
  await expect(page.getByLabel('Include connected dimensions in supported architectures',{exact:true})).toBeChecked();
 }
 await page.getByRole('button',{name:'Preview & validate',exact:true}).click();
 await expect(page.locator('.validation-result')).toContainText('Validation passed');
 await expect(page.locator('.diff-table')).toContainText(recurrent?'head':model==='cnn'?'features.3':'layers.2');
 // A changed draft must invalidate its successful preview.
 const value=page.getByLabel(recurrent?'Batch value 1':'Proposed value',{exact:true});
 await value.fill(recurrent?'13':'7');
 await expect(page.getByRole('button',{name:'Commit edit',exact:true})).toBeDisabled();
 await value.fill(recurrent?'12':'6');
 await page.getByRole('button',{name:'Preview & validate',exact:true}).click();
 await expect(page.locator('.validation-result')).toContainText('Validation passed');
 await page.getByRole('button',{name:'Commit edit',exact:true}).click();
 await page.getByRole('button',{name:'Build & Re-trace',exact:true}).click();
 await expect(page.locator('.local')).toContainText('architecture r1 / observed r1');
 const state=await (await page.request.get(new URL('/api/harness',page.url()).href)).json();
 const find=path=>state.architecture.nodes.find(node=>node.qualified_name===path).parameters;
 if(recurrent) {
  if(find('recurrent').hidden_size!==12||find('head').in_features!==12)throw Error('Batch did not update both dimensions');
 } else if(model==='mlp') {
  if(find('layers.0').out_features!==6||find('layers.2').in_features!==6)throw Error('Linear connection was not updated');
 } else if(find('features.0').out_channels!==6||find('features.3').in_channels!==6)throw Error('Conv connection was not updated');
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download checkpoint',exact:true}).click();
 const file=await downloaded;
 await mkdir('../docs',{recursive:true});
 const path=`../docs/guided-${model}.p2i`;
 await file.saveAs(path);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByLabel('Checkpoint file',{exact:true}).setInputFiles(path);
 await expect(page.locator('.checkpoint-panel')).toContainText('Checkpoint restored');
 const validation=await page.request.post(new URL('/api/harness/validate',page.url()).href,{data:{backward:true}});
 if(!(await validation.json()).result.backward_valid)throw Error('Restored model cannot backpropagate');
 await page.screenshot({fullPage:true,path:`../docs/guided-${model}.png`});
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`PASS guided ${model}: no-JSON dimension edit, draft invalidation, one revision, download/reopen, backward`);
} finally {await browser.close()}
