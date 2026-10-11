-- Agreed launch catalog (prd.md §2.2). Reference data, not tutor inventory.
-- Specialized subjects are added by an admin only when a tutor offers them.
INSERT INTO "subjects" ("slug", "name", "category") VALUES
	('math', 'Math', 'academic_core'),
	('science', 'Science', 'academic_core'),
	('english', 'English', 'academic_core'),
	('sat', 'SAT', 'test_prep'),
	('act', 'ACT', 'test_prep'),
	('entrance-exams', 'Entrance exams', 'test_prep'),
	('homework-help', 'Homework help', 'academic_support'),
	('study-skills', 'Study skills', 'academic_support')
ON CONFLICT DO NOTHING;
