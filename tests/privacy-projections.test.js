const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const agenda = read('js/agenda.js');
const journey = read('spiritual-progress.js');
const profile = read('js/profile.js');
const agendaBlock = agenda.slice(agenda.indexOf('function attendanceSummary('), agenda.indexOf('async function confirmAttendance('));
const rankBlock = journey.slice(journey.indexOf('  async function getRanking()'), journey.indexOf('  function getEarnedMedals('));

(async () => {
  const calls = [];
  const rows = [{ event_id: 'event-1', confirmed_count: '12', has_confirmed: true }];
  const ranking = [{ user_id: 'member-1', xp: 120, total_points: 120, streak_days: 3 }];
  const context = {
    window: { supabaseClient: { from(name) {
      calls.push(name);
      return {
        select(columns) {
          calls.push(columns);
          return {
            in(column, ids) { calls.push([column, ...ids]); return Promise.resolve({ data: rows }); },
            order() { return this; },
            limit() { return Promise.resolve({ data: ranking }); }
          };
        }
      };
    } } },
    console: { error() {}, warn() {} },
    rankingCache: []
  };
  vm.createContext(context);
  vm.runInContext(agendaBlock + '\n' + rankBlock + '\nthis.check = { attendanceSummary, attendanceCountLabel, fetchAttendancesForEvents, getRanking };', context);
  const { attendanceSummary, attendanceCountLabel, fetchAttendancesForEvents, getRanking } = context.check;
  assert.equal(attendanceSummary(rows).count, 12);
  assert.equal(attendanceSummary(rows).confirmed, true);
  assert.equal(attendanceSummary([{ confirmed_count: -5 }]).count, 0);
  assert.equal(attendanceSummary([{ user_id: 'legacy-user' }]).count, 0);
  assert.equal(attendanceSummary([]).confirmed, false);
  assert.equal(attendanceCountLabel(1), '1 pessoa confirmou');
  assert.equal(attendanceCountLabel(2), '2 pessoas confirmaram');
  assert.equal((await fetchAttendancesForEvents([{ id: 'event-1' }, { id: 'event-1' }, { id: 'notice', agenda_type: 'announcement' }])).length, 1);
  assert.equal(calls[0], 'public_event_attendance_summary');
  assert.equal(calls[1], 'event_id, confirmed_count, has_confirmed');
  assert.equal(JSON.stringify(calls[2]), JSON.stringify(['event_id','event-1']));
  assert.equal((await getRanking()).length, 1);
  assert.equal(calls[3], 'public_spiritual_ranking');
  assert.equal(calls[4], 'user_id, user_name, avatar_url, xp, total_points, streak_days');
  assert.doesNotMatch(agenda, /select\('user_id, user_name'\)/);
  assert.doesNotMatch(agenda, /userInfo\.user\?\.email/);
  const publicProfile = profile.slice(profile.indexOf('async function loadPublicProfile('), profile.indexOf('function publicStat('));
  assert.match(publicProfile, /\.from\('public_spiritual_ranking'\)/);
  assert.doesNotMatch(publicProfile, /\.from\('spiritual_progress'\)/);
  assert.match(publicProfile, /hasPublicProgress\s*\?/);
  assert.doesNotMatch(publicProfile, /publicProfileMedals\(/);
  console.log('privacy-projections frontend: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
