export function parseCSV(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i+1] === '\n') i++;
      row.push(cell);
      if (row.some(v => v !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSVの引用符が閉じられていません。');
  row.push(cell);
  if (row.some(v => v !== '')) rows.push(row);
  if (!rows.length) throw new Error('CSVにデータがありません。');
  const headers = rows.shift().map(h => h.trim());
  return { headers, records: rows.map(values => Object.fromEntries(headers.map((name,i) => [name,(values[i]||'').trim()]))) };
}
export function metric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 0;
  const v = Number(String(value).replace(/,/g,'').replace(/%/g,'').trim());
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
}
export function csvDate(value) {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) throw new Error(`CSVの日付を解釈できません: ${value}`);
  return date.toISOString().slice(0,10);
}
export function recognizeCSV(csv) {
  const h = new Set(csv.headers);
  if (h.has('ポストID') && h.has('ポスト本文') && h.has('インプレッション数')) return 'posts';
  if (h.has('Date') && h.has('インプレッション数') && h.has('ポストを作成')) return 'overview';
  throw new Error('X公式CSVの形式ではありません。投稿別CSVまたはアカウント概要CSVを選択してください。');
}
export function normalizePost(row) {
  const external_id = String(row['ポストID'] || '').trim();
  if (!/^\d{6,25}$/.test(external_id)) throw new Error('CSVのポストIDが不正です。');
  const date = csvDate(row['日付']);
  return {
    id: `x:${external_id}`, platform: 'x', external_id,
    text: String(row['ポスト本文']||'').slice(0,10000),
    url: String(row['ポストのリンク']||''), published_at:`${date}T00:00:00.000Z`,
    views:metric(row['インプレッション数']),likes:metric(row['いいね']),
    replies:metric(row['返信']),reposts:metric(row['リポスト']),quotes:0,
    shares:metric(row['共有された回数']),engagements:metric(row['エンゲージメント'])
  };
}
export function normalizeDay(row) {
  return {
    day:csvDate(row.Date),impressions:metric(row['インプレッション数']),
    likes:metric(row['いいね']),engagements:metric(row['エンゲージメント']),
    replies:metric(row['返信']),reposts:metric(row['リポスト']),
    bookmarks:metric(row['ブックマーク']),profile_visits:metric(row['プロフィールへのアクセス数']),
    follows:metric(row['新しいフォロー']),unfollows:metric(row['フォロー解除']),posts:metric(row['ポストを作成'])
  };
}
export function rate(post) {
  return post.views > 0 ? ((post.likes||0)+(post.replies||0)+(post.reposts||0)+(post.quotes||0))/(post.views)*100 : null;
}
