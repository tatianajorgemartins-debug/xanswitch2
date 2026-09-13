# XAN Switch — Catálogo (site completo)

Site com duas partes:

- **`/` — Catálogo público**: seus clientes acessam, veem os jogos e, ao clicar em
  qualquer um, abre uma janela de compra na própria página com um checklist
  rápido, pagamento via Pix (QR Code de verdade, gerado na hora) e, depois
  que o cliente confirma que pagou, a conversa segue no WhatsApp pra você
  fazer a verificação manual antes de enviar o código. Veja a seção
  "Como funciona a compra pelo site (Pix + WhatsApp)" mais abaixo pro passo
  a passo completo.
- **`/admin` — Painel de administração**: protegido por senha. É onde você
  adiciona, edita, arquiva e exclui jogos do catálogo, além de acompanhar
  comentários e o histórico de pedidos.

Este guia assume que você **nunca usou Vercel nem terminal antes**. Vai
funcionar, só siga a ordem.

---

## O que você vai precisar criar (de graça)

1. Uma conta na [Vercel](https://vercel.com) (pode entrar com GitHub, Google ou e-mail)
2. Uma conta no [GitHub](https://github.com) (pra guardar o código)
3. Uma conta no [Supabase](https://supabase.com) (pode entrar com GitHub também) —
   é onde ficam guardadas as capas dos jogos e as capturas de tela.
4. O banco de dados (Neon) é criado de dentro do próprio painel da Vercel,
   sem precisar de outra conta.

---

## Passo 1 — Colocar o código no GitHub

1. Crie uma conta em [github.com](https://github.com) se ainda não tiver.
2. Crie um repositório novo (botão verde **"New"** na página inicial). Pode
   deixar **privado**. Dê o nome que quiser, ex: `xan-switch-catalogo`.
3. Na página do repositório recém-criado, clique em **"uploading an existing
   file"** e arraste **todos os arquivos e pastas** deste projeto pra lá
   (menos a pasta `node_modules`, se ela existir — não é necessária).
4. Clique em **"Commit changes"** no final da página.

> Se preferir usar o Git pelo terminal, o fluxo normal também funciona
> (`git init`, `git remote add origin ...`, `git push`), mas o upload pelo
> site do GitHub é mais simples se você não tem prática com terminal.

---

## Passo 2 — Importar o projeto na Vercel

1. Entre em [vercel.com](https://vercel.com) e faça login.
2. Clique em **"Add New..." → "Project"**.
3. Escolha **"Import Git Repository"** e selecione o repositório que você
   acabou de criar no GitHub (pode pedir autorização pra Vercel acessar sua
   conta do GitHub — autorize).
4. A Vercel vai detectar automaticamente que é um projeto **Next.js**. Não
   precisa mudar nada nas configurações de build.
5. **Ainda não clique em "Deploy"** — antes, vamos criar o banco de dados e
   configurar as variáveis de ambiente (próximos passos). Se você já clicou
   e o primeiro deploy falhar, não tem problema — é esperado, porque ainda
   faltam as variáveis. Corrija nos passos abaixo e refaça o deploy no final.

---

## Passo 3 — Criar o banco de dados (Neon, via Vercel)

1. Ainda na tela do seu projeto na Vercel, vá na aba **"Storage"**.
2. Clique em **"Create Database"** (ou **"Connect Store"** dependendo da tela)
   e escolha **Neon (Postgres)**.
3. Siga o assistente: escolha **"Create New Neon Account"**, aceite os termos,
   escolha a região mais perto de você (ex: `us-east` costuma ter boa
   latência pro Brasil) e dê um nome ao banco (ex: `xan-catalogo-db`).
4. Quando perguntar quais projetos devem receber as variáveis de ambiente,
   selecione o projeto que você acabou de importar, e marque
   **Production**, **Preview** e **Development**.
5. Pronto — a Vercel já injeta a variável `DATABASE_URL` automaticamente no
   seu projeto. Você não precisa copiar/colar nada aqui.

### Criar a tabela de jogos

1. Na mesma aba **Storage**, clique no seu banco → **"Open in Neon"** (ou
   procure por um botão tipo **"Query"** / **"SQL Editor"**).
2. Abra o arquivo `db/schema.sql` deste projeto, copie todo o conteúdo, cole
   no editor de SQL do Neon e clique em **Run** (ou **Execute**).
3. Deve aparecer uma mensagem de sucesso. Isso cria a tabela `games` que o
   site usa pra guardar os jogos.

---

## Passo 4 — Criar o armazenamento de imagens (Supabase)

As capas dos jogos e as capturas de tela ficam guardadas no
[Supabase Storage](https://supabase.com) — um serviço separado da Vercel,
com plano gratuito próprio.

1. Entre em [supabase.com](https://supabase.com) e crie uma conta (dá pra
   entrar direto com GitHub).
2. Clique em **"New project"**. Escolha um nome (ex: `xan-switch`), crie
   uma senha de banco (você não vai precisar dela pra nada neste projeto,
   mas o Supabase exige) e escolha uma região perto do Brasil (ex:
   `South America (São Paulo)`). Espere alguns minutos até o projeto ficar
   pronto.
3. No menu lateral, vá em **Storage** → **"New bucket"**.
   - Nome do bucket: `game-images` (exatamente assim, tudo minúsculo — é
     esse nome que o código já espera).
   - Marque **"Public bucket"** (as imagens precisam ser acessíveis por
     link direto, sem senha — é assim que aparecem no site).
   - Em "Additional configuration", pode limitar o tamanho máximo por
     arquivo pra, digamos, `10 MB` (o site já comprime as imagens antes de
     enviar, então isso é só uma margem de segurança) e restringir os
     tipos permitidos a `image/*`.
   - Clique em **"Save"**.
4. Agora pegue as 3 informações que o site precisa pra conversar com o
   Supabase: vá em **Settings** (ícone de engrenagem, menu lateral) →
   **"API Keys"** (em projetos mais novos) ou **"API"** (em projetos mais
   antigos).
   - **Project URL** → vai na variável `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (ou **anon / public**, em telas mais antigas) →
     vai na variável `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Secret key** (ou **service_role**, clique em "Reveal" pra ver) →
     vai na variável `SUPABASE_SERVICE_ROLE_KEY`

> **Atenção com a Secret key / service_role**: ela dá acesso total ao seu
> projeto Supabase. Nunca cole ela em nenhum lugar público (sites, chats,
> repositórios abertos) — só nas variáveis de ambiente da Vercel e no seu
> `.env.local`.

5. Por último, ainda no Supabase, vá em **SQL Editor** (menu lateral),
   clique em **"New query"**, cole o conteúdo do arquivo
   `db/migration-supabase-keepalive.sql` deste projeto e clique em **Run**.
   Isso cria uma tabelinha pequena chamada `keepalive` — ela existe só pra
   evitar que o Supabase pause seu projeto por "inatividade" (explico
   melhor logo abaixo, na seção "Por que existe uma rotina diária de
   manutenção").
6. Ainda no **SQL Editor**, abra **"New query"** de novo, cole o conteúdo
   do arquivo `db/migration-wishlist.sql` deste projeto e clique em **Run**.
   Isso cria as tabelas usadas pelo login do cliente e pela lista de
   desejos (explico como isso funciona na seção "Como funciona o login e a
   lista de desejos", mais abaixo). Sem rodar essa migração, o botão de
   conta no site continua aparecendo, mas ninguém consegue logar de
   verdade.
7. **Importante:** ainda no Supabase, vá em **Authentication** →
   **Providers** (ou **Sign In / Providers**, em telas mais antigas) →
   **Email**, e deixe a opção **"Confirm email" DESLIGADA**. O login do
   site é com e-mail e senha direto na hora — sem mandar nenhum e-mail de
   confirmação — e essa opção precisa estar desligada pra funcionar assim.
   Se ficar ligada, o cliente cria a conta mas só consegue entrar depois
   de clicar num link de confirmação, o que pode falhar se ele abrir esse
   link num navegador ou aparelho diferente de onde criou a conta.

---

## Passo 5 — Configurar suas variáveis (senha e WhatsApp)

1. No seu projeto na Vercel, vá em **Settings → Environment Variables**.
2. Adicione estas variáveis (`DATABASE_URL` já foi criada sozinha no Passo 3):

   | Nome | Valor | Exemplo |
   |---|---|---|
   | `ADMIN_PASSWORD` | A senha que você vai digitar pra entrar em `/admin` | `MinhaSenh@Forte123` |
   | `WHATSAPP_NUMBER` | Seu número com DDI, só números | `5521999999999` |
   | `NEXT_PUBLIC_PIX_KEY` | Sua chave Pix (CPF, e-mail, telefone ou aleatória) | `17738585722` |
   | `NEXT_PUBLIC_PIX_RECEIVER_NAME` | Seu nome, como está na conta do banco (máx. 25 caracteres, sem acento) | `JOAO C ABREU ALEXANDRE` |
   | `NEXT_PUBLIC_PIX_RECEIVER_CITY` | Cidade da sua conta, sem acento (máx. 15 caracteres) | `NITEROI` |
   | `NEXT_PUBLIC_SUPABASE_URL` | A "Project URL" do seu projeto Supabase (Passo 4) | `https://xxxxxxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A "Publishable key" (ou "anon") do Supabase (Passo 4) | `sb_publishable_...` |
   | `SUPABASE_SERVICE_ROLE_KEY` | A "Secret key" (ou "service_role") do Supabase (Passo 4) | `sb_secret_...` |
   | `CRON_SECRET` | Uma senha aleatória qualquer, só pra uso interno (veja explicação abaixo) | `um texto longo e aleatório` |

   Marque **Production**, **Preview** e **Development** em todas.

3. Clique em **Save**.

> **Dica:** escolha uma senha só sua pro `ADMIN_PASSWORD`, de preferência
> diferente de outras senhas que você já usa. Qualquer pessoa com essa
> senha consegue adicionar/editar/excluir jogos do catálogo.

> **Sobre as variáveis do Pix:** o padrão do Banco Central limita o nome do
> recebedor a 25 caracteres e a cidade a 15, sem acentos (Ç, Ã, Õ etc.). Se
> seu nome completo não couber, abrevie como no exemplo acima — isso só
> muda como seu nome aparece no app do banco de quem está pagando, não afeta
> o valor nem o recebimento do dinheiro. Essas três variáveis começam com
> `NEXT_PUBLIC_` de propósito: elas precisam chegar até o navegador do
> cliente, porque é lá (no computador ou celular dele) que o QR Code é
> desenhado — sem isso o Pix nem apareceria na tela dele. Isso é seguro:
> nome, cidade e chave Pix não são segredos, é exatamente o que qualquer
> pessoa vê ao te mandar um Pix pelo aplicativo do banco dela.

---

## Passo 6 — Fazer o deploy

1. Volte na aba principal do projeto (**"Deployments"**) e clique em
   **"Redeploy"** no último deploy (ou **"Deploy"** se for o primeiro).
2. Espere um a dois minutos. Quando terminar, a Vercel te dá um link tipo
   `https://xan-catalogo-seu-nome.vercel.app`.

**Pronto — seu site está no ar.**

- `https://seu-link.vercel.app/` → catálogo público, pra mandar pros clientes
- `https://seu-link.vercel.app/admin` → seu painel, pede a senha que você
  configurou no `ADMIN_PASSWORD`

---

## Como usar no dia a dia

1. Entre em `/admin` e faça login com sua senha.
2. Clique em **"＋ Adicionar jogo"**: preencha nome, preço, suba a capa (opcional
   marcar uma etiqueta tipo "TOP" com a cor que quiser).
   - **Descrição** (opcional): um texto curto sobre o jogo, que aparece na
     tela de compra quando o cliente clica no jogo.
   - **Capturas de tela** (opcional, até 10 por jogo): fotos/prints do jogo
     que aparecem numa galeria clicável na tela de compra. Cada imagem é
     enviada assim que você escolhe o arquivo, então quando salvar o
     formulário elas já estão prontas.
3. Pra tirar um jogo do catálogo sem apagar de vez, use **"📦 Arquivar"** —
   ele some do catálogo público mas fica guardado, e dá pra restaurar depois.
4. Pra editar ou excluir de vez, clique nos **⋮** (três pontinhos) no canto
   do card.
5. Mande o link `https://seu-link.vercel.app/` pros seus clientes — toda
   mudança que você fizer no admin aparece lá na hora, sem precisar
   republicar nada.

---

## Como funciona a compra pelo site (Pix + WhatsApp)

Quando um cliente clica em qualquer jogo do catálogo, abre uma janela
flutuante (modal) na própria página — sem sair do site nem trocar de link —
com 4 telas em sequência:

1. **Resumo do jogo** — capa, nome, preço, a descrição (se você cadastrou
   uma) e uma galeria de capturas de tela clicáveis (se você subiu alguma),
   tudo já cadastrado no admin. Botão **"Comprar agora"**.
2. **Checklist rápido** — as 3 confirmações que vocês já combinavam por
   WhatsApp (conta sem saldo, pode trocar região, entende que a verificação
   é manual). O botão de continuar só libera com as 3 marcadas.
3. **Pagamento via Pix** — o site gera, na hora e no próprio navegador do
   cliente, um QR Code Pix de verdade (padrão do Banco Central, o mesmo tipo
   que você geraria no app do seu banco) já com o valor exato do jogo. Junto
   aparece o texto "Pix Copia e Cola" com um botão de copiar, pra quem não
   consegue escanear QR Code pela tela do computador.
4. **Confirmação** — o botão **"Já paguei — confirmar no WhatsApp"** abre
   uma conversa no WhatsApp com o nome do jogo, o preço e um aviso de que o
   cliente acabou de pagar, pra vocês seguirem a conversa organizados.

**O ponto mais importante:** o site **nunca** envia nem mostra o código do
jogo automaticamente, em etapa nenhuma. Ele só gera o Pix e te avisa que
alguém disse que pagou — a conferência de que a conta do cliente está
pronta pra resgatar (região, saldo etc.) e o envio do código em si continuam
100% manuais, feitos por você no WhatsApp, exatamente como já era antes.
Isso existe de propósito: é o que te protege de um cliente resgatar o
código e depois pedir estorno alegando que "não recebeu nada".

**Onde configurar sua chave Pix e seus dados de recebedor:** nas variáveis
`NEXT_PUBLIC_PIX_KEY`, `NEXT_PUBLIC_PIX_RECEIVER_NAME` e
`NEXT_PUBLIC_PIX_RECEIVER_CITY`, explicadas no Passo 5 acima (na Vercel) e
no arquivo `.env.example` (se for rodar na sua máquina). É só ali — não tem
nenhum outro lugar no código pra mexer nesses dados.

**Onde fica o histórico de pedidos:** toda vez que um cliente chega na tela
de pagamento (ou seja, o QR Code foi gerado), o site salva uma linha numa
tabela chamada `orders` no mesmo banco Postgres (Neon) que já guarda os
jogos e os comentários — não é um arquivo separado nem outro banco. Você
acompanha esse histórico direto no admin, no botão **"📋 Pedidos"**: aparece
o jogo, o valor e a data/hora de cada tentativa de compra. Isso **não é uma
confirmação de pagamento** — é só um registro de "alguém gerou um Pix pra
este jogo", útil caso alguém pague e esqueça de te chamar no WhatsApp depois
(você vê o pedido na lista e pode entrar em contato). A confirmação real
continua sendo você ver o Pix cair na sua conta.

---

## Link direto de cada jogo (pra compartilhar nas redes sociais)

Todo jogo tem um link próprio, no formato `seusite.com/jogo/123` (o número é
o id do jogo) — quem clicar nesse link cai direto no site já com aquele
jogo aberto no modal de compra, sem precisar procurar no catálogo.

**Como pegar o link:** abre qualquer jogo no site (como cliente veria) e
clica em **"Compartilhar este jogo"**, no fim da primeira tela. No celular,
isso abre o menu nativo de compartilhamento (pra mandar direto pro
WhatsApp, Instagram etc.); no computador, copia o link automaticamente,
com um aviso "Link copiado!".

**Por que isso ajuda a vender mais:** quando você cola esse link no
WhatsApp ou Instagram, ele já vem com uma prévia bonita — a capa do jogo,
o nome e uma descrição — em vez de só um link seco. Isso é configurado
automaticamente a partir dos dados que você já cadastra no admin (capa e
descrição), sem precisar fazer nada a mais.

---

## Como funciona o login e a lista de desejos

No canto superior direito do site (ao lado do Instagram e do WhatsApp) tem
um ícone de pessoa — é por ali que o cliente entra na conta dele e vê a
lista de jogos que favoritou.

**O login é com e-mail e senha, direto no site:** o cliente escolhe uma
senha (mínimo 6 caracteres) ao criar a conta e usa e-mail + senha pra
entrar depois — sem nenhum link ou e-mail de confirmação no meio do
caminho. (A primeira versão disso usava "link mágico" — um link que
chegava por e-mail — mas isso dava problema quando o cliente abria o link
num navegador ou aparelho diferente de onde tinha pedido o login. E-mail e
senha resolve isso, desde que a opção "Confirm email" esteja desligada no
Supabase — ver Passo 4, item 7.)

**Por que não é login com Instagram de verdade:** perguntei sobre isso —
hoje em dia não existe nenhum jeito oficial de "Entrar com o Instagram"
pra um site como esse (nem o Supabase nem praticamente nenhum provedor de
login oferece isso pro Instagram). Por isso, o Instagram vira um campo
opcional que o cliente preenche depois de logado (dentro do mesmo popup) —
assim você ainda consegue ver o @ de quem favoritou cada jogo, só que como
informação de perfil, não como forma de login.

**A lista de desejos:** em cada jogo do catálogo (tanto na grade quanto na
lista) tem um coração — clicando, o jogo entra ou sai da lista de desejos
do cliente. Se ninguém estiver logado, clicar no coração abre o popup de
login em vez de favoritar (sem conta não tem como saber de quem é a lista).
O número ao lado do ícone de pessoa no cabeçalho mostra quantos jogos o
cliente logado tem na lista dele no momento.

**Onde você vê quais são os jogos mais desejados:** no admin, no botão
**"❤️ Mais desejados"** — um ranking com todos os jogos que já foram
favoritados por pelo menos um cliente, do mais pro menos desejado, com a
contagem de quantas pessoas favoritaram cada um. É esse número que ajuda a
decidir quais jogos vale a pena ter sempre em estoque, colocar em
promoção, ou destacar na página inicial.

**Onde isso aparece pro cliente:** os 4 jogos mais favoritados de todos os
clientes (não só os dele) aparecem numa vitrine "❤️ Mais desejados pelos
clientes" logo antes do catálogo completo, separada por uma linha, e os 3
primeiros também entram no carrossel pequeno "❤️ Mais desejados" perto do
topo da página — no lugar de onde antes ficava "🔥 Mais vendidos". O campo
"Mais vendido" continua existindo no formulário de cada jogo (caso você
queira usar de novo no futuro), só que não aparece em nenhum lugar do site
por enquanto.

**Comprar vários jogos de uma vez:** dentro do popup de conta, cada jogo da
lista de desejos tem uma caixinha de marcar (vem tudo marcado por padrão) —
a pessoa desmarca o que não quiser levar agora e clica em **"Comprar
selecionados"**. Isso abre um Pix único com o valor total, e depois de
pagar a mensagem do WhatsApp já vem com a lista de todos os jogos e o total,
igual já acontecia com um jogo só. No histórico do admin (📋 Pedidos), cada
jogo desse pedido continua aparecendo como uma linha separada — só que
todas criadas no mesmo instante.

**Onde ficam guardados esses dados:** diferente dos jogos e comentários
(que ficam no banco Neon), a conta do cliente e a lista de desejos ficam
guardadas no mesmo projeto Supabase que já guarda as imagens — numa parte
diferente dele (o banco de dados do Supabase, não o Storage). Cada cliente
só consegue ver a própria lista — nunca a de outra pessoa — porque o banco
tem uma trava de segurança (chamada "Row Level Security") configurada
direto nas tabelas, então mesmo se alguém tentasse burlar o site pelo
navegador, não conseguiria ler a lista de outro cliente.

---

## Por que as imagens são comprimidas automaticamente

O que "pesa" no armazenamento de imagens não é o espaço ocupado pelos
arquivos — é quantas vezes cada visitante baixa essas imagens. Uma foto de
celular sem comprimir pode ter vários MB, e isso se repete a cada visita
ao site.

Por isso, toda capa de jogo e toda captura de tela que você sobe no admin
passa por uma compressão automática antes de ser salva:

- **Capa do jogo**: redimensionada pra no máximo 900px no lado maior e
  convertida pra WebP (formato mais leve que JPEG/PNG, sem perda visível de
  qualidade). Acontece no servidor, em `lib/imageResize.ts`.
- **Capturas de tela**: redimensionadas pra no máximo 1600px e também
  convertidas pra WebP — só que isso acontece no NAVEGADOR, antes mesmo do
  arquivo ser enviado (em `lib/imageCompression.ts`), porque essas imagens
  vão direto do seu computador pro Supabase Storage, sem passar pelo servidor.

Você não precisa fazer nada diferente — é só escolher a imagem normalmente
que ela já sai comprimida do seu lado. Isso reduz o consumo de banda em
mais de 80% na prática, sem mudar a aparência das imagens no site.

> **Nota:** as imagens que já existiam antes da migração pro Supabase
> também são comprimidas — isso acontece uma vez, durante a própria
> migração (veja "Migrando as imagens do Vercel Blob pro Supabase" logo
> abaixo).

---

## Migrando as imagens do Vercel Blob pro Supabase

Se você já tinha jogos cadastrados com capas no Vercel Blob (a forma como o
site guardava imagens antes), existe um script pronto que copia tudo pro
Supabase automaticamente, comprimindo cada imagem no processo.

**Antes de rodar**, você precisa:
1. Ter completado o Passo 4 (criar o projeto Supabase, o bucket
   `game-images`, e configurado as 3 variáveis `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no seu
   `.env.local`).
2. Ter certeza de que sua Blob Store antiga na Vercel **não está
   suspensa** — se você chegou a estourar o limite de banda e ela ficou
   suspensa por cobrança, precisa reativá-la (ou esperar os 30 dias do
   plano gratuito) antes de conseguir migrar, porque o script precisa
   conseguir *baixar* as imagens de lá.

Depois disso, na sua máquina, dentro da pasta do projeto:

```bash
npm install
node scripts/migrate-images-to-supabase.mjs
```

O script mostra o progresso jogo por jogo e, no final, um resumo de
quantas imagens foram migradas, quantas já estavam migradas (ele é seguro
de rodar mais de uma vez) e quantas falharam. Se alguma falhar, é só rodar
de novo depois — ele pula o que já deu certo e tenta de novo só o resto.

**O script não apaga nada do Vercel Blob.** Depois de conferir no site que
todas as imagens estão aparecendo certinho (vindas do Supabase agora), você
pode excluir a Blob Store antiga pelo painel da Vercel
(**Storage → sua store → Settings → Delete**) pra não correr o risco de
ela voltar a gerar cobrança.

---

## Por que existe uma rotina diária de manutenção

O plano gratuito do Supabase pausa automaticamente qualquer projeto que
fique **7 dias sem atividade de banco de dados**. O problema é que este
site usa o Supabase só pra guardar imagens (Storage) — nunca consulta o
banco de dados dele diretamente — então, mesmo com o catálogo recebendo
visitas normalmente, o projeto correria risco de ser pausado por
"inatividade" do jeito que o Supabase mede isso. Se isso acontecesse,
**todas as imagens do site parariam de carregar** até alguém entrar no
painel do Supabase e reativar manualmente.

Pra evitar isso, existe uma rotina automática que roda uma vez por dia
(configurada em `vercel.json`, na chave `"crons"`) e chama a rota
`app/api/cron/keepalive/route.ts`, que só insere uma linha bem pequena
numa tabela chamada `keepalive` (criada no Passo 4) — o suficiente pra
contar como "atividade" e manter o projeto sempre ativo. A variável
`CRON_SECRET` existe só pra confirmar que quem está chamando essa rota é
realmente a Vercel, e não outra pessoa que descobriu o link.

Você não precisa fazer nada no dia a dia — uma vez configurado (Passo 4 +
a variável `CRON_SECRET` no Passo 5), isso roda sozinho pra sempre.

---

## Domínio próprio (opcional)

Se você tiver ou comprar um domínio (tipo `xanswitch.com.br`), dá pra
conectar em **Settings → Domains** no seu projeto da Vercel. Sem isso, o
link `.vercel.app` já funciona normalmente, só é menos "bonito".

---

## Rodando na sua máquina (opcional, só se quiser mexer no código)

```bash
npm install
cp .env.example .env.local
# edite .env.local com os valores reais (rode `vercel env pull .env.local`
# se já tiver o projeto linkado com a Vercel CLI, que baixa tudo sozinho)
npm run dev
```

Abre em `http://localhost:3000`.

---

## Estrutura do projeto (se quiser entender o código)

```
app/
  page.tsx              → catálogo público (busca + cards + dados de cada jogo)
  jogo/[id]/page.tsx      → link direto de um jogo específico (abre o catálogo já com o modal dele aberto, com prévia pra redes sociais)
  CatalogClient.tsx      → a parte interativa do catálogo público (abre o modal de compra, login, lista de desejos)
  PurchaseModal.tsx       → o modal de compra de UM jogo (resumo → checklist → Pix → WhatsApp → compartilhar)
  BulkPurchaseModal.tsx    → o modal de compra de VÁRIOS jogos da lista de desejos de uma vez
  AccountModal.tsx         → o popup de login (e-mail e senha) e da lista de desejos do cliente
  SiteHeader.tsx           → logo + ícone de conta (com o número da lista de desejos) + redes sociais
  orderActions.ts          → Server Action que registra cada tentativa de compra e monta o link de compartilhar da compra em lote
  layout.tsx, globals.css → visual (cores, fontes, estilo geral, CSS do modal de compra e do popup de conta)
  admin/
    page.tsx             → painel admin (protegido)
    AdminClient.tsx       → toda a interface do admin (grade, formulário, pedidos, mais desejados, etc)
    actions.ts            → as ações de adicionar/editar/arquivar/excluir/registrar pedido
    login/page.tsx         → tela de login
  api/
    screenshot-upload/route.ts   → autoriza o upload das capturas de tela direto do navegador pro Supabase
    cron/keepalive/route.ts       → rotina diária que mantém o projeto Supabase ativo
    wishlist-counts/route.ts      → contagem de favoritos por jogo, buscada direto do navegador pra vitrine "Mais desejados"
lib/
  catalogData.ts       → busca os dados do catálogo (jogos, avaliações, mais desejados) — usado tanto pela página principal quanto pelo link direto de um jogo
  db.ts               → funções que conversam com o banco de dados (catálogo, Postgres/Neon)
  auth.ts             → login/sessão (senha + cookie assinado) — usado por /admin
  wishlist.ts          → login do cliente (e-mail e senha) e lista de desejos — roda no navegador, fala direto com o Supabase
  whatsapp.ts         → monta os links do WhatsApp (contato do cabeçalho e confirmação de pagamento)
  pix.ts              → monta o Pix (BR Code + QR Code) usando seus dados de recebedor
  color.ts            → escolhe texto claro/escuro pra contrastar com a cor da etiqueta
  imageResize.ts       → comprime a capa do jogo no servidor antes de salvar (usa a lib "sharp")
  imageCompression.ts  → comprime as capturas de tela no navegador antes de enviar (usa <canvas>)
  supabaseAdmin.ts      → sobe/apaga imagens e lê a contagem de "mais desejados" no Supabase (chave secreta — só roda no servidor)
  supabaseBrowser.ts    → cliente Supabase do navegador — upload de captura de tela, login e lista de desejos
  supabaseImagesConfig.ts → só o nome do bucket, compartilhado entre os dois arquivos acima
scripts/migrate-images-to-supabase.mjs → migração única das imagens do Vercel Blob pro Supabase
db/schema.sql                 → cria as tabelas do catálogo (jogos, avaliações, pedidos etc) — rodado uma vez no Neon
db/migration-orders.sql        → só a tabela de pedidos, caso o site já exista e você só precise adicionar essa parte
db/migration-game-details.sql → só a descrição/capturas de tela, mesmo caso acima
db/migration-supabase-keepalive.sql → cria a tabela usada pela rotina diária (roda no Supabase, não no Neon)
db/migration-wishlist.sql     → cria as tabelas de conta do cliente e lista de desejos (roda no Supabase, não no Neon)
proxy.ts       → protege a página /admin (redireciona pro login se não tiver sessão)
vercel.json    → agenda a rotina diária de manutenção (cron job)
```

## Sobre a segurança do login

O painel usa uma checagem em duas camadas: uma rápida (existe cookie de
sessão?) que roda antes de qualquer coisa, e uma completa (o cookie é
válido de verdade?) que roda de novo dentro de cada página e ação do admin.
Isso segue a recomendação atual do Next.js — depender só da checagem
rápida não é mais considerado seguro o bastante sozinho.
