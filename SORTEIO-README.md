# Sorteio ao vivo (ex: live do The Game Awards)

A pessoa entra no link (`/sorteio/<link>`), entra com a conta da loja e confirma presença. Quando
você começa a sortear, a mesma página vira a tela de acompanhamento: todo mundo vê a roleta ao
mesmo tempo e os ganhadores.

## Antes de usar (uma vez só)

Rode `db/migration-sorteios.sql` no editor SQL do Neon. Enquanto não rodar, a aba **🎁 Sorteios**
do admin avisa.

## Criar o sorteio

1. **Admin › 🎁 Sorteios › Criar sorteio.**
2. Aba **Configurar**:
   - título, **link** (ex: `tga-2026` → `xanswitch.com.br/sorteio/tga-2026`), descrição, regulamento,
     banner, mensagem pro ganhador;
   - **Antifraude**:
     - participações por IP (padrão 3; vazio desliga);
     - bloquear o mesmo aparelho em contas diferentes;
     - **só contas criadas antes de…** (ponha o horário de início da live: ninguém cria conta
       nova durante a live pra participar duas vezes);
   - **Prêmios**: nome, imagem, quantos ganhadores e a ordem (menor sai primeiro).

## Ensaiar (modo de teste)

1. Aba **Controle › Ligar modo de teste** (só com o sorteio em rascunho).
2. **Gerar participantes fictícios** (ex: 50).
3. Avance a situação até **Sorteando** e abra a aba **Telão**: aperte **Espaço** pra sortear.
4. Abra o link público no celular pra ver a página do participante junto.
5. No fim: **Desligar e limpar o ensaio** (apaga participantes e sorteios e volta pro rascunho).

## No dia da live

1. **Controle › Avançar para "Inscrições abertas"** e divulgue o link.
2. Na hora de sortear: **Avançar para "Inscrições encerradas"**, olhe os **suspeitos** (mesmo IP ou
   mesmo aparelho) e **desclassifique** quem precisar. **Exportar CSV** baixa a lista.
3. **Avançar para "Sorteando"**. Na aba **Telão** (a que vai na transmissão): **Tela cheia** e
   **Espaço** sorteia o próximo prêmio. A roleta começa uns 2,5 s depois, igual em todas as telas.
4. Ganhador não respondeu? **Controle › Histórico › Re-sortear** com o motivo: o anterior fica
   no histórico e não volta a ser sorteado.
5. **Avançar para "Finalizado"**.

## Regras (todas checadas no servidor)

- Uma participação por conta (o banco garante).
- Só com inscrições abertas e o regulamento aceito.
- Limite por IP, bloqueio por aparelho (cookie + dado guardado no navegador) e idade da conta.
- No máximo 12 tentativas por minuto por IP e 6 por conta.
- O ganhador é escolhido no servidor (sorteio criptograficamente seguro), entre quem não foi
  desclassificado e ainda não ganhou. Ninguém ganha duas vezes (o banco garante).
- O telão e a página pública mostram só o nome curto (ex: "Maria S.") e o e-mail mascarado
  (ex: `ma***@gmail.com`).

A loja não tem confirmação de e-mail nem CPF, então essas regras não existem.

## Onde fica o código

- Regras e sorteio: `lib/sorteio/regras.ts`, `lib/sorteio/sortear.ts` (testes: `npm run test:sorteio`).
- Banco: `lib/sorteioDb.ts`.
- Página do participante: `app/sorteio/[slug]`; roleta e lista ao vivo: `app/sorteio/AoVivo.tsx`.
- Estado ao vivo (as telas perguntam a cada ~2 s): `app/api/sorteios/[slug]/route.ts`.
- Admin: `app/admin/SorteiosPanel.tsx` e `app/admin/sorteios/`.
- Visual: só estrutura por enquanto, nas classes `sorteio-*` (`app/sorteio/sorteio.css`) e
  `sorteios-adm-*` (`app/admin/sorteios/sorteios-admin.css`).
