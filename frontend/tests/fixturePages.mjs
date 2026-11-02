// Serve synthetic large-model fixtures through the same bounded API as the UI.
export async function mockModelPages(page,fixture){
 const kinds=['modules','operations','tensors','module_edges','data_edges','calls'];
 const collections=Object.fromEntries(kinds.map(kind=>[kind,kind==='calls'?(fixture.runtime?.calls??[]):(fixture[kind]??[])]));
 const header={version:fixture.version,metadata:fixture.metadata,runtime:fixture.runtime?{...fixture.runtime,calls:undefined}:null};
 await page.route('**/api/model/manifest',route=>route.fulfill({json:{snapshot:'fixture',header,counts:Object.fromEntries(kinds.map(kind=>[kind,collections[kind].length])),page_limit:500}}));
 await page.route('**/api/evidence/**',route=>{
  const url=new URL(route.request().url());const kind=url.pathname.split('/').at(-1),offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??500);
  const values=collections[kind],end=Math.min(offset+limit,values.length);
  return route.fulfill({json:{snapshot:'fixture',kind,total:values.length,offset,limit,next_offset:end<values.length?end:null,items:values.slice(offset,end)}});
 });
}
