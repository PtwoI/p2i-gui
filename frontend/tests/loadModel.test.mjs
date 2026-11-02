import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from '../.unit/loadModel.js';
const kinds=['modules','operations','tensors','module_edges','data_edges','calls'];
test('paged reader assembles one snapshot and never exceeds three requests',async()=>{
 const saved=global.fetch;let active=0,peak=0;
 const records=Object.fromEntries(kinds.map(kind=>[kind,Array.from({length:3},(_,i)=>({id:`${kind}-${i}`}))]));
 global.fetch=async url=>{
  if(url==='/api/model/manifest')return {ok:true,json:async()=>({snapshot:'fixed',header:{runtime:{}},counts:Object.fromEntries(kinds.map(k=>[k,3]))})};
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));
  const parsed=new URL(url,'http://test');const kind=parsed.pathname.split('/').at(-1);
  assert.equal(parsed.searchParams.get('snapshot_id'),'fixed');
  active--;return {ok:true,json:async()=>({snapshot:'fixed',items:records[kind],next_offset:null})};
 };
 try {
  const progress=[];const model=await loadModel(new AbortController().signal,(n,total)=>progress.push([n,total]));
  assert.deepEqual(model.operations,records.operations);assert.deepEqual(model.runtime.calls,records.calls);
  assert.equal(peak,3);assert.deepEqual(progress.at(-1),[18,18]);
 } finally {global.fetch=saved}
});
test('snapshot conflicts stop loading instead of mixing observations',async()=>{
 const saved=global.fetch;
 global.fetch=async url=>url==='/api/model/manifest'?{ok:true,json:async()=>({snapshot:'fixed',header:{runtime:{}},counts:Object.fromEntries(kinds.map(k=>[k,1]))})}:{ok:false,status:409};
 try {await assert.rejects(loadModel(new AbortController().signal,()=>{}),/Model changed/)}finally{global.fetch=saved}
});
