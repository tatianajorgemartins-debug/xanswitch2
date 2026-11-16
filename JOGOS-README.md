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

## Ocarina Hero: criar uma música nova

1. Abra **/testes/ocarina-hero?editor=1** (no computador).
2. Escolha nome, andamento (bpm) e dificuldade. Clique em **Gravar**: o primeiro compasso é só
   metrônomo; aí toque a melodia nas teclas A S J K L (segurar = nota longa). Clique em **Parar**.
3. **Testar** toca a música no jogo. Gostou? **Baixar** e coloque o arquivo `.json` em
   `data/jogos/ocarina/`. Publique o site.
4. A música entra na lista na hora e no sorteio da Música do Dia a partir de amanhã
   (`ativo_desde`, já vem preenchido).

Dá pra editar o `.json` à mão: cada nota é `{ "t": segundos, "pista": "A" | "C_baixo" | "C_dir" |
"C_esq" | "C_cima" }`, com `"dur"` (segundos) pra nota longa e `"nota": "E5"` pra outra altura.
As alturas de cada pista ficam em `app/testes/ocarina-hero/ocarina.ts` (`PISTAS`).

## Trocar as teclas padrão

Cada jogador troca as suas no menu do Ocarina Hero (⌨️ Teclas). O padrão do site fica em
`TECLAS_PADRAO`, em `app/testes/ocarina-hero/ocarina.ts` (nomes de tecla do navegador:
`KeyA`, `KeyS`, `Space`, `ArrowUp`...). Setas + espaço sempre funcionam também.

## Outras coisas

- **Admin › 🕹️ Jogos interativos**: todas as partidas (com ou sem conta) e a moderação do feed
  (esconder/apagar posts).
- **Sequência e marcos**: `onMarcoSequencia(dias)` em `lib/jogos/progresso.ts` é chamado em
  3, 7, 15 e 30 dias seguidos — é ali que se liga o programa de pontos/cupons.
- **Testes automáticos**: `npm run test:jogos`.
- **Conferir um personagem** (só no computador, com `npm run dev`):
  `/testes/silhueta?ver=toad&nivel=dificil`.
