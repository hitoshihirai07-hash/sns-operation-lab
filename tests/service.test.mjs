import test from 'node:test';import assert from 'node:assert/strict';
import {saveDraft} from '../lib/service.js';
class DB{constructor(){this.sql=[];}prepare(sql){this.sql.push(sql);return {bind:(...args)=>({run:async()=>({meta:{changes:1},args})})};}}
test('Threads text draft persists',async()=>{const db=new DB();const v=await saveDraft(db,{platform:'threads',text:'こんにちは',category:'質問型'});assert.equal(v.status,'draft');assert.equal(db.sql.length,1);});
test('X schedule is manual planned, not automated',async()=>{const db=new DB();const date=new Date(Date.now()+600_000).toISOString();const v=await saveDraft(db,{platform:'x',text:'テスト投稿',scheduled_at:date});assert.equal(v.status,'planned');});
test('Threads schedule is automatic',async()=>{const db=new DB();const date=new Date(Date.now()+600_000).toISOString();const v=await saveDraft(db,{platform:'threads',text:'テスト投稿',scheduled_at:date});assert.equal(v.status,'scheduled');});
test('reject past scheduled time',async()=>{await assert.rejects(()=>saveDraft(new DB(),{platform:'threads',text:'テスト',scheduled_at:'2020-01-01T00:00:00Z'}),/予約時刻/);});
test('reject bad platform',async()=>{await assert.rejects(()=>saveDraft(new DB(),{platform:'other',text:'テスト'}),/SNSの種類/);});
test('editing a scheduled post without time removes schedule',async()=>{
 const db=new DB();const prev={id:'p',platform:'threads',text:'aaa',category:'質問型',scheduled_at:new Date(Date.now()+600_000).toISOString()};
 const result=await saveDraft(db,{text:'aaa',scheduled_at:null},prev);assert.equal(result.status,'draft');
});
