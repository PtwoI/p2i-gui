import {useEffect,useState} from 'react';
import type {IR,Selection} from '../types/model';
import type {Inspection} from './TensorSample';
import {GraphView} from './GraphView';
interface Snapshot {model:IR;revision:number;inspection:Inspection}
interface Comparison {available:boolean;before:Snapshot;after:Snapshot;diff:{alignment:string;before_keys:Record<string,string>;after_keys:Record<string,string>;modules:{path:string;before:unknown;after:unknown}[];tensors:unknown[];operations:{before:number;after:number;added:string[];removed:string[]};paths:{added:unknown[];removed:unknown[]};parameters:{before:number;after:number}}}
export function ExecutionDiff({path}:{path:string}){
 const [data,setData]=useState<Comparison|null>(null),[error,setError]=useState(''),[key,setKey]=useState('');
 const [left,setLeft]=useState<Selection>({kind:'operation',id:''}),[right,setRight]=useState<Selection>({kind:'operation',id:''});
 useEffect(()=>{setKey('')},[path]);
 useEffect(()=>{fetch('/api/comparison').then(r=>{if(!r.ok)throw Error(String(r.status));return r.json()}).then(setData).catch(e=>setError(String(e)))},[]);
 if(error)return <p role="alert">Comparison unavailable: {error}</p>;
 if(!data)return <p>Loading observed comparison…</p>;
 if(!data.available)return <p>Two successful observations are required. Edit, then Build &amp; Re-trace to compare actual executions.</p>;
 const {diff}=data;
 const panel=(snapshot:Snapshot,side:'before'|'after')=>{
  const ir=snapshot.model,keys=side==='before'?diff.before_keys:diff.after_keys;
  const modules=new Set(ir.modules.filter(m=>m.qualified_name===path||m.qualified_name.startsWith(path?`${path}.`:'')).map(m=>m.id));
  const ops=ir.operations.filter(o=>o.graph==='runtime'&&modules.has(o.parent_module_id??''));
  const matching=Object.keys(keys).find(id=>keys[id]===key);
  const selected=matching?{kind:'operation' as const,id:matching}:side==='before'?left:right;
  return <section className="comparison-side"><h3>{side==='before'?'Before':'After'} · observed r{snapshot.revision}</h3>{key&&!matching&&<p className="pending-banner">No corresponding operation in this observation.</p>}<GraphView ir={ir} ops={ops} selected={selected} inspection={snapshot.inspection} select={s=>{if(side==='before')setLeft(s);else setRight(s);setKey(s.kind==='operation'?keys[s.id]??'':'')}}/>{selected.kind==='tensor'&&<pre>{JSON.stringify(ir.tensors.find(t=>t.id===selected.id),null,2)}</pre>}</section>
 };
 return <section className="execution-diff"><h2>Before / after observed execution</h2><p>{diff.alignment}. Samples may differ because of stochastic execution; differences do not establish causation.</p><div className="comparison-metrics"><strong>Parameters {diff.parameters.before} → {diff.parameters.after}</strong><strong>Operations {diff.operations.before} → {diff.operations.after}</strong><span>{diff.paths.added.length} added / {diff.paths.removed.length} removed dependency paths</span></div><details open><summary>Constructor changes · {diff.modules.length}</summary>{diff.modules.map(m=><div className="configuration-change" key={m.path}><b>{m.path||'(root)'}</b><pre>{JSON.stringify(m.before,null,2)}</pre><span>→</span><pre>{JSON.stringify(m.after,null,2)}</pre></div>)}</details><details><summary>Changed output shapes, dtypes or captured samples · {diff.tensors.length}</summary><pre>{JSON.stringify(diff.tensors,null,2)}</pre></details><details><summary>Added / removed observed paths</summary><pre>{JSON.stringify(diff.paths,null,2)}</pre></details><div className="comparison-panes">{panel(data.before,'before')}{panel(data.after,'after')}</div></section>;
}
