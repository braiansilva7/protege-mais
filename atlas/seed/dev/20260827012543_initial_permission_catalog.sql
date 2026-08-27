-- Catálogo aditivo exclusivo de desenvolvimento. Nenhum papel ou atribuição é criado.
INSERT INTO "public"."permissions" ("id", "code")
VALUES
  ('01a040d2-ac98-72e8-8a01-145f071eb02d', 'account.list'),
  ('01a040d2-ac9b-7095-a615-7402c92bc007', 'account.view'),
  ('01a040d2-ac9b-7095-a615-7a57ac29f06e', 'account.create'),
  ('01a040d2-ac9b-7095-a615-7dbc8d7ce946', 'account.update'),
  ('01a040d2-ac9b-7095-a615-815078715a13', 'account.disable'),
  ('01a040d2-ac9b-7095-a615-87fcd950cbba', 'organization.list'),
  ('01a040d2-ac9b-7095-a615-8bee90b6153d', 'organization.view'),
  ('01a040d2-ac9b-7095-a615-8e9f0278f41f', 'organization.create'),
  ('01a040d2-ac9b-7095-a615-91c05065bce2', 'organization.update'),
  ('01a040d2-ac9b-7095-a615-95090c9b6fdc', 'victim.list'),
  ('01a040d2-ac9b-7095-a615-9a4567cd4327', 'victim.view'),
  ('01a040d2-ac9b-7095-a615-9d6cf4632e00', 'victim.create'),
  ('01a040d2-ac9b-7095-a615-a09484b009ad', 'victim.update'),
  ('01a040d2-ac9b-7095-a615-a6da21f21c3f', 'case.list'),
  ('01a040d2-ac9b-7095-a615-a94ece91abfa', 'case.view'),
  ('01a040d2-ac9b-7095-a615-aee18b8fada0', 'case.create'),
  ('01a040d2-ac9b-7095-a615-b1be5fef18a6', 'case.update'),
  ('01a040d2-ac9b-7095-a615-b4edb0093e56', 'case.close'),
  ('01a040d2-ac9b-7095-a615-b90ee5acdb78', 'case.transfer')
ON CONFLICT ("code") DO NOTHING;
