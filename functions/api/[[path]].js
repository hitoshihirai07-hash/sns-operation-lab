import {respond,fail,importCSV,syncThreads,dashboard,saveDraft,performPublish,fetchPost} from '../../lib/service.js';
import {graph} from '../../lib/meta.js';
const bad=(text,status=400)=>Object.assign(new Error(text),{status});
async function jsonBody(request){
  if(Number(request.headers.get('content-length'))>20000)throw bad('入力が大きすぎます。',413);
  const input=await request.text();if(input.length>20000)throw bad('入力が大きすぎます。',413);
  try {return JSON.parse(input);}catch {throw bad('JSON形式が不正です。');}
}
export async function onRequest({request,env}){
  if(!env.DB)return respond({error:'D1（DB）の設定がありません。'},503);
  const url=new URL(request.url),route=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  try{
    if(request.method==='GET' && route[0]==='health'){
      const data={db:true,threadsToken:Boolean(env.THREADS_ACCESS_TOKEN),cronConfigured:'Cron Workerは別途デプロイが必要'};
      if(url.searchParams.get('check')==='1'&&env.THREADS_ACCESS_TOKEN){
        try{const me=await graph('/me',env.THREADS_ACCESS_TOKEN,{fields:'id,username'});data.threadsConnected=true;data.username=me.username;}
        catch(e){data.threadsConnected=false;data.message=e.message;}
      }
      return respond(data);
    }
    if(request.method==='GET'&&route[0]==='dashboard')return respond(await dashboard(env.DB));
    if(request.method==='POST'&&route[0]==='x'&&route[1]==='import'){
      if(!request.headers.get('content-type')?.startsWith('text/csv'))throw bad('CSVファイルのみ受け付けます。');
      if(Number(request.headers.get('content-length'))>2_000_000)throw bad('CSVは2MB以下にしてください。',413);
      const contents=await request.text();return respond(await importCSV(env.DB,contents));
    }
    if(request.method==='POST'&&route[0]==='threads'&&route[1]==='sync'){
      if(!env.THREADS_ACCESS_TOKEN)throw bad('THREADS_ACCESS_TOKEN を設定してください。',503);
      return respond(await syncThreads(env.DB,env.THREADS_ACCESS_TOKEN));
    }
    if(request.method==='GET'&&route[0]==='posts'&&route[1]&&route[2]==='history'){
      const post=await fetchPost(env.DB,route[1]);if(!post)throw bad('投稿が見つかりません。',404);
      const history=await env.DB.prepare('SELECT * FROM snapshots WHERE post_id=? ORDER BY captured_at DESC LIMIT 100').bind(post.id).all();
      return respond({post,history:history.results||[]});
    }
    if(request.method==='POST'&&route[0]==='posts'&&route[1]&&route[2]==='publish'){
      const item=await fetchPost(env.DB,route[1]);if(!item)throw bad('投稿が見つかりません。',404);
      if(item.source!=='app'||item.platform!=='threads')throw bad('この投稿はアプリから公開できません。',409);
      return respond(await performPublish(env.DB,env.THREADS_ACCESS_TOKEN,route[1]));
    }
    if(request.method==='POST'&&route[0]==='posts'&&route.length===1){return respond(await saveDraft(env.DB,await jsonBody(request)),201);}
    if(request.method==='PUT'&&route[0]==='posts'&&route[1]&&route.length===2){
      const old=await fetchPost(env.DB,route[1]);if(!old)throw bad('投稿が見つかりません。',404);
      if(old.source!=='app'||!['draft','scheduled','planned','cancelled','failed'].includes(old.status))throw bad('公開済み・確認待ちの投稿は変更できません。',409);
      return respond(await saveDraft(env.DB,await jsonBody(request),old));
    }
    if(request.method==='POST'&&route[0]==='posts'&&route[1]&&route[2]==='category'){
      const old=await fetchPost(env.DB,route[1]);if(!old)throw bad('投稿が見つかりません。',404);
      const body=await jsonBody(request), category=String(body.category||'').trim();
      if(!['未分類','質問型','予想型','意見型','速報型','記事紹介型','その他'].includes(category))throw bad('分類が不正です。');
      await env.DB.prepare('UPDATE posts SET category=?,updated_at=? WHERE id=?').bind(category,new Date().toISOString(),old.id).run();
      return respond({id:old.id,category});
    }
    if(request.method==='POST'&&route[0]==='posts'&&route[1]&&route[2]==='cancel'){
      const old=await fetchPost(env.DB,route[1]);if(!old)throw bad('投稿が見つかりません。',404);
      if(old.source!=='app'||!['draft','scheduled','planned','failed'].includes(old.status))throw bad('この投稿はキャンセルできません。',409);
      await env.DB.prepare("UPDATE posts SET status='cancelled',scheduled_at=NULL,updated_at=? WHERE id=?").bind(new Date().toISOString(),old.id).run();
      return respond({id:old.id,status:'cancelled'});
    }
    return respond({error:'APIが見つかりません。'},404);
  }catch(error){return fail(error);}
}
