const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('public/admin/smart-entry.js','utf8'), sandbox);
const parse = sandbox.window.CFISmartPunch.parse;
const week = ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'];

test('chronologically sorts speech transcription before alternating IN and OUT', () => {
  const r = parse('Monday, October 26: 7:20 am, 10:34 am, 11:40 am, 5:32 pm, 3:31 pm, 4:05 pm',week);
  assert.equal(r.errors.length,0);
  assert.equal(r.warnings.length,1);
  assert.deepEqual(Array.from(r.days[0].punches,p=>p.kind+' '+p.label),[
    'IN 7:20 AM','OUT 10:34 AM','IN 11:40 AM','OUT 3:31 PM','IN 4:05 PM','OUT 5:32 PM'
  ]);
});
test('interprets multiple days in one dictation',()=>{
  const r=parse('Monday October 26: 7:21 AM, 3:24 PM. Tuesday October 27: 8 AM, 5 PM.',week);
  assert.equal(r.errors.length,0);
  assert.deepEqual(Array.from(r.days,d=>d.date),['2026-10-26','2026-10-27']);
});
test('accepts weekday without repeating month and date',()=>{
  const r=parse('Wednesday: 7:30 AM, 4 PM',week);
  assert.equal(r.errors.length,0);
  assert.equal(r.days[0].date,'2026-10-28');
});
test('rejects incomplete, duplicate, undated or ambiguous entries',()=>{
  for(const input of [
    'Thursday October 29: 7 AM, 12 PM, 1 PM',
    'Friday October 30: 8 AM, 8 AM',
    'Monday October 26: 7:20, 5:30',
    '7:20 AM, 5:30 PM',
    'Monday November 2: 8 AM, 5 PM'
  ]) assert.ok(parse(input,week).errors.length>0,input);
});


test('accepts ordinary bulleted and numbered dictated timecards',()=>{
  const examples=[
    '- October 26: 7:33 am, 11:41 am, 12:40 pm, 5:30 pm.\n- October 27: 7:39 am, 12:11 pm, 1:25 pm, 5:34 pm.',
    '• October 26: 7:33 AM, 5:30 PM\n• October 27: 8 AM, 5 PM',
    '1. October 26: 7:33 AM, 5:30 PM\n2. October 27: 8 AM, 5 PM'
  ];
  for(const input of examples){
    const r=parse(input,week);
    assert.deepEqual(Array.from(r.errors),[]);
    assert.deepEqual(Array.from(r.days,d=>d.date),['2026-10-26','2026-10-27']);
  }
});
