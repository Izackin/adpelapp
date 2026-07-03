-- Descontinua desafios ligados a Estudos, pois o app passa a concentrar ensino em Cursos.
update public.daily_challenges
set is_active = false
where activity_type = 'study_completed';
