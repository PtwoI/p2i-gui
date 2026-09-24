import type {IR,Operation} from './types/model';
export interface Execution {operation:Operation; playing:boolean; phase:number}
/** Only dispatched operations supply an execution order. Export/FX are not playback. */
export function executionOrder(ir:IR,subtree:Set<string>):Operation[]{
 return ir.operations.filter(o=>o.graph==='runtime'&&o.executed&&subtree.has(o.parent_module_id??'')).sort((a,b)=>a.sequence-b.sequence);
}
/** Row-major index; null means that the requested coordinate was not captured. */
export function sampleIndex(shape:number[],coordinates:number[],captured:number):number|null{
 if(shape.length!==coordinates.length)return null;
 let index=0;
 for(let i=0;i<shape.length;i++){if(!Number.isInteger(coordinates[i])||coordinates[i]<0||coordinates[i]>=shape[i])return null;index=index*shape[i]+coordinates[i]}
 return index<captured?index:null;
}

/** Topological layering does not depend on export/runtime listing order. */
export function dagPositions(ops:Operation[],edges:IR['data_edges']){
 const ids=new Set(ops.map(o=>o.id)),incoming=new Map<string,Set<string>>(),outgoing=new Map<string,Set<string>>();
 for(const id of ids){incoming.set(id,new Set());outgoing.set(id,new Set())}
 for(const e of edges)if(ids.has(e.source_id)&&ids.has(e.target_id)&&e.source_id!==e.target_id){incoming.get(e.target_id)!.add(e.source_id);outgoing.get(e.source_id)!.add(e.target_id)}
 const pending=new Map([...incoming].map(([id,s])=>[id,s.size])),levels=new Map<string,number>();
 const queue=[...ids].filter(id=>pending.get(id)===0);
 for(let cursor=0;cursor<queue.length;cursor++){
  const id=queue[cursor];levels.set(id,Math.max(0,...[...incoming.get(id)!].map(p=>(levels.get(p)??0)+1)));
  for(const next of outgoing.get(id)!){pending.set(next,pending.get(next)!-1);if(!pending.get(next))queue.push(next)}
 }
 const rows=new Map<number,number>(),positions=new Map<string,{x:number;y:number}>();
 for(const id of [...queue,...[...ids].filter(id=>!levels.has(id))]){const level=levels.get(id)??0,row=rows.get(level)??0;positions.set(id,{x:level*310,y:row*132});rows.set(level,row+1)}
 return positions;
}
