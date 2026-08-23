-- XAN Switch — migração: configurações globais do site (música do dia)
-- Rode este script uma vez no editor SQL do seu banco (Neon). É seguro
-- rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
