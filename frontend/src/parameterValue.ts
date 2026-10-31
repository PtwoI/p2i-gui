export function formatParameterValue(value:unknown):string {
  return typeof value==='string'?value:JSON.stringify(value);
}
export function parseParameterValue(current:unknown,text:string):unknown {
  if(typeof current==='string')return text;
  if(typeof current==='number') {
    if(!text.trim()||!Number.isFinite(Number(text)))throw Error('Enter a finite numeric value');
    return Number(text);
  }
  if(typeof current==='boolean') {
    if(text!=='true'&&text!=='false')throw Error('Choose true or false');
    return text==='true';
  }
  return JSON.parse(text);
}
