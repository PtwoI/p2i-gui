import {formatParameterValue} from '../parameterValue';
import type {ArchitectureNode} from '../types/harness';

export interface ParameterChange {target:string;parameter:string;value:string}

export function BatchEditor({nodes,changes,onChange,disabled=false}:{
  nodes:ArchitectureNode[];changes:ParameterChange[];onChange:(changes:ParameterChange[])=>void;disabled?:boolean;
}) {
  const editable=nodes.filter(node=>node.editable&&Object.keys(node.parameters).length>0);
  function initial(node:ArchitectureNode):ParameterChange {
    const parameter=Object.keys(node.parameters)[0];
    return {target:node.id,parameter,value:formatParameterValue(node.parameters[parameter])};
  }
  function update(index:number,patch:Partial<ParameterChange>) {
    onChange(changes.map((change,i)=>i===index?{...change,...patch}:change));
  }
  return <div className="batch-editor">
    <p>Choose every parameter to change. Preview validates all rows together; commit creates one undoable revision.</p>
    {changes.map((change,index)=>{
      const node=editable.find(item=>item.id===change.target);
      return <fieldset key={index} disabled={disabled} className="batch-row">
        <legend>Change {index+1}</legend>
        <label>Module<select aria-label={`Batch module ${index+1}`} value={change.target} onChange={event=>{
          const selected=editable.find(item=>item.id===event.target.value)!;
          update(index,initial(selected));
        }}>{editable.map(item=><option key={item.id} value={item.id}>{item.qualified_name||'(root)'} · {item.module_type.split('.').at(-1)}</option>)}</select></label>
        <label>Parameter<select aria-label={`Batch parameter ${index+1}`} value={change.parameter} onChange={event=>update(index,{parameter:event.target.value,value:formatParameterValue(node?.parameters[event.target.value])})}>
          {Object.keys(node?.parameters??{}).map(key=><option key={key}>{key}</option>)}
        </select></label>
        <label>Value{typeof node?.parameters[change.parameter]==='boolean'?
          <select aria-label={`Batch value ${index+1}`} value={change.value} onChange={event=>update(index,{value:event.target.value})}><option>true</option><option>false</option></select>:
          <input aria-label={`Batch value ${index+1}`} type={typeof node?.parameters[change.parameter]==='number'?'number':'text'} step="any" value={change.value} onChange={event=>update(index,{value:event.target.value})}/>}
        </label>
        <button type="button" onClick={()=>onChange(changes.filter((_,i)=>i!==index))}>Remove change {index+1}</button>
      </fieldset>;
    })}
    <button disabled={disabled||!editable.length||changes.length>=100} onClick={()=>onChange([...changes,initial(editable[0])])}>Add parameter change</button>
  </div>;
}
