import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {IR,Operation,Selection} from '../types/model';
import {shape} from '../types/model';
import {OperationExplainer} from './OperationExplainer';
import {emptyInspection} from './TensorSample';
import type {Inspection} from './TensorSample';

const positionMemory=new WeakMap<IR,Record<string,{x:number;y:number}>>();
import {dagPositions} from '../execution';
import type {Execution} from '../execution';

function GraphCanvas({ir,ops,select,selected,focusId,execution}:{ir:IR;ops:Operation[];select:(s:Selection)=>void;selected:Selection;focusId?:string;execution?:Execution}) {
  const [transform,setTransform]=useState({x:35,y:35,k:1});
  const [offsets,setOffsets]=useState<Record<string,{x:number;y:number}>>(positionMemory.get(ir)??{});
  useEffect(()=>{positionMemory.set(ir,offsets)},[ir,offsets]);
  const marker=useId().replace(/:/g,'');
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const canvas=useRef<SVGSVGElement|null>(null);
  const drag=useRef<{x:number;y:number}|null>(null);
  const nodeDrag=useRef<{id:string;x:number;y:number}|null>(null);
  const nodeMoved=useRef(false);
  const tensors=useMemo(()=>new Map(ir.tensors.map(t=>[t.id,t])),[ir]);
  const {positions,edges}=useMemo(()=>{
    const ids=new Set(ops.map(o=>o.id));
    const edges=ir.data_edges.filter(e=>ids.has(e.source_id)&&ids.has(e.target_id));
    const positions=dagPositions(ops,edges);
    if(focusId){
      const before=ops.filter(o=>o.id!==focusId&&edges.some(e=>e.source_id===o.id&&e.target_id===focusId));
      const after=ops.filter(o=>o.id!==focusId&&!before.includes(o));
      positions.set(focusId,{x:280,y:Math.max(0,Math.max(before.length,after.length)-1)*65});
      before.forEach((o,i)=>positions.set(o.id,{x:0,y:i*130}));
      after.forEach((o,i)=>positions.set(o.id,{x:560,y:i*130}));
    }
    for(const [id,offset] of Object.entries(offsets)){
      const position=positions.get(id);
      if(position)positions.set(id,{x:position.x+offset.x,y:position.y+offset.y});
    }
    return {positions,edges};
  },[ir,ops,focusId,offsets]);
  const visibleIds=new Set(ops.map(o=>o.id));
  const inputIds=[...new Set(ops.flatMap(o=>o.input_tensor_ids))].filter(id=>!visibleIds.has(tensors.get(id)?.producer_id??''));
  const outputIds=[...new Set(ops.flatMap(o=>o.output_tensor_ids))].filter(id=>{const t=tensors.get(id);return !t?.consumer_ids.length||t.consumer_ids.some(c=>!visibleIds.has(c))});
  const boundary=(ids:string[],label:string)=><div className="graph-boundary"><strong>{label}</strong>{ids.slice(0,8).map(id=><button key={id} onClick={()=>select({kind:'tensor',id})}><code>{id}</code> {shape(tensors.get(id))}</button>)}{ids.length>8&&<details><summary>+{ids.length-8} tensors</summary>{ids.slice(8).map(id=><button key={id} onClick={()=>select({kind:'tensor',id})}>{id} {shape(tensors.get(id))}</button>)}</details>}</div>;
  const fit=()=>{const bounds=canvas.current?.getBoundingClientRect();if(!bounds||!positions.size)return;const points=[...positions.values()],minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));const width=Math.max(...points.map(p=>p.x))+218-minX,height=Math.max(...points.map(p=>p.y))+76-minY;const k=Math.max(.8,Math.min(1.5,(bounds.width-70)/width,(bounds.height-110)/height));setTransform({x:35-minX*k,y:35-minY*k,k})};
  const zoom=(factor:number)=>setTransform(t=>({...t,k:Math.max(.12,Math.min(3,t.k*factor))}));
  return <>{boundary(inputIds,"Inputs to this graph slice")}<div className={`graph-wrap ${focusId?'local-graph':''} ${execution?'executing':''} ${execution?.playing?'playing':'paused'} phase-${execution?.phase??0}`} >
    <div className="graph-controls"><button onClick={()=>zoom(1.2)} aria-label="Zoom in">+</button><button onClick={()=>zoom(1/1.2)} aria-label="Zoom out">−</button><button onClick={()=>setTransform({x:35,y:35,k:1})}>Reset view</button><button onClick={fit}>Fit scope</button><span>{Math.round(transform.k*100)}% · Drag nodes to arrange · Pan empty canvas to explore · Edges are recorded tensor dependencies</span></div>
    <svg ref={canvas} className="graph" style={focusId?{height:Math.max(400,...[...positions.values()].map(p=>p.y+170)),minWidth:850}:undefined} aria-label="Computation graph" onWheel={e=>{zoom(e.deltaY<0?1.08:1/1.08)}} onPointerDown={e=>{if(e.target===e.currentTarget){drag.current={x:e.clientX,y:e.clientY}; e.currentTarget.setPointerCapture(e.pointerId)}}} onPointerMove={e=>{if(drag.current){const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;setTransform(t=>({...t,x:t.x+dx,y:t.y+dy}));drag.current={x:e.clientX,y:e.clientY}}}} onPointerUp={()=>{drag.current=null}}>
      <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#71839b"/></marker></defs>
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {edges.map((e,i)=>{const a=positions.get(e.source_id)!,b=positions.get(e.target_id)!;const outgoing=edges.filter(edge=>edge.source_id===e.source_id),incoming=edges.filter(edge=>edge.target_id===e.target_id);const ay=a.y+14+48*(outgoing.indexOf(e)+1)/(outgoing.length+1),by=b.y+14+48*(incoming.indexOf(e)+1)/(incoming.length+1);const mid=(a.x+218+b.x)/2;const d=`M${a.x+218},${ay} C${mid},${ay} ${mid},${by} ${b.x},${by}`;return <g key={i} className={`graph-edge ${execution?.operation.input_tensor_ids.includes(e.tensor_id)?'flow-input':execution?.operation.output_tensor_ids.includes(e.tensor_id)?'flow-output':'flow-unrelated'}`} tabIndex={0} role="button" aria-label={`Tensor ${e.tensor_id} ${shape(tensors.get(e.tensor_id))}`} onKeyDown={event=>{if(event.key==='Enter')select({kind:'tensor',id:e.tensor_id})}} onClick={()=>select({kind:'tensor',id:e.tensor_id})}><path d={d} fill="none" stroke="transparent" strokeWidth="14"/><path d={d} fill="none" stroke={selected.id===e.tensor_id?'#087f8c':'#8f9db0'} strokeWidth="1.5" markerEnd={`url(#${marker})`}/><title>{e.tensor_id} {shape(tensors.get(e.tensor_id))}</title>{edges.length<80&&<text x={(a.x+218+b.x)/2} y={(a.y+b.y)/2+27} textAnchor="middle" className="edge-shape">{shape(tensors.get(e.tensor_id)).slice(0,24)}</text>}</g>})}
        {ops.map(op=>{const p=positions.get(op.id)!;return <g key={op.id} tabIndex={0} role="button" aria-label={op.display_name} onPointerDown={e=>{e.stopPropagation();nodeMoved.current=false;nodeDrag.current={id:op.id,x:e.clientX,y:e.clientY};setDraggingId(op.id);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(nodeDrag.current?.id!==op.id)return;const dx=(e.clientX-nodeDrag.current.x)/transform.k,dy=(e.clientY-nodeDrag.current.y)/transform.k;if(dx||dy)nodeMoved.current=true;setOffsets(previous=>({...previous,[op.id]:{x:(previous[op.id]?.x??0)+dx,y:(previous[op.id]?.y??0)+dy}}));nodeDrag.current={id:op.id,x:e.clientX,y:e.clientY}}} onPointerUp={e=>{if(nodeDrag.current?.id===op.id){nodeDrag.current=null;setDraggingId(null);e.currentTarget.releasePointerCapture(e.pointerId)}}} onPointerCancel={e=>{if(nodeDrag.current?.id===op.id){nodeDrag.current=null;setDraggingId(null);e.currentTarget.releasePointerCapture(e.pointerId)}}} onKeyDown={e=>{if(e.key==='Enter')select({kind:'operation',id:op.id})}} onClick={()=>{if(nodeMoved.current){nodeMoved.current=false;return}select({kind:'operation',id:op.id})}} transform={`translate(${p.x},${p.y})`} className={`op-node ${op.graph==='runtime'?'runtime-node':'static-node'} ${draggingId===op.id?'dragging':''} ${execution?.operation.id===op.id?'runtime-active':execution?'runtime-inactive':''}`}>
          <rect width="218" height="76" rx="8" fill={selected.id===op.id?'#e0f4f2':'white'} stroke={selected.id===op.id?'#087f8c':'#bfcad7'}/>
          <text x="12" y="23" className="op-label">{op.display_name.length>27?op.display_name.slice(0,25)+'…':op.display_name}</text>
          <text x="12" y="44">{op.id} · {op.parent_module_id??'unknown module'}</text>
          <text x="12" y="63">{shape(tensors.get(op.output_tensor_ids[0])).slice(0,31)}</text><title>{op.display_name}</title>
        </g>})}
      </g>
    </svg>
    {!ops.length&&<p className="empty">No operations in this scope and graph. Try including descendants or choosing another graph.</p>}
  </div>{boundary(outputIds,"Outputs from this graph slice")}</>
}

export function GraphView({ir,ops,select,selected,inspection=emptyInspection,execution,rawLimit=120}:{ir:IR;ops:Operation[];select:(s:Selection)=>void;selected:Selection;inspection?:Inspection;execution?:Execution;rawLimit?:number}){
 const [raw,setRaw]=useState(false),[focus,setFocus]=useState(ops[0]?.id??'');
 useEffect(()=>{if(selected.kind==='operation'&&ops.some(o=>o.id===selected.id))setFocus(selected.id)},[selected,ops]);
 const current=execution?.operation??ops.find(o=>o.id===focus)??ops[0];
 const index=current?ops.indexOf(current):0;
 const choose=(i:number)=>{if(ops[i]){setFocus(ops[i].id);select({kind:'operation',id:ops[i].id})}};
 const adjacent=useMemo(()=>{const m=new Map<string,Set<string>>();for(const e of ir.data_edges){if(!m.has(e.source_id))m.set(e.source_id,new Set());if(!m.has(e.target_id))m.set(e.target_id,new Set());m.get(e.source_id)!.add(e.target_id);m.get(e.target_id)!.add(e.source_id)}return m},[ir]);
 const neighbors=current?ops.filter(o=>o.id!==current.id&&adjacent.get(current.id)?.has(o.id)):[];
 const shown=raw?ops.slice(0,rawLimit):current?[current,...neighbors.slice(0,6)]:[];
 return <div className="compute-experience"><div className="focus-controls"><div><span className="eyebrow">{raw?`SCOPE · FIRST ${rawLimit} OPERATIONS`:'ONE OPERATION AT A TIME'}</span><h3>{raw?'Raw computation graph':'Follow the tensor flow'}</h3></div><button aria-pressed={raw} onClick={()=>setRaw(r=>!r)}>{raw?'Focused view':'Raw graph'}</button></div>{current&&<><div className="operation-navigation"><button disabled={index===0} onClick={()=>choose(index-1)}>Previous operation</button><label>Operation <select aria-label="Focused operation" value={current.id} onChange={e=>choose(ops.findIndex(o=>o.id===e.target.value))}>{ops.map((o,i)=><option key={o.id} value={o.id}>{i+1}. {o.display_name}</option>)}</select></label><button disabled={index===ops.length-1} onClick={()=>choose(index+1)}>Next operation</button><span>{index+1} / {ops.length}</span></div><OperationExplainer ir={ir} op={current} select={select} inspection={inspection} phase={execution?.phase}/></>}{!raw&&<p className="neighborhood-note">Direct inputs ← selected operation → direct consumers. Only recorded edges are drawn.{neighbors.length>6?` Showing 6 of ${neighbors.length} adjacent operations; use the selector or Raw graph for the rest.`:''} Navigation follows trace listing order; it does not imply a dependency.</p>}<GraphCanvas key={`${raw}-${current?.id}`} ir={ir} ops={shown} select={select} selected={selected.kind==='tensor'?selected:{kind:'operation',id:current?.id??''}} focusId={raw?undefined:current?.id} execution={execution}/></div>;
}
