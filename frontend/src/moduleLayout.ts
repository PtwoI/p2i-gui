export type FlowRoute = {from:string; to:string; tensor:string; via:string[]};

// Layer by recorded dependencies; stable sweeps keep related nodes close together.
export function moduleLayout(ids:string[], routes:FlowRoute[]) {
 const order=new Map(ids.map((id,i)=>[id,i]));
 const incoming=new Map(ids.map(id=>[id,new Set<string>()]));
 const outgoing=new Map(ids.map(id=>[id,new Set<string>()]));
 for(const r of routes) if(r.from!==r.to&&incoming.has(r.to)&&outgoing.has(r.from)) {
  incoming.get(r.to)!.add(r.from); outgoing.get(r.from)!.add(r.to);
 }
 const degree=new Map(ids.map(id=>[id,incoming.get(id)!.size]));
 const levels=new Map(ids.map(id=>[id,0]));
 const queue=ids.filter(id=>degree.get(id)===0);
 for(let i=0;i<queue.length;i++) for(const next of outgoing.get(queue[i])!) {
  levels.set(next,Math.max(levels.get(next)!,levels.get(queue[i])!+1));
  degree.set(next,degree.get(next)!-1); if(degree.get(next)===0)queue.push(next);
 }
 // Cycles are possible for shared/recurrent modules: keep them visible on separate lanes.
 for(const id of ids) if(!queue.includes(id)) levels.set(id,0);
 const columns: string[][]=[];
 for(const id of ids)(columns[levels.get(id)!]??=[]).push(id);
 const rank=()=>new Map(columns.flatMap(col=>(col??[]).map((id,i)=>[id,i] as const)));
 for(let pass=0;pass<4;pass++) {
  const forward=pass%2===0, indices=[...columns.keys()];if(!forward)indices.reverse();
  for(const col of indices) {const index=rank(), neighbors=forward?incoming:outgoing;
   (columns[col]??[]).sort((a,b)=>{const score=(id:string)=>{const ns=[...neighbors.get(id)!].filter(n=>levels.get(n)!==col);return ns.length?ns.reduce((s,n)=>s+(index.get(n)??0),0)/ns.length:(index.get(id)??0)};return score(a)-score(b)||(order.get(a)!-order.get(b)!)});
  }
 }
 const long=routes.filter(r=>Math.abs((levels.get(r.to)??0)-(levels.get(r.from)??0))!==1||levels.get(r.from)!>=levels.get(r.to)!);
 const top=50+long.length*16, positions=new Map<string,{x:number;y:number}>();
 columns.forEach((col,c)=>col?.forEach((id,i)=>positions.set(id,{x:36+c*470,y:top+i*195})));
 const height=Math.max(top+160,...[...positions.values()].map(p=>p.y+165));
 const width=Math.max(800,72+columns.length*470);
 const paths=routes.map(r=>{
  const a=positions.get(r.from)!,b=positions.get(r.to)!;
  const outs=routes.filter(q=>q.from===r.from).sort((x,y)=>(positions.get(x.to)?.y??0)-(positions.get(y.to)?.y??0));
  const ins=routes.filter(q=>q.to===r.to).sort((x,y)=>(positions.get(x.from)?.y??0)-(positions.get(y.from)?.y??0));
  const y1=a.y+16+106*(outs.indexOf(r)+1)/(outs.length+1),y2=b.y+16+106*(ins.indexOf(r)+1)/(ins.length+1);
  if(long.includes(r)){const rail=24+long.indexOf(r)*16,exit=a.x+310+140*(outs.indexOf(r)+1)/(outs.length+1),entry=b.x-10-140*(ins.indexOf(r)+1)/(ins.length+1);return `M${a.x+300},${y1} H${exit} V${rail} H${entry} V${y2} H${b.x}`}
  const x1=a.x+300,x2=b.x,mid=(x1+x2)/2;return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
 });
 return {positions,paths,width,height};
}
