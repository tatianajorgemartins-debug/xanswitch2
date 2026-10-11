-- Produtos de demonstração do catálogo físico — placeholders pra testar o
-- layout antes de cadastrar os produtos reais da importadora. Todos
-- marcados com is_demo = TRUE, pra dar pra identificar e excluir em bloco
-- pelo painel admin (/admin/produtos-fisicos) quando os produtos reais
-- chegarem. Preços fictícios, sem imagem (o card mostra um ícone no lugar
-- em vez de depender de uma URL externa que pode quebrar).
INSERT INTO physical_products (name, price, description, published, is_demo) VALUES
  ('Controle sem fio para Nintendo Switch', 189.90, '[Produto de demonstração] Controle sem fio compatível, com conexão Bluetooth e botões programáveis.', TRUE, TRUE),
  ('Case de transporte para Nintendo Switch 2', 129.90, '[Produto de demonstração] Case rígido com espaço pro console, cartuchos e cabos.', TRUE, TRUE),
  ('Película protetora para Nintendo Switch 2', 39.90, '[Produto de demonstração] Película de vidro temperado, anti-impressão digital.', TRUE, TRUE),
  ('Suporte para console portátil', 59.90, '[Produto de demonstração] Suporte ajustável de mesa, dobrável pra transporte.', TRUE, TRUE),
  ('Bolsa de transporte para acessórios', 79.90, '[Produto de demonstração] Bolsa compacta pra guardar cabos, cartuchos e fones.', TRUE, TRUE),
  ('Carregador USB-C compatível', 69.90, '[Produto de demonstração] Carregador rápido USB-C, cabo de 1,5m incluso.', TRUE, TRUE),
  ('Estojo para cartões de jogos', 34.90, '[Produto de demonstração] Estojo compacto com espaço pra até 24 cartuchos.', TRUE, TRUE),
  ('Fone de ouvido gamer', 149.90, '[Produto de demonstração] Fone com microfone destacável e som surround.', TRUE, TRUE),
  ('Controle estilo retrô', 119.90, '[Produto de demonstração] Controle com visual inspirado nos consoles clássicos.', TRUE, TRUE),
  ('Kit de acessórios para Nintendo Switch', 229.90, '[Produto de demonstração] Kit com case, película, suporte e grips de polegar.', TRUE, TRUE);
