const result=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const error=(message,status=400)=>result({error:message},status);
const id=()=>crypto.randomUUID();
const csvCell=value=>'"'+String(value??'').replaceAll('"','""').replace(/^([=+@-])/,"'$1")+'"';
const validStamp=(value)=>{const d=new Date(value);return Number.isFinite(d.getTime())&&d.getTime()<=Date.now()?d:null;};
const punchesFor=(store,emp,week)=>store.all('SELECT id,kind,at,corrected_at FROM punches WHERE user_id=? ORDER BY at',emp).filter(x=>store.week(store.date(x.at))===week);
export async function adminOps(store,request){
 const url=new URL(request.url),route=url.pathname,method=request.method;
 const today=store.date(new Date().toISOString());
 const asked=url.searchParams.get('week');
 const week=asked&&/^\d{4}-\d{2}-\d{2}$/.test(asked)&&store.week(asked)===asked?asked:store.week(today);
 const sunday=store.endWeek(week);
 if(route==='/api/admin/state'&&method==='GET'){
  const users=store.all('SELECT id,name FROM users ORDER BY name COLLATE NOCASE');
  const employeeData=users.map(u=>{
   const flag=store.one('SELECT enabled FROM employee_controls WHERE id=?',u.id);
   const punches=punchesFor(store,u.id,week);
   const totals=store.calculate(punches,week,today);
   const requests=store.all('SELECT id,date,hours,status,created_at FROM pto WHERE user_id=? AND date>=? AND date<=? ORDER BY date',u.id,week,sunday);
   const approvedPto=requests.filter(p=>p.status==='APPROVED').reduce((sum,p)=>sum+p.hours,0);
   return {id:u.id,name:u.name,enabled:flag?.enabled!==0,totals,requests,approvedPto,punches};
  });
  return result({week,sunday,today,employees:employeeData});
 }
 if(route==='/api/admin/employee'&&method==='POST'){
  const data=await request.json(),employeeId=String(data.id||'').trim(),name=String(data.name||'').trim();
  if(!/^\d{1,12}$/.test(employeeId)||name.length<2||name.length>90)return error('Enter a valid employee ID and name');
  if(store.one('SELECT id FROM users WHERE id=?',employeeId))return error('That employee ID is already registered',409);
  store.db.exec('INSERT INTO users (id,name,salt,pin_hash,created_at) VALUES (?,?,?,?,?)',employeeId,name,'','',new Date().toISOString());
  store.db.exec('INSERT OR REPLACE INTO employee_controls(id,enabled) VALUES (?,?)',employeeId,1);
  store.audit('employee-added',{employeeId,name},'admin');
  return result({ok:true});
 }
 if(route==='/api/admin/employee-status'&&method==='POST'){
  const data=await request.json(),employeeId=String(data.id||'');
  if(!store.one('SELECT id FROM users WHERE id=?',employeeId))return error('Employee not found',404);
  const enabled=data.enabled===true?1:0;
  store.db.exec('INSERT OR REPLACE INTO employee_controls (id,enabled) VALUES (?,?)',employeeId,enabled);
  if(!enabled)store.db.exec('DELETE FROM sessions WHERE user_id=?',employeeId);
  store.audit('employee-status',{employeeId,enabled:!!enabled},'admin');
  return result({ok:true});
 }
 if(route==='/api/admin/pto-review'&&method==='POST'){
  const data=await request.json(),status=String(data.status||''),requestId=String(data.id||'');
  if(!['APPROVED','DENIED','PENDING'].includes(status))return error('Unknown PTO status');
  const entry=store.one('SELECT id,user_id FROM pto WHERE id=?',requestId);
  if(!entry)return error('PTO request not found',404);
  store.db.exec('UPDATE pto SET status=?,reviewed_at=? WHERE id=?',status,new Date().toISOString(),requestId);
  store.audit('pto-reviewed',{requestId,employeeId:entry.user_id,status},'admin');
  return result({ok:true});
 }
 if(route==='/api/admin/punch-edit'&&method==='POST'){
  const data=await request.json(),entry=store.one('SELECT id,user_id,kind,at FROM punches WHERE id=?',String(data.id||''));
  if(!entry)return error('Punch not found',404);
  const next=validStamp(data.at);
  if(!next||store.date(next.toISOString())!==store.date(entry.at))return error('Correction must remain on the original workday');
  const list=store.all('SELECT id,kind,at FROM punches WHERE user_id=? ORDER BY at',entry.user_id).map(p=>p.id===entry.id?{...p,at:next.toISOString()}:p).sort((a,b)=>a.at.localeCompare(b.at));
  for(let i=0;i<list.length;i++)if((i>0&&list[i].kind===list[i-1].kind)||(i===0&&list[i].kind!=='IN')||(i>0&&list[i].at<=list[i-1].at))return error('Punch would overlap or be out of order');
  store.db.exec('UPDATE punches SET at=?,corrected_at=? WHERE id=?',next.toISOString(),new Date().toISOString(),entry.id);
  store.audit('punch-corrected',{id:entry.id,employeeId:entry.user_id,from:entry.at,to:next.toISOString()},'admin');
  return result({ok:true});
 }
 if(route==='/api/admin/export'&&method==='GET'){
  const users=store.all('SELECT id,name FROM users ORDER BY name COLLATE NOCASE');
  const lines=['Employee ID,Employee,Week Start,Regular Hours,Overtime Hours,Approved PTO,Worked Hours,Needs Review'];
  for(const u of users){
   const t=store.calculate(punchesFor(store,u.id,week),week,today);
   const pto=store.all("SELECT hours FROM pto WHERE user_id=? AND date>=? AND date<=? AND status='APPROVED'",u.id,week,sunday).reduce((sum,r)=>sum+r.hours,0);
   lines.push([csvCell(u.id),csvCell(u.name),week,t.regularHours.toFixed(2),t.overtimeHours.toFixed(2),pto.toFixed(2),t.workedHours.toFixed(2),t.warnings.length?'YES':'NO'].join(','));
  }
  return new Response(lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cfi-payroll-'+week+'.csv"','Cache-Control':'no-store'}});
 }
 if(route==='/api/admin/audit'&&method==='GET'){
  const entries=store.all('SELECT id,user_id,action,detail,at FROM audit ORDER BY at DESC LIMIT 100');
  return result({entries});
 }
 return error('Not found',404);
}
