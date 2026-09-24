import type {Tensor} from '../types/model';

export interface GridSummary {
 shape:[number,number];
 values:(number|null)[][];
 aggregation:'mean';
 source_shape:number[];
 spatial_axes:number[];
 reduced_axes:number[];
 finite_elements:number;
}
export interface Sample {
 elements:number;
 values:(number|null)[]|null; // Older bounded inspection sidecars only.
 grid?:GridSummary|null;
 message:string;
 min?:number|null;max?:number|null;mean?:number|null;std?:number|null;
}
export interface Inspection {tensors:Record<string,Sample>;operations:Record<string,unknown>}
export const emptyInspection:Inspection={tensors:{},operations:{}};

export function TensorSample({tensor,sample}:{tensor:Tensor;sample?:Sample}){
 const grid=sample?.grid;
 const legacy=sample?.values?.slice(0,64);
 const cells=grid?.values??(legacy?.length?[legacy]:null);
 const originalShape=`[${tensor.shape.map(dim=>dim??'?').join(', ')}]`;
 if(!cells)return <div className="sample-omitted">Heatmap unavailable · {originalShape}{sample?` · ${sample.elements.toLocaleString()} elements`:''}<small>{sample?.message??'Enable whole-tensor CPU heatmaps in Edit, then Build & Re-trace.'}</small></div>;
 const numeric=cells.flat().filter((value):value is number=>value!==null);
 const maximum=Math.max(0,...numeric.map(Math.abs));
 const columns=Math.max(0,...cells.map(row=>row.length));
 const color=(value:number|null)=>value===null?'#eef1f2':maximum===0?'#f5f9f8':
  `rgba(${value<0?'192,109,64':'16,137,125'},${(.08+.82*Math.abs(value)/maximum).toFixed(3)})`;
 const summary=grid?`${grid.shape[0]} × ${grid.shape[1]} whole-tensor mean grid`:`Legacy prefix · ${legacy!.length} / ${sample!.elements.toLocaleString()} values`;
 const method=grid?grid.reduced_axes.length?
  `Axes ${grid.reduced_axes.join(', ')} averaged; axes ${grid.spatial_axes.join(', ')} pooled.`:
  `Axes ${grid.spatial_axes.join(', ')||'scalar'} pooled.`:
  'Only the saved prefix is available in this older inspection.';
 return <div className="tensor-sample">
  <div className="sample-caption"><strong>{summary}</strong><span>{sample!.elements.toLocaleString()} elements</span></div>
  <p className="grid-description">Original shape {originalShape}. {method}</p>
  <div className={`heatmap${!grid||tensor.shape.length===1?' heatmap-strip':tensor.shape.length===0?' heatmap-scalar':''}`}
       role="group" aria-label={`Tensor heatmap for ${tensor.id}`}
       style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,
               gridTemplateRows:`repeat(${cells.length},minmax(0,1fr))`,
               aspectRatio:grid&&tensor.shape.length>=2?`${columns} / ${Math.min(columns,cells.length)}`:undefined}}>
   {cells.flatMap((row,r)=>row.map((value,c)=><button key={`${r}-${c}`} type="button"
       className="heatmap-cell" disabled={value===null}
       aria-label={`Grid row ${r+1} column ${c+1}: ${value===null?'no finite values':`mean ${value}`}`}
       title={value===null?'No finite values':`Mean ${value}`}
       style={{background:color(value)}}/>))}
  </div>
  <div className="heatmap-legend" aria-label="Negative means orange; zero neutral; positive means teal">
   <span>−{maximum.toPrecision(2)}</span><div className="heatmap-gradient"/><span>0</span><span>+{maximum.toPrecision(2)}</span>
  </div>
  <details className="heatmap-metadata"><summary>Statistics and coverage</summary>
   <p>{grid?`${grid.finite_elements.toLocaleString()} / ${sample!.elements.toLocaleString()} finite elements. ${sample!.message}`:sample!.message}</p>
   <div className="sample-stats">{(['min','max','mean','std'] as const).map(key=><span key={key}>{key} <b>{sample![key]==null?'—':sample![key]!.toPrecision(3)}</b></span>)}</div>
  </details>
 </div>;
}
