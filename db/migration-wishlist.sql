-- XAN Switch — rode isso no editor SQL do SUPABASE (não é o mesmo banco do
-- catálogo, que continua no Neon). É seguro rodar mais de uma vez.
--
-- Cria a estrutura de contas de cliente (login por e-mail, sem senha) e a
-- lista de desejos. O login em si é 100% cuidado pelo Supabase Auth — essas
-- duas tabelas só guardam o que é específico do nosso site: o Instagram
-- que a pessoa escolheu informar, e quais jogos ela favoritou.

-- Perfil complementar de cada cliente (o e-mail e a senha/login já ficam
-- guardados pelo próprio Supabase Auth, em auth.users — não precisamos
-- duplicar isso aqui).
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- "Row Level Security": cada cliente só consegue ver/editar a própria
-- linha — mesmo que alguém tentasse, não dá pra ler ou mexer no perfil de
-- outra pessoa por essa via. O painel admin, que precisa ver tudo, usa uma
-- chave separada (a "service role") que ignora essas regras de propósito.
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Lista de desejos: um cliente pode favoritar o mesmo jogo só uma vez
-- (o "UNIQUE" abaixo garante isso). game_id se refere aos jogos do
-- catálogo, que ficam no Neon — não dá pra ligar as duas tabelas
-- diretamente (são bancos diferentes), então o site busca os dados do
-- jogo (nome, capa, preço) separadamente, usando esse número.
CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);
CREATE INDEX IF NOT EXISTS wishlists_game_id_idx ON wishlists (game_id);
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlists_select_own" ON wishlists;
CREATE POLICY "wishlists_select_own" ON wishlists FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlists_insert_own" ON wishlists;
CREATE POLICY "wishlists_insert_own" ON wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlists_delete_own" ON wishlists;
CREATE POLICY "wishlists_delete_own" ON wishlists FOR DELETE USING (auth.uid() = user_id);
