# Jogos interativos — como cuidar

Página de jogos: **/testes** (Silhueta do Dia, Ocarina Hero, Qual Link, Próximo jogo e o Feed).

## Antes de tudo (uma vez só)

Rode `db/migration-jogos-interativos.sql` no editor SQL do Neon. Sem isso os jogos funcionam, mas
o admin não registra as partidas e o feed fica "abre em breve".

## Silhueta do Dia: adicionar personagens

1. Coloque a imagem (PNG/WebP **sem fundo**) na pasta
   `MINHAS VENDAS\SITE\Jogos interativos\SILHUETA`, com o nome `NOME - NÍVEL`
   (ex.: `YOSHI - FÁCIL.png`) — ou dentro de uma subpasta `facil`, `medio`, `dificil` ou `insano`.
2. Dê duplo clique em **`SINCRONIZAR PERSONAGENS.bat`** (está na pasta "Jogos interativos").
   Ele otimiza a imagem, gera a silhueta e põe o personagem novo em `data/jogos/personagens.json`
   com `"revisar": true`. No fim mostra um resumo e os avisos.
3. Abra `data/jogos/personagens.json`, procure `"revisar": true` e confira `nome`, `aceitos`
   (apelidos que também valem como resposta), `franquia`, `jogo` e `estreia` — viram dicas no
   jogo. Depois apague a linha `"revisar": true`.
4. Publique o site. O personagem novo entra no sorteio **a partir de amanhã** (`ativo_desde`),
   então o desafio de hoje e os resultados já compartilhados não mudam.

- Tirar do sorteio sem apagar: `"ativo": false` e rode o `.bat` (ele marca até quando valeu).
- Mais de um nível: `"niveis": ["medio", "dificil"]`.
- Link "Ver jogos na loja" errado? Ponha o nome da franquia como está no catálogo em
  `"franquia_loja"` (ex.: `"Legend Of Zelda"`).
- O script nunca apaga personagens nem muda o que você escreveu.

## Ocarina Hero: criar uma música nova (pelo admin)

Antes, uma vez só: rode `db/migration-ocarina-musicas.sql` no Neon.

1. **Admin › 🎵 Ocarina Hero › ＋ Nova música.**
2. Preencha nome, **jogo** (agrupa a lista "Por jogo") e dificuldade.
3. **Enviar o áudio (mp3)**: o navegador compacta (mono, 96 kbps, ~2 MB numa música de 3 min)
   e sobe pro Supabase. Use Chrome ou Edge (outros navegadores sobem o arquivo original).
4. **Acerte a grade**: BPM (ou o botão **Tap**, tocando no ritmo) e o **1º tempo** (coloque a
   agulha no primeiro tempo forte e clique **Usar agulha**). Ligue o **Metrônomo** e toque: os
   cliques têm que bater com a música.
5. **Coloque as notas** nas 5 cores (verde, amarelo, vermelho, roxo, azul):
   - clique = nota; clique e arraste pra direita = nota longa; arrastar a nota = mover;
     puxar a ponta = mudar a duração; botão direito = apagar;
   - várias cores no mesmo tempo = acorde (dá pra fazer com as teclas 1–5 com a agulha parada);
   - **Gravar ao vivo**: toque a música e aperte as teclas no ritmo (segurar = nota longa);
   - a **Grade** escolhe a precisão (1/4, 1/8, tercina…) e o ajuste fino em ms fica no quadro
     da nota selecionada. Ctrl+Z desfaz.
   - **🔊 Clique em cada nota**: ao tocar a prévia, cada nota faz um clique seco — se o clique
     bate com a música, a nota está no lugar certo.
   - **Repetir partes**: arraste na forma de onda pra selecionar um trecho (ou use a ferramenta
     **⬚ Selecionar** / Shift+arrastar), depois **⧉ Repetir em seguida** (Ctrl+D) quantas vezes
     precisar. Ou **Copiar** (Ctrl+C), ponha a agulha onde quer e **Colar na agulha** (Ctrl+V) —
     cola no compasso da agulha, e colar de novo continua logo depois.
   - **Fim da música**: ponha a agulha onde a música deve acabar e clique **Usar agulha** (ou
     digite os segundos). Ela para ali com fade de 2 s antes; **▶ Ouvir o final** confere e
     **Até o fim do áudio** desfaz. Precisa da coluna `end_at` (rode de novo o
     `db/migration-ocarina-musicas.sql`).
6. **▶ Testar daqui** (tecla T) testa no jogo a partir da agulha ou da 1ª nota selecionada —
   não precisa tocar do começo. Depois **Salvar**. Quando estiver bom: **Publicar no jogo**.
   Ela aparece na lista na hora (aba "Novas" por 14 dias) e entra no sorteio da Música do Dia
   a partir do dia seguinte.

As 6 músicas originais (sem áudio, a ocarina toca em cada acerto) ficam em `data/jogos/ocarina/`.

## Trocar as teclas padrão

Cada jogador troca as suas no menu do Ocarina Hero (⌨️ Teclas). O padrão do site fica em
`TECLAS_PADRAO`, em `app/testes/ocarina-hero/ocarina.ts` (nomes de tecla do navegador:
`KeyA`, `KeyS`...). Os números 1 a 5 sempre funcionam também.

## Precisão (quanto o toque pode sair do tempo)

O jogador escolhe no menu do Ocarina Hero: **Folgada**, **Normal** (padrão) ou **Exata**. Os
valores ficam em `PRECISOES`, em `app/testes/ocarina-hero/ocarina.ts`.

## Visual da partida

Imagens em `public/jogos/ocarina/ui/` (geradas a partir de
`Jogos interativos\OCARINA HERO\elementos`). A pista e as notas são desenhadas em
`app/testes/ocarina-hero/motor.ts`; placar, combo, corações e progresso em `Palco.tsx`.

## Abrir o Ocarina Hero pro público

Enquanto `OCARINA_ENABLED` (em `lib/siteSections.ts`) estiver `false`, a página /testes mostra o
banner "Em breve" e o jogo só abre no computador de teste. Mudou pra `true`: o banner some e
entra o card do jogo, sozinho.

## Outras coisas

- **Admin › 🕹️ Jogos interativos**: todas as partidas (com ou sem conta) e a moderação do feed
  (esconder/apagar posts).
- **Sequência e marcos**: `onMarcoSequencia(dias)` em `lib/jogos/progresso.ts` é chamado em
  3, 7, 15 e 30 dias seguidos — é ali que se liga o programa de pontos/cupons.
- **Testes automáticos**: `npm run test:jogos`.
- **Conferir um personagem** (só no computador, com `npm run dev`):
  `/testes/silhueta?ver=toad&nivel=dificil`.
