import test from 'node:test';
import assert from 'node:assert/strict';
import {formatParameterValue,parseParameterValue} from '../.unit/parameterValue.js';
test('constructor forms accept plain strings, booleans, numbers and shape arrays',()=>{
 assert.equal(formatParameterValue('tanh'),'tanh');
 assert.equal(parseParameterValue('tanh','relu'),'relu');
 assert.equal(parseParameterValue(4,'12'),12);
 assert.equal(parseParameterValue(true,'false'),false);
 assert.deepEqual(parseParameterValue([3,3],'[5,5]'),[5,5]);
 for(const value of ['', 'Infinity','NaN'])assert.throws(()=>parseParameterValue(1,value));
});
