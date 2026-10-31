import {useRef,useState} from 'react';
import type {IR} from '../types/model';
import type {HarnessState} from '../types/harness';

export function CheckpointPanel({state,onState,onModel}:{state:HarnessState;onState:(s:HarnessState)=>void;onModel:(ir:IR)=>void}){
 const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false),[includeInputs,setIncludeInputs]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
 const download=async()=>{
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/checkpoint/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:state.summary?.revision,include_inputs:includeInputs})});
   if(!response.ok)throw Error((await response.json()).detail??'Checkpoint export failed');
   const url=URL.createObjectURL(await response.blob());
   const link=document.createElement('a');link.href=url;link.download=`model-r${state.summary?.revision??0}.p2i`;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage('Checkpoint downloaded. Use p2i.load_model(path) in PyTorch, or open it here to continue editing.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 };
 const restore=async(file:File)=>{
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/checkpoint/import',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
   const data=await response.json();if(!response.ok)throw Error(data.detail??'Checkpoint import failed');
   onState(data.state);onModel(data.result.model);
   setMessage('Checkpoint restored with its weights and examples. Editing continues from the saved revision.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false);if(input.current)input.current.value=''}
 };
 return <section className="checkpoint-panel" aria-label="Model checkpoint">
  <h3>Save and continue</h3>
  <p>A checkpoint stores the current architecture and weights. Include examples to reopen an editable session. It starts a new history from the saved revision.</p>
  <label><input type="checkbox" checked={includeInputs} onChange={e=>setIncludeInputs(e.target.checked)}/> Include example inputs in checkpoint</label>
  <div className="edit-actions">
   <button disabled={busy||!state.enabled} onClick={download}>Download checkpoint</button>
   <button disabled={busy} onClick={()=>input.current?.click()}>Open checkpoint</button>
  </div>
  <input hidden ref={input} type="file" accept=".p2i" aria-label="Checkpoint file" onChange={e=>{const file=e.target.files?.[0];if(file)void restore(file)}}/>
  {busy&&<p role="status">Preparing model checkpoint…</p>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>
}
