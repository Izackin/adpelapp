const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const journey = read('spiritual-progress.js');
const home = read('js/home.js');
const bible = read('js/bible.js');
const migration = read('supabase/migrations/20260928010000_secure_daily_missions.sql');
const grantsMigration = read('supabase/migrations/20260928020000_tighten_daily_mission_grants.sql');

assert.match(journey, /rpc\('get_daily_missions'\)/);
assert.match(journey, /rpc\('record_journey_action'/);
assert.match(journey, /Sua caminhada de hoje/);
assert.match(journey, /Caminhada de hoje concluída/);
assert.match(journey, /registerVerseOfDayRead/);
assert.doesNotMatch(journey, /completeDailyMission|registerMission|registerChallengeProgress/);
assert.doesNotMatch(journey, /\.from\('spiritual_progress'\)[\s\S]{0,120}\.(?:insert|update)\(/);
assert.doesNotMatch(journey, /\.from\('user_daily_challenges'\)[\s\S]{0,120}\.(?:insert|update)\(/);

assert.match(home, /IntersectionObserver/);
assert.match(home, /setTimeout\(recordReading, 4000\)/);
assert.match(bible, /registerChapterRead\(state\.book\.id, state\.chapter\)/);
assert.match(bible, /registerBookCompleted\(state\.book\.id\)/);

for (const missionKey of ['daily_return', 'verse_of_day', 'bible_chapter', 'course_lesson']) {
  assert.match(migration, new RegExp(`'${missionKey}'`));
}
assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog/);
assert.match(migration, /if requesting_user is null then/);
assert.match(migration, /revoke insert, update, delete on public\.spiritual_progress from anon, authenticated/);
assert.match(migration, /revoke insert, update, delete on public\.user_daily_challenges from anon, authenticated/);
assert.match(migration, /bible_reading_progress[\s\S]*is_read is true/);
assert.match(migration, /user_lesson_progress[\s\S]*lesson_index = lesson_index_value/);
assert.match(migration, /unique \(user_id, event_key\)/);
assert.doesNotMatch(migration, /xp_amount|points_amount|reward_amount/);
assert.match(grantsMigration, /revoke all on table public\.spiritual_progress from anon, authenticated/);
assert.match(grantsMigration, /revoke all on table public\.user_daily_challenges from anon, authenticated/);
assert.match(grantsMigration, /grant select on table public\.spiritual_progress to anon, authenticated/);
assert.match(grantsMigration, /journey_user_daily_challenges_select_own/);

console.log('daily-missions: all assertions passed');
