// Standalone visual theme scheduling: no payroll table reads, no migrations.
// Deliberately uses a new storage key so old holiday experiment settings cannot
// unexpectedly activate any theme. Original welcome is always the default.
export const WELCOME_THEMES=Object.freeze(['classic','thanksgiving','christmas','newyear','fourth']);
export const HOLIDAY_THEMES=Object.freeze(WELCOME_THEMES.slice(1));
export const DEFAULT_PLAN=Object.freeze({mode:'classic',theme:'classic',schedules:[]});
const isDate=value=>{
 if(typeof value!=='string'||!/^(20\d{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
};
export function normalizeWelcomePlan(raw){
 const mode=['classic','manual','scheduled'].includes(raw?.mode)?raw.mode:'classic';
 const theme=HOLIDAY_THEMES.includes(raw?.theme)?raw.theme:'classic';
 const schedules=Array.isArray(raw?.schedules)?raw.schedules.filter(x=>
  x&&HOLIDAY_THEMES.includes(x.theme)&&isDate(x.start)&&isDate(x.end)&&typeof x.repeat==='boolean'&&(x.repeat||x.start<=x.end)
 ).slice(0,4).map(x=>({theme:x.theme,start:x.start,end:x.end,repeat:x.repeat})):[];
 return {mode,theme,schedules};
}
export function validateWelcomePlan(raw){
 if(!raw||typeof raw!=='object'||!['classic','manual','scheduled'].includes(raw.mode))
  throw Error('Choose Classic CFI, Show Now, or Follow Schedule.');
 if(!WELCOME_THEMES.includes(raw.theme))throw Error('Choose an available welcome theme.');
 if(!Array.isArray(raw.schedules)||raw.schedules.length>4)throw Error('You can schedule up to four holiday themes.');
 const seen=new Set();
 for(const item of raw.schedules){
  if(!item||!HOLIDAY_THEMES.includes(item.theme)||seen.has(item.theme))
   throw Error('Each holiday can have one schedule.');
  seen.add(item.theme);
  if(!isDate(item.start)||!isDate(item.end))throw Error('Enter valid start and end dates.');
  if(typeof item.repeat!=='boolean')throw Error('Choose whether the dates repeat yearly.');
  if(!item.repeat&&item.end<item.start)throw Error('End date must be on or after start date.');
 }
 if(raw.mode==='manual'&&!HOLIDAY_THEMES.includes(raw.theme))
  throw Error('Select a holiday to show now.');
 return normalizeWelcomePlan(raw);
}
function centralDate(date){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function activeWelcomeTheme(plan,date=new Date()){
 const s=normalizeWelcomePlan(plan);
 if(s.mode==='classic')return 'classic';
 if(s.mode==='manual')return s.theme;
 const today=centralDate(date),md=today.slice(5);
 // In a rare overlap, a later theme row has priority. New Year can override
 // Christmas on Dec 31 if the user explicitly schedules both.
 let active='classic';
 for(const entry of s.schedules){
  const match=entry.repeat?
   (entry.start.slice(5)<=entry.end.slice(5)?
      md>=entry.start.slice(5)&&md<=entry.end.slice(5):
      md>=entry.start.slice(5)||md<=entry.end.slice(5)):
   today>=entry.start&&today<=entry.end;
  if(match)active=entry.theme;
 }
 return active;
}
