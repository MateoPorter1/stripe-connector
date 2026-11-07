const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareFallbackStorage } = require('../services/fallbackStorage');
test('builds safety indexes after connection without reusing failed startup init promises',async()=>{
  const events=[];
  const model=name=>({ init:async()=>{throw new Error('cached early startup failure');},createCollection:async()=>events.push(name+':collection'),createIndexes:async()=>events.push(name+':indexes') });
  await prepareFallbackStorage(model('attempt'),model('lease'),model('recovery'));
  assert.deepEqual(events,['attempt:collection','lease:collection','recovery:collection','attempt:indexes','recovery:indexes']);
});
test('a failed unique-index build prevents storage readiness and can be retried',async()=>{
  let ready=false;
  const model={createCollection:async()=>{},createIndexes:async()=>{if(!ready)throw new Error('DB unavailable');}};
  await assert.rejects(prepareFallbackStorage(model,model,model),/DB unavailable/);
  ready=true;
  await prepareFallbackStorage(model,model,model);
});
