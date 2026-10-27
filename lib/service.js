import {parseCSV,recognizeCSV,normalizeDay,normalizePost} from './csv.js';
import {fetchThreads,publishThreads,graph} from './meta.js';
import {classify} from './classify.js';
const now=()=>new Date().toISOString();
const METRICS=['views','likes','replies','reposts','quotes','shares','engagements'];
export function respond(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export function fail(err){const message=String(err?.message||err||'処理に失敗しました'); const status=err?.status||500;return respond({error: message.slice(0,400)}, status);}
export async function importCSV(db,contents){
  if(contents.length>2_000_000) throw Object.assign(new Error('CSVは2MB以下にしてください。'),{status:413});
  const csv=parseCSV(contents);const type=recognizeCSV(csv);
  if(csv.records.length>5000) throw Object.assign(new Error('CSVは5,000行以下にしてください。'),{status:413});
  const stamp=now();let count=0;
  if(type==='posts'){
    for(const row of csv.records){
      if(!row['ポストID'])continue;
      const p=normalizePost(row);
      await db.prepare(`INSERT INTO posts (id,platform,source,external_id,text,url,category,status,published_at,views,likes,replies,reposts,quotes,shares,engagements,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET text=excluded.text,url=excluded.url,published_at=excluded.published_at,category=CASE WHEN posts.category<>'未分類' OR EXISTS(SELECT 1 FROM settings WHERE key='category_manual:' || posts.id) THEN posts.category ELSE excluded.category END,views=excluded.views,likes=excluded.likes,replies=excluded.replies,reposts=excluded.reposts,quotes=excluded.quotes,shares=excluded.shares,engagements=excluded.engagements,updated_at=excluded.updated_at`)
       .bind(p.id,'x','x_csv',p.external_id,p.text,p.url,classify(p.text).category,'published',p.published_at,...METRICS.map(k=>p[k]),stamp,stamp).run();
      await addSnapshot(db,p.id,p,stamp);count++;
    }
  }else{
    for(const row of csv.records){
      if(!row.Date)continue;
      const p=normalizeDay(row);
      await db.prepare(`INSERT INTO x_daily (day,impressions,likes,engagements,replies,reposts,bookmarks,profile_visits,follows,unfollows,posts,imported_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET impressions=excluded.impressions,likes=excluded.likes,engagements=excluded.engagements,replies=excluded.replies,reposts=excluded.reposts,bookmarks=excluded.bookmarks,profile_visits=excluded.profile_visits,follows=excluded.follows,unfollows=excluded.unfollows,posts=excluded.posts,imported_at=excluded.imported_at`)
       .bind(p.day,p.impressions,p.likes,p.engagements,p.replies,p.reposts,p.bookmarks,p.profile_visits,p.follows,p.unfollows,p.posts,stamp).run(); count++;
    }
  }
  await db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(`x_${type}_last_import`,stamp,stamp).run();
  return {type,imported:count,at:stamp};
}
async function addSnapshot(db,id,metrics,stamp){
  await db.prepare(`INSERT OR REPLACE INTO snapshots (post_id,captured_at,views,likes,replies,reposts,quotes,shares,engagements) VALUES (?,?,?,?,?,?,?,?,?)`)
  .bind(id,stamp,...METRICS.map(k=>metrics[k]??null)).run();
}
export async function syncThreads(db,token){
  const result=await fetchThreads(token,50); const stamp=now();let enriched=0;
  for(const {post,metrics,metricError} of result.results){
    const found=await db.prepare("SELECT id FROM posts WHERE platform='threads' AND external_id=?").bind(String(post.id)).first();
    const id=found?.id||`threads:${post.id}`; const published=post.timestamp?new Date(post.timestamp).toISOString():stamp;
    await db.prepare(`INSERT INTO posts (id,platform,source,external_id,text,url,category,status,published_at,views,likes,replies,reposts,quotes,shares,engagements,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET text=excluded.text,url=excluded.url,published_at=excluded.published_at,category=CASE WHEN posts.category<>'未分類' OR EXISTS(SELECT 1 FROM settings WHERE key='category_manual:' || posts.id) THEN posts.category ELSE excluded.category END,views=COALESCE(excluded.views,posts.views),likes=COALESCE(excluded.likes,posts.likes),replies=COALESCE(excluded.replies,posts.replies),reposts=COALESCE(excluded.reposts,posts.reposts),quotes=COALESCE(excluded.quotes,posts.quotes),shares=COALESCE(excluded.shares,posts.shares),engagements=COALESCE(excluded.engagements,posts.engagements),status='published',error='',updated_at=excluded.updated_at`)
      .bind(id,'threads','threads_api',String(post.id),String(post.text||''),String(post.permalink||''),classify(post.text).category,'published',published,...METRICS.map(k=>metrics?.[k]??null),stamp,stamp).run();
    if(metrics){
      await addSnapshot(db,id,metrics,stamp);enriched++;
      // Replace legacy false-zero values with null when the API omits a field.
      const missing=METRICS.filter(key=>metrics[key]===null);
      if(missing.length)await db.prepare(`UPDATE posts SET ${missing.map(key=>`${key}=NULL`).join(',')} WHERE id=?`).bind(id).run();
    }
    // A failed refresh must not erase the last successful measurements.
    // Persist the last error for the UI and clear it only on a clean refresh.
    const error=metrics===null?`指標取得失敗: ${metricError||'原因不明'}`:(metricError||'');
    await db.prepare("UPDATE posts SET error=? WHERE id=? AND status='published'").bind(error.slice(0,350),id).run();
  }
  await db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('threads_last_sync',stamp,stamp).run();
  return {username:result.username,posts:result.results.length,insights:enriched,warnings:result.warnings,syncedAt:stamp};
}
export async function dashboard(db){
  const [posts,daily,settings,counts,metricDates]=await Promise.all([
    db.prepare('SELECT * FROM posts ORDER BY COALESCE(published_at,scheduled_at,created_at) DESC LIMIT 250').all(),
    db.prepare('SELECT * FROM x_daily ORDER BY day DESC LIMIT 120').all(),
    db.prepare('SELECT * FROM settings').all(),
    db.prepare('SELECT platform, status, COUNT(*) total FROM posts GROUP BY platform,status').all(),
    db.prepare('SELECT post_id,MAX(captured_at) AS last_metrics_at FROM snapshots GROUP BY post_id').all()
  ]);
  const prefs=Object.fromEntries((settings.results||[]).map(x=>[x.key,x.value]));
  const lastMetrics=Object.fromEntries((metricDates.results||[]).map(x=>[x.post_id,x.last_metrics_at]));
  const enrichedPosts=(posts.results||[]).map(p=>({
    ...p,
    // Historical X records also receive the correction, without a forced reimport.
    published_at:p.platform==='x'&&p.source==='x_csv'&&p.published_at?p.published_at.slice(0,10):p.published_at,
    topic:prefs[`topic:${p.id}`]||classify(p.text).topic,
    last_metrics_at:lastMetrics[p.id]||null
  }));
  return {posts:enrichedPosts,daily:daily.results||[],settings:prefs,counts:counts.results||[]};
}
export async function saveDraft(db,input,existing=null){
  const platform=String(input.platform||existing?.platform||'');
  if(!['threads','x'].includes(platform)) throw Object.assign(new Error('SNSの種類を選択してください。'),{status:400});
  const text=String(input.text??existing?.text??'').trim();
  if(!text || text.length>500)throw Object.assign(new Error('本文は1〜500文字にしてください。'),{status:400});
  const requestedSchedule=Object.prototype.hasOwnProperty.call(input,'scheduled_at')?input.scheduled_at:existing?.scheduled_at;
  const scheduled=String(requestedSchedule??'').trim();
  if(scheduled && (!Number.isFinite(Date.parse(scheduled)) || Date.parse(scheduled)<Date.now()+60_000))throw Object.assign(new Error('予約時刻は現在より1分以上先を指定してください。'),{status:400});
  const status=scheduled?(platform==='threads'?'scheduled':'planned'):'draft';
  const selected=String(input.category??existing?.category??'未分類');
  const category=(selected==='未分類'?classify(text).category:selected).slice(0,40);
  const stamp=now();
  if(existing){
    await db.prepare(`UPDATE posts SET text=?,category=?,status=?,scheduled_at=?,error='',updated_at=? WHERE id=?`).bind(text,category,status,scheduled||null,stamp,existing.id).run();
    return {id:existing.id,status};
  }
  const id=crypto.randomUUID();
  await db.prepare(`INSERT INTO posts(id,platform,source,text,category,status,scheduled_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,platform,'app',text,category,status,scheduled||null,stamp,stamp).run();
  return {id,status};
}
export async function performPublish(db,token,id){
  // CAS ensures only one scheduled handler or manual action may publish.
  const claim=await db.prepare("UPDATE posts SET status='publishing',error='',updated_at=? WHERE id=? AND platform='threads' AND status IN ('draft','scheduled','failed')").bind(now(),id).run();
  if(!claim.meta?.changes)throw Object.assign(new Error('投稿は公開対象ではありません。'),{status:409});
  const post=await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
  try {
    const external=await publishThreads(token,post.text);
    // Persist final external ID; if sync runs simultaneously it will upsert id threads:external.
    await db.prepare("UPDATE posts SET status='published',external_id=?,published_at=?,updated_at=?,error='' WHERE id=?").bind(external,now(),now(),id).run();
    return {id,external_id:external};
  } catch(err){
    // Even if container or publish call timed out, outcome may be ambiguous: NEVER auto-retry.
    await db.prepare("UPDATE posts SET status='needs_review',error=?,updated_at=? WHERE id=?").bind(String(err.message||'公開確認が必要です').slice(0,350),now(),id).run();
    throw Object.assign(new Error(`自動再投稿は行いません。Threads側を確認してください: ${err.message}`),{status:502});
  }
}
export async function runScheduled(db,token){
  const due=await db.prepare("SELECT id FROM posts WHERE platform='threads' AND status='scheduled' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 10").bind(now()).all();
  const results=[];
  for(const item of due.results||[]){try{results.push({id:item.id,ok:true,...await performPublish(db,token,item.id)});}catch(e){results.push({id:item.id,ok:false,error:String(e.message)});}}
  return results;
}
export async function classifyExisting(db){
  const rows=await db.prepare("SELECT id,text FROM posts WHERE category='未分類' AND NOT EXISTS(SELECT 1 FROM settings WHERE key='category_manual:' || posts.id) LIMIT 2000").all();
  let updated=0;
  for(const p of rows.results||[]){
    const kind=classify(p.text).category;
    await db.prepare("UPDATE posts SET category=?,updated_at=? WHERE id=? AND category='未分類'").bind(kind,now(),p.id).run();
    updated++;
  }
  return {checked:(rows.results||[]).length,updated};
}
export async function fetchPost(db,id){return db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();}
