import type {IR} from './types/model';

const kinds=['modules','operations','tensors','module_edges','data_edges','calls'] as const;
export async function loadModel(signal:AbortSignal,onProgress:(loaded:number,total:number)=>void):Promise<IR> {
  async function read(url:string) {
    const response=await fetch(url,{signal});
    if(!response.ok)throw Error(response.status===409?'Model changed while loading. Retry to load its current snapshot.':`Model request failed (${response.status})`);
    return response.json();
  }
  const manifestResponse=await fetch('/api/model/manifest',{signal});
  if(manifestResponse.status===404)return read('/api/model');
  if(!manifestResponse.ok)throw Error(`Model manifest failed (${manifestResponse.status})`);
  const manifest=await manifestResponse.json();
  const total=kinds.reduce((sum,kind)=>sum+manifest.counts[kind],0);
  let loaded=0;onProgress(loaded,total);
  const collections:Record<string,unknown[]>={};
  // At most three bounded requests are in flight; the UI can cancel on unmount.
  let nextKind=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(nextKind<kinds.length) {
      const kind=kinds[nextKind++];const values:unknown[]=[];
      let offset:number|null=0;
      while(offset!==null) {
        const page=await read(`/api/evidence/${kind}?offset=${offset}&limit=500&snapshot_id=${encodeURIComponent(manifest.snapshot)}`);
        if(page.snapshot!==manifest.snapshot)throw Error('Model evidence changed; retry loading');
        values.push(...page.items);loaded+=page.items.length;onProgress(loaded,total);offset=page.next_offset;
      }
      collections[kind]=values;
    }
  }));
  const {calls,...arrays}=collections;
  return {...manifest.header,...arrays,runtime:manifest.header.runtime?{...manifest.header.runtime,calls}:null} as IR;
}
