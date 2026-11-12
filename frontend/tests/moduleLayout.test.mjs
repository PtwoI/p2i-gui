import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLayout} from '../.unit/moduleLayout.js';
const route=(from,to)=>({from,to,tensor:from+to,via:[]});
test('lays branching dependencies left to right and separates their ports',()=>{
 const ids=['a','b','c','d'],rs=[route('a','b'),route('a','c'),route('b','d'),route('c','d')];
 const result=moduleLayout(ids,rs),p=result.positions;
 assert.ok(p.get('a').x<p.get('b').x&&p.get('b').x<p.get('d').x);
 assert.notEqual(p.get('b').y,p.get('c').y);
 assert.notEqual(result.paths[0],result.paths[1]);
});
test('routes skips and cycles outside node rows and retains isolated modules',()=>{
 const rs=[route('a','b'),route('b','c'),route('a','c'),route('c','a')];
 const result=moduleLayout(['a','b','c','unconnected'],rs);
 assert.equal(result.positions.size,4);
 assert.ok(result.paths.every(p=>!p.includes('NaN')));
 assert.ok(result.paths.some(p=>p.includes(' V')));
 assert.ok([...result.positions.values()].every(p=>p.y>=50));
});
