import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, FORMATS, TOPICS} from '../lib/classify.js';
import {normalizePost} from '../lib/csv.js';

test('prediction and question get compound category and coaching topic',()=>{
  assert.deepEqual(classify('【2027年 巨人首脳陣予想】松井監督、高橋由伸ヘッド。皆さんはどう思いますか？'),{category:'予想＋質問',topic:'首脳陣'});
});
test('contract and development get distinct topics',()=>{
  assert.equal(classify('秋広の自由契約と育成打診についてどう思いますか？').topic,'契約・移籍');
  assert.equal(classify('若手の成長を期待したい').topic,'若手育成');
});
test('unrecognized post gets safe fallback',()=>{
  assert.deepEqual(classify('おはようございます'),{category:'その他',topic:'その他'});
  assert.ok(FORMATS.includes(classify('監督予想').category));
  assert.ok(TOPICS.includes(classify('監督予想').topic));
});
test('X CSV with date only does not invent 09:00 posting time',()=>{
  const row={'ポストID':'123456789012345','ポスト本文':'投稿','日付':'2026-10-25','インプレッション数':'30'};
  const p=normalizePost(row);
  assert.equal(p.published_at,'2026-10-25');
});
