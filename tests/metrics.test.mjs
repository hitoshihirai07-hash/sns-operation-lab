import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchThreads} from '../lib/meta.js';

// Only API data is mocked; no live Threads posts are modified by this test.
test('missing Threads metric stays null, legitimate zero stays zero',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    const path=new URL(url).pathname;
    let data;
    if(path==='/me')data={id:'me',username:'tester'};
    else if(path==='/me/threads')data={data:[{id:'123',text:'テスト',timestamp:'2026-10-27T11:00:00Z'}]};
    else if(path==='/123/insights')data={data:[
      {name:'views',total_value:{value:100}},
      {name:'likes',total_value:{value:0}},
      {name:'replies',total_value:{value:null}},
      {name:'reposts',total_value:{value:3}},
      {name:'quotes',total_value:{value:0}},
      {name:'shares',total_value:{value:1}}
    ]};
    else throw new Error('Unexpected mocked path '+path);
    return {ok:true,status:200,json:async()=>data};
  };
  try{
    const result=await fetchThreads('fake-token',1);
    assert.equal(result.results.length,1);
    const x=result.results[0];
    assert.equal(x.metrics.likes,0);
    assert.equal(x.metrics.replies,null);
    assert.match(x.metricError,/replies/);
  } finally {globalThis.fetch=original;}
});

test('failed Threads insights remain marked as unavailable',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    const path=new URL(url).pathname;
    if(path==='/123/insights')return {ok:false,status:503,json:async()=>({error:{message:'Temporary failure'}})};
    return {ok:true,status:200,json:async()=>path==='/me'?{id:'me',username:'tester'}:{data:[{id:'123',text:'abc'}]}};
  };
  try{
    const result=await fetchThreads('fake-token',1);
    assert.equal(result.results[0].metrics,null);
    assert.match(result.results[0].metricError,/Temporary failure/);
  }finally{globalThis.fetch=original;}
});
