INSERT INTO countries (id, iso_code, name, active)
VALUES
  ('019f9749-5ad7-72e2-ae84-59c73f79d2a0', 'BR', 'Brasil', TRUE),
  ('019f9749-5ada-702d-93ca-0eab61822cff', 'US', 'United States', TRUE),
  ('019f9749-5ada-702d-93ca-10a3c4eaa3b4', 'ES', 'España', TRUE)
ON CONFLICT (iso_code) DO UPDATE
SET name = EXCLUDED.name,
    active = TRUE;

INSERT INTO joker_types (id, code, eliminated_wrong_answers, reveals_correct_answer, active)
VALUES
  (1, 'ELIMINATE_1', 1, FALSE, TRUE),
  (2, 'ELIMINATE_2', 2, FALSE, TRUE),
  (3, 'ELIMINATE_3', 3, FALSE, TRUE),
  (4, 'ELIMINATE_4', 4, FALSE, TRUE),
  (5, 'REVEAL', 0, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    eliminated_wrong_answers = EXCLUDED.eliminated_wrong_answers,
    reveals_correct_answer = EXCLUDED.reveals_correct_answer,
    active = EXCLUDED.active;

-- Senha: Gannicus#87 (scrypt com salt aleatório; nunca em texto puro no runtime).
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  country_id,
  language_code,
  active
)
VALUES (
  '019f9749-5ada-702d-93ca-15664a51cd6a',
  'braian.diogenes',
  'braian.diogenes@gmail.com',
  'scrypt$OT2Jq6HUBY9xJVipXdUZJQ$62hGXBbkDDLEdoBefMNN-MUwwxWPKm6E7URH-NQNJAnMI9V8kWL2dzCpz0v2txiCVA4peoxt-6yeuhZ5VyX01A',
  '019f9749-5ad7-72e2-ae84-59c73f79d2a0',
  'pt-BR',
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    country_id = EXCLUDED.country_id,
    language_code = EXCLUDED.language_code,
    active = TRUE;

INSERT INTO permission_assignments (user_id, permission_role_id)
VALUES ('019f9749-5ada-702d-93ca-15664a51cd6a', '019f9749-7693-721f-a3c8-df32ca71b1fe')
ON CONFLICT (user_id) DO UPDATE SET permission_role_id = EXCLUDED.permission_role_id;
