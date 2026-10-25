const deny = (status,message,extra={})=>new Response(message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','WWW-Authenticate':'Basic realm="SNS Operation Lab"',...extra}});
function equal(a,b){let diff=a.length^b.length;const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export async function onRequest({request,env,next}){
  if(!env.ADMIN_USER||!env.ADMIN_PASSWORD)return deny(503,'ADMIN_USER と ADMIN_PASSWORD をCloudflareに設定してください。');
  let credentials;
  try{const header=request.headers.get('Authorization')||'';credentials=header.startsWith('Basic ')?atob(header.slice(6)):'';}catch{credentials='';}
  const sep=credentials.indexOf(':');
  const user=sep<0?'':credentials.slice(0,sep);const pass=sep<0?'':credentials.slice(sep+1);
  if(!equal(user,String(env.ADMIN_USER))||!equal(pass,String(env.ADMIN_PASSWORD)))return deny(401,'認証が必要です。');
  const response=await next();const headers=new Headers(response.headers);
  headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');
  headers.set('Content-Security-Policy',"default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
