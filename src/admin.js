import { adminOps } from './admin-ops.js';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const error=(message,status=400)=>respond({error:message},status);
const newId=()=>crypto.randomUUID();
const hex=buf=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const equal=(a,b)=>a.length===b.length&&[...a].reduce((v,c,i)=>v|(c.charCodeAt(0)^b.charCodeAt(i)),0)===0;
const adminCookie=(value,clear=false)=>'cfi_admin='+value+'; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; '+(clear?'Max-Age=0':'Max-Age=43200');
const secretFor=store=>typeof store.env.ADMIN_PASSWORD==='string' && store.env.ADMIN_PASSWORD.length>=12 && store.env.ADMIN_PASSWORD.length<=128 ? store.env.ADMIN_PASSWORD : null;
const tokenHash=async(token,secret)=>sha(token+'|'+secret);
const adminSession=async(store,secret)=>{
 const token=newId()+newId();
 store.db.exec('INSERT INTO admin_sessions (token_hash,expires_at) VALUES (?,?)',await tokenHash(token,secret),new Date(Date.now()+12*3600000).toISOString());
 const response=respond({ok:true});
 response.headers.set('Set-Cookie',adminCookie(token));
 return response;
};
export async function handleAdmin(store,request){
 const url=new URL(request.url),route=url.pathname,secret=secretFor(store);
 if(route==='/api/admin/config'&&request.method==='GET')return respond({configured:!!secret,usesCloudflareSecret:true});
 if(route==='/api/admin/setup')return error('Set ADMIN_PASSWORD in Cloudflare Worker secrets instead of using public setup',404);
 if(route==='/api/admin/login'&&request.method==='POST'){
  if(!secret)return error('Set a 12–128 character ADMIN_PASSWORD secret in Cloudflare Worker settings',503);
  const cutoff=new Date(Date.now()-15*60000).toISOString();
  store.db.exec('DELETE FROM admin_attempts WHERE at<?',cutoff);
  if(store.one('SELECT COUNT(*) AS n FROM admin_attempts').n>=6)return error('Too many attempts. Try again in 15 minutes.',429);
  const data=await request.json(),password=String(data.password||'');
  const valid=password.length<=128 && equal(await sha(password),await sha(secret));
  if(!valid){
   store.db.exec('INSERT INTO admin_attempts (id,at) VALUES (?,?)',newId(),new Date().toISOString());
   return error('Incorrect admin password',401);
  }
  store.db.exec('DELETE FROM admin_attempts');
  return adminSession(store,secret);
 }
 const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)cfi_admin=([^;]+)/)?.[1];
 if(route==='/api/admin/logout'&&request.method==='POST'){
  if(token&&secret)store.db.exec('DELETE FROM admin_sessions WHERE token_hash=?',await tokenHash(token,secret));
  const response=respond({ok:true});response.headers.set('Set-Cookie',adminCookie('',true));return response;
 }
 if(!secret)return error('Admin password is not configured in Cloudflare Worker settings',503);
 if(!token)return error('Administrator sign-in required',401);
 const validSession=store.one('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?',await tokenHash(token,secret),new Date().toISOString());
 if(!validSession)return error('Administrator sign-in required',401);
 if(route==='/api/admin/session'&&request.method==='GET')return respond({authenticated:true});
 return adminOps(store,request);
}
