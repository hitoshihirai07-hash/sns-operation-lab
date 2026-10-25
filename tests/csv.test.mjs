import test from 'node:test';import assert from 'node:assert/strict';
import {parseCSV,recognizeCSV,normalizeDay,normalizePost,rate,csvDate} from '../lib/csv.js';
const postCsv='ポストID,日付,ポスト本文,ポストのリンク,インプレッション数,いいね,エンゲージメント,ブックマーク,共有された回数,新しいフォロー,返信,リポスト,プロフィールへのアクセス数,詳細のクリック数,URLのクリック数,ハッシュタグのクリック数,パーマリンクのクリック数\n2114213594405749004,"Sun, Oct 25, 2026","巨人ニュース","https://x.com/example/status/2114213594405749004",513,0,2,0,0,0,0,0,0,2,0,0,0\n';
const accountCsv='Date,インプレッション数,いいね,エンゲージメント,ブックマーク,共有された回数,新しいフォロー,フォロー解除,返信,リポスト,プロフィールへのアクセス数,ポストを作成,動画再生数,メディアの再生数\n"Sun, Oct 25, 2026",601,1,1,0,0,0,0,0,0,0,0,0,0\n';
test('X公式投稿CSVの認識と取り込み',()=>{const doc=parseCSV(postCsv);assert.equal(recognizeCSV(doc),'posts');assert.equal(doc.records.length,1);const p=normalizePost(doc.records[0]);assert.equal(p.platform,'x');assert.equal(p.views,513);assert.equal(p.id,'x:2114213594405749004');assert.ok(p.text.includes('巨人'));});
test('X公式概要CSVの認識と取り込み',()=>{const doc=parseCSV(accountCsv);assert.equal(recognizeCSV(doc),'overview');assert.equal(doc.records.length,1);const d=normalizeDay(doc.records[0]);assert.equal(d.day,'2026-10-25');assert.equal(d.impressions,601);});
test('quoted CSV handles commas/newlines/escaped quotes',()=>{const input='a,b\r\n"a,b","hello\n""world"""\r\n';assert.deepEqual(parseCSV(input).records,[{a:'a,b',b:'hello\n"world"'}]);});
test('comparable reaction rate excludes clicks/shares',()=>{assert.equal(rate({views:100,likes:2,replies:1,reposts:1,quotes:0,shares:99}),4);assert.equal(rate({views:0,likes:2}),null);});
test('date recognized',()=>assert.equal(csvDate('Sun, Oct 25, 2026'),'2026-10-25'));
