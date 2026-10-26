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
  const users=store.all('SELECT id,name,preferred_name FROM users ORDER BY name COLLATE NOCASE');
  const employeeData=users.map(u=>{
   const flag=store.one('SELECT enabled FROM employee_controls WHERE id=?',u.id);
   const punches=punchesFor(store,u.id,week);
   const totals=store.calculate(punches,week,today);
   const requests=store.all('SELECT id,date,hours,status,created_at FROM pto WHERE user_id=? AND date>=? AND date<=? ORDER BY date',u.id,week,sunday);
   const approvedPto=requests.filter(p=>p.status==='APPROVED').reduce((sum,p)=>sum+p.hours,0);
   return {id:u.id,name:u.name,preferredName:u.preferred_name||'',enabled:flag?.enabled!==0,totals,requests,approvedPto,punches};
  });
  return result({week,sunday,today,employees:employeeData});
 }
 if(route==='/api/admin/roster-import'&&method==='POST'){
  const data=await request.json();
  const rows=Array.isArray(data.employees)?data.employees:[];
  if(rows.length<1||rows.length>100)return error('Import must contain 1 to 100 employees');
  const ids=new Set();
  const normalized=[];
  for(const entry of rows){
   const employeeId=String(entry.id??'').trim(),name=String(entry.name??'').trim();
   if(!/^\d{1,12}$/.test(employeeId)||name.length<2||name.length>90)return error('Invalid employee in roster');
   if(ids.has(employeeId))return error('Duplicate ID in roster');
   ids.add(employeeId);
   normalized.push({id:employeeId,name,enabled:entry.enabled===true});
  }
  let added=0,existing=0;
  for(const e of normalized){
    const found=store.one('SELECT id FROM users WHERE id=?',e.id);
    if(found){existing++;continue;}
    store.db.exec('INSERT INTO users (id,name,salt,pin_hash,created_at) VALUES (?,?,?,?,?)',e.id,e.name,'','',new Date().toISOString());
    store.db.exec('INSERT OR REPLACE INTO employee_controls (id,enabled) VALUES (?,?)',e.id,e.enabled?1:0);
    added++;
  }
  store.audit('roster-import',{added,existing,total:rows.length},'admin');
  return result({ok:true,added,existing});
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
 if(route==='/api/admin/preferred-name'&&method==='POST'){
  const data=await request.json();
  const employeeId=String(data.id??'').trim();
  const preferredName=String(data.preferredName??'').trim();
  if(!/^\d{1,12}$/.test(employeeId))return error('Invalid employee ID');
  if(preferredName.length>60||/[<>\r\n\x00-\x1f]/.test(preferredName))return error('Preferred name must be up to 60 characters and contain no control characters');
  const employee=store.one('SELECT id,name,preferred_name FROM users WHERE id=?',employeeId);
  if(!employee)return error('Employee not found',404);
  store.db.exec('UPDATE users SET preferred_name=? WHERE id=?',preferredName,employeeId);
  store.audit('preferred-name-updated',{employeeId,previous:employee.preferred_name||'',updated:preferredName},'admin');
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
 if(route==='/api/admin/punch-batch'&&method==='POST'){
  // Only authenticated admin sessions can reach this handler.
  const data=await request.json(),employeeId=String(data.employeeId??'').trim();
  if(!/^\d{1,12}$/.test(employeeId)||!store.one('SELECT id FROM users WHERE id=?',employeeId))return error('Employee not found',404);
  const days=Array.isArray(data.days)?data.days:[{date:data.date,punches:data.punches}];
  if(!days.length||days.length>7)return error('Select 1–7 workdays');
  const seenDays=new Set(),normalized=[],taken=new Set(store.all('SELECT at FROM punches WHERE user_id=?',employeeId).map(p=>p.at));
  for(const day of days){
   const date=String(day?.date??'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||store.week(date)!==week||date>today||seenDays.has(date))return error('Choose unique dates within the selected payroll week');
   seenDays.add(date);
   const rows=day?.punches;
   if(!Array.isArray(rows)||rows.length<2||rows.length>40||rows.length%2)return error(date+': enter complete IN / OUT pairs (2–40 punches)');
   let previous=0;
   for(let i=0;i<rows.length;i++){
    const row=rows[i]||{},kind=i%2===0?'IN':'OUT',at=validStamp(row.at);
    if(row.kind!==kind)return error(date+': punches must alternate IN and OUT');
    if(!at)return error(date+': invalid or future time on line '+(i+1));
    const iso=at.toISOString();
    if(store.date(iso)!==date)return error(date+': line '+(i+1)+' belongs to a different Central Time day');
    if(at.getTime()<=previous)return error(date+': times must be chronological');
    if(taken.has(iso))return error(date+': duplicate punch at '+iso);
    previous=at.getTime();taken.add(iso);normalized.push({kind,at:iso,punchId:id()});
   }
  }
  if(normalized.length>120)return error('Limit is 120 punches per save');
  const now=new Date().toISOString();
  store.ctx.storage.transactionSync(()=>{
   for(const entry of normalized){
    store.db.exec('INSERT INTO punches(id,user_id,kind,at,created_at,corrected_at) VALUES (?,?,?,?,?,?)',entry.punchId,employeeId,entry.kind,entry.at,now,now);
    store.audit('admin-punch-added',{id:entry.punchId,employeeId,kind:entry.kind,at:entry.at,source:'quick-entry'},'admin');
   }
   store.db.exec('DELETE FROM sessions WHERE user_id=?',employeeId);
  });
  return result({ok:true,added:normalized.length,days:days.length});
 }
 if(route==='/api/admin/punch-add'&&method==='POST'){
  const data=await request.json();
  const employeeId=String(data.employeeId??'').trim();
  const kind=String(data.kind??'');
  const at=validStamp(data.at);
  if(!/^\d{1,12}$/.test(employeeId)||!['IN','OUT'].includes(kind)||!at)return error('Select a valid employee, punch type, date and time');
  if(!store.one('SELECT id FROM users WHERE id=?',employeeId))return error('Employee not found',404);
  const time=at.toISOString();
  const previous=store.all('SELECT kind,at FROM punches WHERE user_id=? ORDER BY at',employeeId);
  if(previous.some(p=>p.at===time))return error('A punch already exists at this exact time',409);
  // Administrators may restore an incomplete historical shift in any order.
  // Conflicting or unmatched punches are flagged by payroll review until resolved.
  const punchId=id(),now=new Date().toISOString();
  store.db.exec('INSERT INTO punches(id,user_id,kind,at,created_at,corrected_at) VALUES (?,?,?,?,?,?)',punchId,employeeId,kind,time,now,now);
  store.audit('admin-punch-added',{id:punchId,employeeId,kind,at:time},'admin');
  store.db.exec('DELETE FROM sessions WHERE user_id=?',employeeId);
  return result({ok:true,id:punchId});
 }
 if(route==='/api/admin/punch-delete'&&method==='POST'){
  const data=await request.json(),punchId=String(data.id??'');
  if(data.confirmation!=='DELETE')return error('Type DELETE to confirm');
  const punch=store.one('SELECT id,user_id,kind,at,created_at,corrected_at FROM punches WHERE id=?',punchId);
  if(!punch)return error('Punch not found',404);
  store.audit('admin-punch-deleted',{...punch},'admin');
  store.db.exec('DELETE FROM punches WHERE id=? AND user_id=?',punch.id,punch.user_id);
  store.db.exec('DELETE FROM sessions WHERE user_id=?',punch.user_id);
  return result({ok:true,deleted:1});
 }
 if(route==='/api/admin/punch-edit'&&method==='POST'){
  const data=await request.json();
  const entry=store.one('SELECT id,user_id,kind,at FROM punches WHERE id=?',String(data.id||''));
  if(!entry)return error('Punch not found',404);
  const next=validStamp(data.at);
  const kind=String(data.kind??'');
  if(!['IN','OUT'].includes(kind))return error('Choose Clock In or Clock Out');
  if(!next||store.date(next.toISOString())!==store.date(entry.at))return error('Correction must remain on the original workday');
  const time=next.toISOString();
  const conflict=store.one('SELECT id FROM punches WHERE user_id=? AND at=? AND id!=?',entry.user_id,time,entry.id);
  if(conflict)return error('Another punch already exists at this exact time',409);
  if(time===entry.at&&kind===entry.kind)return result({ok:true,unchanged:true});
  // Corrections may temporarily create unmatched or consecutive punch types.
  // The timecard calculation flags these sequences for payroll review.
  store.db.exec('UPDATE punches SET at=?,kind=?,corrected_at=? WHERE id=?',time,kind,new Date().toISOString(),entry.id);
  store.audit('punch-corrected',{id:entry.id,employeeId:entry.user_id,from:{kind:entry.kind,at:entry.at},to:{kind,at:time}},'admin');
  store.db.exec('DELETE FROM sessions WHERE user_id=?',entry.user_id);
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
