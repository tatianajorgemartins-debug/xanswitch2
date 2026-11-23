-- XAN Switch — sorteios com vários itens: cada item (prêmio) tem as próprias
-- inscrições, abre e fecha separado e é sorteado na sua hora. A pessoa
-- escolhe de quais itens participa, e pode ganhar mais de um.
-- Rode uma vez no editor SQL do Neon (é seguro rodar de novo).

-- Situação de cada item: em_breve → abertas → encerradas (aí dá pra sortear).
ALTER TABLE raffle_prizes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'em_breve';
ALTER TABLE raffle_prizes DROP CONSTRAINT IF EXISTS raffle_prizes_status_check;
ALTER TABLE raffle_prizes ADD CONSTRAINT raffle_prizes_status_check CHECK (status IN ('em_breve', 'abertas', 'encerradas'));
-- Horário previsto do sorteio do item (só informativo, aparece na página).
ALTER TABLE raffle_prizes ADD COLUMN IF NOT EXISTS draw_at TIMESTAMPTZ;

-- Cada inscrição é num item.
ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS prize_id INTEGER REFERENCES raffle_prizes(id) ON DELETE CASCADE;
-- Inscrições de antes (sem item): vão pro primeiro item do sorteio.
UPDATE raffle_entries e SET prize_id = (
  SELECT p.id FROM raffle_prizes p WHERE p.raffle_id = e.raffle_id ORDER BY p.sort_order, p.id LIMIT 1
) WHERE e.prize_id IS NULL;
-- Uma inscrição por conta e por @ em cada item (antes era no sorteio todo).
ALTER TABLE raffle_entries DROP CONSTRAINT IF EXISTS raffle_entries_raffle_id_user_id_key;
DROP INDEX IF EXISTS raffle_entries_instagram_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS raffle_entries_item_conta_uniq ON raffle_entries (prize_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS raffle_entries_item_instagram_uniq ON raffle_entries (prize_id, instagram) WHERE instagram IS NOT NULL;

-- A situação do sorteio agora é só: rascunho, abertas (= página publicada) ou finalizado.
UPDATE raffle_prizes p SET status = 'encerradas' FROM raffles r
  WHERE r.id = p.raffle_id AND r.status IN ('encerradas', 'sorteando', 'finalizado') AND p.status = 'em_breve';
UPDATE raffles SET status = 'abertas' WHERE status IN ('encerradas', 'sorteando');
