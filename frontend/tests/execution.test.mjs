import test from 'node:test';
import assert from 'node:assert/strict';
import {executionOrder,sampleIndex,dagPositions} from '../.unit/execution.js';
test('playback excludes static/unexecuted nodes and follows observed order',()=>{
 const op=(id,sequence,graph='runtime',executed=true)=>({id,sequence,graph,executed,parent_module_id:'m0'});
 assert.deepEqual(executionOrder({operations:[op('later',8),op('static',0,'export'),op('first',1),op('absent',2,'runtime',false)]},new Set(['m0'])).map(o=>o.id),['first','later']);
});
test('rank-aware row-major slices never manufacture uncaptured values',()=>{
 assert.equal(sampleIndex([],[],1),0);assert.equal(sampleIndex([2,3,4],[0,1,2],16),6);
 assert.equal(sampleIndex([2,3,4],[1,1,2],16),null);assert.equal(sampleIndex([2,3],[0,3],6),null);
});
test('branch and merge layering is independent of node listing order',()=>{
 const edges=[['a','b'],['a','c'],['b','d'],['c','d']].map(([source_id,target_id])=>({source_id,target_id,tensor_id:'t'}));
 const positions=dagPositions(['d','c','a','b'].map(id=>({id})),edges);
 assert.ok(positions.get('a').x<positions.get('b').x);assert.equal(positions.get('b').x,positions.get('c').x);
 assert.notEqual(positions.get('b').y,positions.get('c').y);assert.ok(positions.get('d').x>positions.get('b').x);
});
