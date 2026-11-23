# Sorteio ao vivo (ex: live do The Game Awards)

Um sorteio é uma página (`/sorteio/<link>`) com **vários itens**. Cada item tem as próprias
inscrições, abre e fecha separado e é sorteado na sua hora. A pessoa entra com a conta da loja,
coloca o @ do Instagram, aceita o regulamento e escolhe de quais itens participa (ou "Participar
de todos"). Ela pode ganhar mais de um item. Quando um item é sorteado, a página mostra a roleta
ao vivo, igual em todas as telas.

## Antes de usar (uma vez só)

Rode no editor SQL do Neon, nesta ordem (todos são seguros de rodar de novo):

1. `db/migration-sorteios.sql`
2. `db/migration-sorteios-instagram.sql`
3. `db/migration-sorteios-itens.sql`

## Criar o sorteio

1. **Admin › 🎁 Sorteios › Criar sorteio.**
2. Aba **Configurar**: título, **link** (ex: `tga-2026`), descrição, regulamento, banner, mensagem
   pro ganhador, antifraude e os **itens** (nome, foto, hora do sorteio, quantos ganhadores).
3. **Publicar a página** (botão no topo). O link fica no ar, mas ninguém se inscreve até você
   abrir as inscrições de um item.

## Testar (a qualquer hora)

Na aba **Telão**, escolha um item e clique em **🧪 Testar roleta** (ou **🧪 Testar** no card do
item). A roleta roda com nomes fictícios, marcada "Ensaio · não vale", **só na sua tela**: nada é
gravado e o público não vê. Funciona em qualquer fase, até com inscrições abertas.

## No dia da live

Na aba **Itens e sorteio**, cada item tem o botão do próximo passo:

1. **Abrir inscrições** → divulgue o link.
2. Na hora do item: **Encerrar inscrições** (confira os suspeitos e desclassifique quem precisar).
3. **Sortear**: pelo card (**🎲 Sortear agora**) ou pelo **Telão** (a tela que vai na live:
   **Tela cheia** e **Espaço**). A roleta começa uns 2,5 s depois, igual em todas as telas.
4. Ganhador não respondeu? **Histórico › Re-sortear** com o motivo: o anterior fica no histórico
   e não volta a ser sorteado naquele item.
5. Faça o mesmo com os outros itens, cada um na sua hora. No fim, **Encerrar o sorteio** (topo).

## Regras (todas checadas no servidor)

- Em cada item: uma inscrição por conta e por @ do Instagram (o banco garante). O @ fica salvo
  também na conta da loja, pra próxima vez já vir preenchido.
- Só com a página publicada, o item com inscrições abertas e o regulamento aceito.
- Limite de contas por IP (em cada item), bloqueio por aparelho (cookie + dado guardado no
  navegador) e idade da conta. No máximo 12 tentativas por minuto por IP e 6 por conta.
- O ganhador é escolhido no servidor (sorteio criptograficamente seguro), entre os inscritos do
  item que não foram desclassificados. Ninguém ganha duas vezes o mesmo item; itens diferentes, pode.
- No admin o IP aparece escondido (`189.40.•••.•••`); **Mostrar IPs** mostra completo. Suspeito =
  mesma internet ou mesmo aparelho que outra conta.
- O telão e a página pública mostram só o nome curto (ex: "Maria S.") e o e-mail mascarado.

## Onde fica o código

- Regras e sorteio: `lib/sorteio/regras.ts`, `lib/sorteio/sortear.ts` (testes: `npm run test:sorteio`).
- Banco: `lib/sorteioDb.ts`.
- Página do participante: `app/sorteio/[slug]`; roleta, itens e ganhadores: `app/sorteio/AoVivo.tsx`.
- Estado ao vivo (as telas perguntam a cada ~2 s): `app/api/sorteios/[slug]/route.ts`.
- Admin: `app/admin/SorteiosPanel.tsx` e `app/admin/sorteios/`.
- Visual: `app/sorteio/sorteio.css` e `app/admin/sorteios/sorteios-admin.css`.
