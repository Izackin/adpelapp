const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const adminHtml = read('admin.html');
const supabase = read('supabase.js');
const courses = read('js/courses.js');
const paid = read('js/paid-courses.js');
const home = read('js/home.js');
const adminCourses = read('admin/crud-courses.js');
const adminAccess = read('admin/course-access.js');
const adminCore = read('admin.js');
const dashboard = read('admin/dashboard-v2.js');
const css = read('app-shell.css');
const migration = read('supabase/migrations/20260929150026_paid_courses_v1.sql');
const rlsTune = read('supabase/migrations/20260929150112_paid_courses_v1_rls_tune.sql');
const legacyGuard = read('supabase/migrations/20260929151545_paid_courses_v1_legacy_guard.sql');
const rlsSplit = read('supabase/migrations/20260929152001_paid_courses_v1_content_rls_split.sql');
const progressGuard = read('supabase/migrations/20260929152552_paid_courses_v1_progress_guards.sql');

assert.doesNotThrow(() => new Function(paid));
assert.doesNotThrow(() => new Function(adminCourses));
assert.doesNotThrow(() => new Function(adminAccess));

assert.ok(index.includes('js/paid-courses.js'));
assert.ok(index.includes('id="course-access-panel"'));
assert.ok(index.includes('id="course-content-area"'));
assert.ok(index.includes('requestCurrentCourseAccess()'));

assert.ok(supabase.includes('is_paid,price_cents,lesson_count'));
assert.ok(!/fetchCourses\(\)[\s\S]{0,250}select\('\*'\)/.test(supabase));
assert.ok(!/fetchFeaturedCourses\(\)[\s\S]{0,300}select\('\*'\)/.test(supabase));

assert.ok(paid.includes(".from('course_access')"));
assert.ok(paid.includes(".from('course_content')"));
assert.ok(paid.includes("access.status === 'active'"));
assert.ok(paid.includes("status: 'pending'"));
assert.ok(paid.includes("amount_cents: Number(currentOpenCourse.price_cents || 0)"));
assert.ok(paid.includes('paidSetCourseContentVisibility(false)'));
assert.ok(paid.includes('course.status === \'locked\''));
assert.ok(paid.includes('loadCoursesData = paidLoadCoursesData'));
assert.ok(paid.includes('paidCoursesDownloadCertificate'));
assert.ok(paid.includes("access.status !== 'active'"));
assert.ok(home.includes('window.formatCoursePrice'));

assert.ok(adminHtml.includes('id="course-paid"'));
assert.ok(adminHtml.includes('id="course-price"'));
assert.ok(adminHtml.includes('id="course-access-admin-list"'));
assert.ok(adminHtml.includes('admin/course-access.js'));

assert.ok(adminCourses.includes("is_paid: isPaid"));
assert.ok(adminCourses.includes("price_cents: priceCents"));
assert.ok(adminCourses.includes("lesson_count: lessons.length"));
assert.ok(adminCourses.includes("lessons: []"));
assert.ok(adminCourses.includes(".from('course_content')"));
assert.ok(adminCourses.includes('saveCourseContentForAdmin'));

assert.ok(adminAccess.includes(".from('course_access')"));
assert.ok(adminAccess.includes("status: 'active'"));
assert.ok(adminAccess.includes("status: nextStatus"));
assert.ok(adminAccess.includes('course_access_approved'));
assert.ok(adminCore.includes('await loadCourseAccessRequests()'));
assert.ok(dashboard.includes('acessos a cursos aguardando'));

assert.ok(css.includes('.course-paid-badge'));
assert.ok(css.includes('.course-access-panel'));
assert.ok(css.includes('.course-paid-action'));

assert.ok(migration.includes('create table if not exists public.course_content'));
assert.ok(migration.includes('create table if not exists public.course_access'));
assert.ok(migration.includes('enable row level security'));
assert.ok(rlsTune.includes('course_access_insert_allowed'));
assert.ok(rlsTune.includes('course_access_update_allowed'));
assert.ok(legacyGuard.includes('courses_paid_content_must_be_protected'));
assert.ok(rlsSplit.includes('course_content_read_anon_free'));
assert.ok(rlsSplit.includes('course_content_read_authenticated'));
assert.ok(progressGuard.includes('user_lesson_progress_paid_course_insert_guard'));
assert.ok(progressGuard.includes('certificates_paid_course_insert_guard'));

console.log('paid-courses-v1: all assertions passed');
