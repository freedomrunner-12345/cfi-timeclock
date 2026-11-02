/* CFI Smart Punch interpreter. No server calls, no automatic writes. */
(function () {
  'use strict';
  const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthPattern=months.map(m=>m+'|'+m.slice(0,3)).join('|');
  const datePattern=new RegExp('\\b(?:(?:'+weekdays.join('|')+')(?:\\s*,?\\s*(?:(?:'+monthPattern+')\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?))?|(?:'+monthPattern+')\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)\\b','gi');
  const timePattern=/\b(?:1[0-2]|0?[1-9])(?:\s*:\s*[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|\b(?:noon|midnight)\b/gi;
  const dayName=iso=>weekdays[new Date(iso+'T12:00:00Z').getUTCDay()];
  const format=n=>(Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+' '+(n>=720?'PM':'AM');
  function parseTime(raw){
    const v=raw.toLowerCase().replace(/[.\s]/g,'');
    if(v==='noon')return 720;
    if(v==='midnight')return 0;
    const m=v.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
    if(!m)return null;
    const h=Number(m[1]),min=Number(m[2]||0);
    if(h<1||h>12||min>59)return null;
    return (h%12+(m[3]==='pm'?12:0))*60+min;
  }
  function resolveDate(label,eligible){
    const l=label.toLowerCase().replace(/\b(\d+)(st|nd|rd|th)\b/g,'$1').replace(/,/g,' ').replace(/\s+/g,' ').trim();
    const weekday=weekdays.find(d=>new RegExp('\\b'+d+'\\b').test(l));
    const month=months.findIndex(m=>new RegExp('\\b(?:'+m+'|'+m.slice(0,3)+')\\.?\\s+\\d{1,2}\\b').test(l));
    let monthNumber=null,dayNumber=null,year=null;
    if(month>=0){
      const m=l.match(new RegExp('\\b(?:'+months[month]+'|'+months[month].slice(0,3)+')\\.?\\s+(\\d{1,2})\\b'));
      monthNumber=month+1;dayNumber=Number(m[1]);
    }else{
      const slash=l.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if(slash){monthNumber=Number(slash[1]);dayNumber=Number(slash[2]);if(slash[3])year=Number(slash[3].length===2?'20'+slash[3]:slash[3]);}
    }
    const matches=eligible.filter(d=>(!weekday||dayName(d)===weekday)&&(!monthNumber||(Number(d.slice(5,7))===monthNumber&&Number(d.slice(8,10))===dayNumber))&&(!year||Number(d.slice(0,4))===year));
    return matches.length===1?matches[0]:null;
  }
  function parse(text,eligible){
    const errors=[],warnings=[],days=[];
    const source=String(text||'').replace(/^[ \t]*(?:[-*•–—]|\d+[.)])[ \t]*(?=(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2})\b)/gim,'').trim();
    if(!source)return {days,errors:['Dictate or paste at least one dated entry.'],warnings};
    const found=[...source.matchAll(datePattern)];
    if(!found.length)return {days,errors:['Include a day or date before the times (for example, Monday October 26).'],warnings};
    if(source.slice(0,found[0].index).trim().replace(/[\s,:;.\-–—•*]/g,''))errors.push('Text before the first date could not be assigned to a workday.');
    const seen=new Set();
    for(let i=0;i<found.length;i++){
      const label=found[i][0];
      const date=resolveDate(label,eligible);
      if(!date){errors.push('Date "'+label+'" is not in the selected payroll week.');continue;}
      if(seen.has(date)){errors.push('The date '+date+' was dictated more than once; combine those entries first.');continue;}
      seen.add(date);
      const chunk=source.slice(found[i].index+label.length,i+1<found.length?found[i+1].index:source.length);
      const matches=[...chunk.matchAll(timePattern)];
      if(!matches.length){errors.push(label+': no valid AM/PM times found.');continue;}
      let remainder=chunk;
      for(let j=matches.length-1;j>=0;j--)remainder=remainder.slice(0,matches[j].index)+remainder.slice(matches[j].index+matches[j][0].length);
      remainder=remainder.replace(/\b(?:and|in|out|at|to|then|back|clock|from|on|the|punch|times)\b/gi,'').replace(/[\s,;:.\-–—•*]/g,'');
      if(remainder)errors.push(label+': unrecognized text "'+remainder.slice(0,60)+'". Check for missing AM/PM or transcription errors.');
      const original=matches.map(m=>parseTime(m[0]));
      if(original.some(v=>v===null)){errors.push(label+': an invalid time was detected.');continue;}
      if(original.length>40){errors.push(label+': maximum 40 punches per day.');continue;}
      if(original.length%2){errors.push(label+': '+original.length+' times found. Every IN needs a matching OUT.');continue;}
      const sorted=[...original].sort((a,b)=>a-b);
      if(sorted.some((v,j)=>j>0&&v===sorted[j-1])){errors.push(label+': duplicate time detected; check the card.');continue;}
      if(original.some((v,j)=>v!==sorted[j]))warnings.push(label+': times were reordered chronologically.');
      days.push({date,punches:sorted.map((minutes,j)=>({kind:j%2?'OUT':'IN',minutes,label:format(minutes)}))});
    }
    if(!days.length&&!errors.length)errors.push('No punch pairs found.');
    return {days,errors,warnings};
  }
  window.CFISmartPunch={parse};
})();
