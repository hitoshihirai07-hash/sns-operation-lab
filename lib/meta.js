const HOST = 'https://graph.threads.net';
const FIELDS = 'id,permalink,text,timestamp,username,media_type';
const METRICS = 'views,likes,replies,reposts,quotes,shares';
export async function graph(path, token, params = {}, method='GET') {
  if (!token) throw new Error('THREADS_ACCESS_TOKEN が設定されていません。');
  const url = new URL(path,HOST);
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k,String(v));
  const response = await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
  const payload = await response.json().catch(()=>null);
  if (!response.ok || payload?.error) {
    const error = payload?.error;
    // 運用者が判断できるように、Metaのエラーだけを表示する。トークンはURLに含めない。
    throw new Error(`Meta API ${response.status}: ${String(error?.message || '接続に失敗しました').slice(0,300)}`);
  }
  return payload || {};
}
function value(item) {
  const raw=item?.total_value?.value;
  if(raw!==null && raw!==undefined && raw!==''){
    const num=Number(raw);if(Number.isFinite(num))return num;
  }
  const vals=item?.values;
  if(Array.isArray(vals) && vals.length){
    const nums=vals.filter(x=>x?.value!==null&&x?.value!==undefined&&x?.value!=='').map(x=>Number(x.value)).filter(Number.isFinite);
    if(nums.length)return nums.reduce((a,b)=>a+b,0);
  }
  return null;
}
export async function fetchThreads(token, limit=40) {
  const [profile,feed] = await Promise.all([
    graph('/me',token,{fields:'id,username'}),
    graph('/me/threads',token,{fields:FIELDS,limit:Math.min(100,limit)})
  ]);
  const posts = (feed.data || []).filter(p=>p?.id);
  const results=[];
  const errors=[];
  for(let i=0;i<posts.length;i+=6){
    const batch=await Promise.all(posts.slice(i,i+6).map(async p=>{
      try {
        const out=await graph(`/${encodeURIComponent(p.id)}/insights`,token,{metric:METRICS});
        const values=Object.fromEntries(METRICS.split(',').map(m=>[m,null]));
        for(const item of out.data||[]) if(item?.name in values) values[item.name]=value(item);
        const missing=Object.entries(values).filter(([,v])=>v===null).map(([k])=>k);
        return { post:p, metrics:values, metricError:missing.length?`APIが返さなかった指標: ${missing.join(', ')}`:null };
      } catch(err) {errors.push(String(err.message));return {post:p,metrics:null,metricError:String(err.message)};}
    }));
    results.push(...batch);
  }
  return { username:String(profile.username||''), results, warnings:[...new Set(errors)].slice(0,3) };
}
export async function publishThreads(token,text) {
  // Two-step publish to distinguish container creation from public posting.
  const create = await graph('/me/threads',token,{media_type:'TEXT',text},'POST');
  if (!create.id) throw new Error('Metaが投稿コンテナIDを返しませんでした。');
  try {
    const publish = await graph('/me/threads_publish',token,{creation_id:create.id},'POST');
    if (!publish.id) throw new Error('Metaが公開済み投稿IDを返しませんでした。');
    return String(publish.id);
  } catch (error) {
    // Do not retry automatically; API request may have succeeded remotely.
    error.uncertainPublication = true;
    throw error;
  }
}
