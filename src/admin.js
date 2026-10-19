import { adminOps } from './admin-ops.js';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const error=(msg,status=400)=>respond({error:msg},status);
const newId=()=>crypto.randomUUID();
const hex=buf=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const passwordHash=async(password,salt)=>{
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256));
};
const equal=(a,b)=>a.length===b.length&&[...a].reduce((v,c,i)=>v|(c.charCodeAt(0)^b.charCodeAt(i)),0)===0;
const adminCookie=(value,clear=false)=>'cfi_admin='+value+'; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; '+(clear?'Max-Age=0':'Max-Age=43200');
const adminSession=async store=>{
 const token=newId()+newId();
 store.db.exec('INSERT INTO admin_sessions (token_hash,expires_at) VALUES (?,?)',await sha(token),new Date(Date.now()+12*3600000).toISOString());
 const response=respond({ok:true});
 response.headers.set('Set-Cookie',adminCookie(token));
 return response;
};
export async function handleAdmin(store,request){
 const url=new URL(request.url),route=url.pathname;
 const config=store.one('SELECT id,salt,password_hash FROM admins WHERE id=?','owner');
 if(route==='/api/admin/config'&&request.method==='GET')return respond({configured:!!config});
 if(route==='/api/admin/setup'&&request.method==='POST'){
  if(config)return error('Administrator account already exists',409);
  const data=await request.json(),password=String(data.password||'');
  if(password.length<10||password.length>128)return error('Use a password of at least 10 characters');
  const salt=newId();
  store.db.exec('INSERT INTO admins(id,salt,password_hash,created_at) VALUES (?,?,?,?)','owner',salt,await passwordHash(password,salt),new Date().toISOString());
  store.audit('admin-created',{},'admin');
  return adminSession(store);
 }
 if(route==='/api/admin/login'&&request.method==='POST'){
  const cutoff=new Date(Date.now()-15*60000).toISOString();
  store.db.exec('DELETE FROM admin_attempts WHERE at<?',cutoff);
  if(store.one('SELECT COUNT(*) AS n FROM admin_attempts').n>=6)return error('Too many attempts. Try again in 15 minutes.',429);
  const data=await request.json(),password=String(data.password||'');
  let valid=false;
  if(config&&password.length<=128)valid=equal(await passwordHash(password,config.salt),config.password_hash);
  if(!valid){
   store.db.exec('INSERT INTO admin_attempts (id,at) VALUES (?,?)',newId(),new Date().toISOString());
   return error('Incorrect password',401);
  }
  store.db.exec('DELETE FROM admin_attempts');
  return adminSession(store);
 }
 const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)cfi_admin=([^;]+)/)?.[1];
 if(route==='/api/admin/logout'&&request.method==='POST'){
  if(token)store.db.exec('DELETE FROM admin_sessions WHERE token_hash=?',await sha(token));
  const response=respond({ok:true});response.headers.set('Set-Cookie',adminCookie('',true));return response;
 }
 if(!config||!token)return error('Administrator sign-in required',401);
 const validSession=store.one('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?',await sha(token),new Date().toISOString());
 if(!validSession)return error('Administrator sign-in required',401);
 if(route==='/api/admin/session'&&request.method==='GET')return respond({authenticated:true});
 return adminOps(store,request);
}
