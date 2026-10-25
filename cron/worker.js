import {runScheduled,syncThreads} from '../lib/service.js';
export default {
  async scheduled(event,env,ctx){
    if(!env.DB||!env.THREADS_ACCESS_TOKEN){console.error('DB or THREADS_ACCESS_TOKEN missing');return;}
    ctx.waitUntil((async()=>{
      const outcome=await runScheduled(env.DB,env.THREADS_ACCESS_TOKEN);
      if(outcome.length)console.log('scheduled-result',JSON.stringify(outcome.map(({id,ok})=>({id,ok}))));
      // Once every six hours (UTC); metrics sync is separate from minute-level publish checks.
      if(new Date(event.scheduledTime).getUTCHours()%6===0 && new Date(event.scheduledTime).getUTCMinutes()===0){
        try{const result=await syncThreads(env.DB,env.THREADS_ACCESS_TOKEN);console.log('threads-sync',result.posts,result.insights);}catch(e){console.error('threads-sync-failed',e.message);}
      }
    })());
  },
  async fetch(){return new Response('Scheduled worker only',{status:404});}
};
