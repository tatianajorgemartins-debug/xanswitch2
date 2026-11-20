-- XAN Switch — sorteios: @ do Instagram de quem participa.
-- Rode uma vez no editor SQL do Neon (é seguro rodar de novo).
-- O @ fica salvo em minúsculas e sem o "@"; o mesmo @ não participa duas
-- vezes no mesmo sorteio.
ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS instagram TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS raffle_entries_instagram_uniq ON raffle_entries (raffle_id, instagram) WHERE instagram IS NOT NULL;
