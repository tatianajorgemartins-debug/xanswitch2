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
3. Isso é tudo — o banco de dados (Neon) e o armazenamento de imagens (Vercel Blob)
   são criados de dentro do próprio painel da Vercel, sem precisar de outra conta.

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

## Passo 4 — Criar o armazenamento de imagens (Vercel Blob)

1. Ainda na aba **Storage** do seu projeto na Vercel, clique em
   **"Create Database"** de novo (ou **"Connect Store"**) e escolha
   **Blob**.
2. Dê um nome (ex: `xan-catalogo-imagens`) e conecte ao mesmo projeto.
3. Isso injeta automaticamente a variável `BLOB_READ_WRITE_TOKEN` — de novo,
   não precisa copiar nada manualmente.

---

## Passo 5 — Configurar suas variáveis (senha e WhatsApp)

1. No seu projeto na Vercel, vá em **Settings → Environment Variables**.
2. Adicione estas variáveis (`DATABASE_URL` e `BLOB_READ_WRITE_TOKEN` já
   foram criadas sozinhas nos passos anteriores):

   | Nome | Valor | Exemplo |
   |---|---|---|
   | `ADMIN_PASSWORD` | A senha que você vai digitar pra entrar em `/admin` | `MinhaSenh@Forte123` |
   | `WHATSAPP_NUMBER` | Seu número com DDI, só números | `5521999999999` |
   | `NEXT_PUBLIC_PIX_KEY` | Sua chave Pix (CPF, e-mail, telefone ou aleatória) | `17738585722` |
   | `NEXT_PUBLIC_PIX_RECEIVER_NAME` | Seu nome, como está na conta do banco (máx. 25 caracteres, sem acento) | `JOAO C ABREU ALEXANDRE` |
   | `NEXT_PUBLIC_PIX_RECEIVER_CITY` | Cidade da sua conta, sem acento (máx. 15 caracteres) | `NITEROI` |

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

## Por que as imagens são comprimidas automaticamente

O que "pesa" no Vercel Blob não é o espaço ocupado pelos arquivos — é
quantas vezes cada visitante baixa essas imagens. Uma foto de celular sem
comprimir pode ter vários MB, e isso se repete a cada visita ao site.

Por isso, toda capa de jogo e toda captura de tela que você sobe no admin
passa por uma compressão automática antes de ser salva:

- **Capa do jogo**: redimensionada pra no máximo 900px no lado maior e
  convertida pra WebP (formato mais leve que JPEG/PNG, sem perda visível de
  qualidade). Acontece no servidor, em `lib/imageResize.ts`.
- **Capturas de tela**: redimensionadas pra no máximo 1600px e também
  convertidas pra WebP — só que isso acontece no NAVEGADOR, antes mesmo do
  arquivo ser enviado (em `lib/imageCompression.ts`), porque essas imagens
  vão direto do seu computador pro Vercel Blob, sem passar pelo servidor.

Você não precisa fazer nada diferente — é só escolher a imagem normalmente
que ela já sai comprimida do seu lado. Isso reduz o consumo de banda em
mais de 80% na prática, sem mudar a aparência das imagens no site.

> **Nota:** essa compressão vale só pra imagens novas, enviadas a partir de
> agora. As imagens que já estavam no catálogo antes continuam do jeito que
> foram enviadas originalmente.

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
  CatalogClient.tsx      → a parte interativa do catálogo público (abre o modal de compra)
  PurchaseModal.tsx       → o modal de compra (resumo → checklist → Pix → WhatsApp)
  orderActions.ts          → Server Action que registra cada tentativa de compra
  layout.tsx, globals.css → visual (cores, fontes, estilo geral, CSS do modal de compra)
  admin/
    page.tsx             → painel admin (protegido)
    AdminClient.tsx       → toda a interface do admin (grade, formulário, pedidos, etc)
    actions.ts            → as ações de adicionar/editar/arquivar/excluir/registrar pedido
    login/page.tsx         → tela de login
  api/
    screenshot-upload/route.ts   → autoriza o upload das capturas de tela direto do navegador pro Vercel Blob
lib/
  db.ts               → funções que conversam com o banco de dados (catálogo, Postgres/Neon)
  auth.ts             → login/sessão (senha + cookie assinado) — usado por /admin
  whatsapp.ts         → monta os links do WhatsApp (contato do cabeçalho e confirmação de pagamento)
  pix.ts              → monta o Pix (BR Code + QR Code) usando seus dados de recebedor
  color.ts            → escolhe texto claro/escuro pra contrastar com a cor da etiqueta
  imageResize.ts       → comprime a capa do jogo no servidor antes de salvar (usa a lib "sharp")
  imageCompression.ts  → comprime as capturas de tela no navegador antes de enviar (usa <canvas>)
db/schema.sql                 → cria as tabelas do catálogo (jogos, avaliações, pedidos etc) — rodado uma vez no Neon
db/migration-orders.sql        → só a tabela de pedidos, caso o site já exista e você só precise adicionar essa parte
db/migration-game-details.sql → só a descrição/capturas de tela, mesmo caso acima
proxy.ts       → protege a página /admin (redireciona pro login se não tiver sessão)
```

## Sobre a segurança do login

O painel usa uma checagem em duas camadas: uma rápida (existe cookie de
sessão?) que roda antes de qualquer coisa, e uma completa (o cookie é
válido de verdade?) que roda de novo dentro de cada página e ação do admin.
Isso segue a recomendação atual do Next.js — depender só da checagem
rápida não é mais considerado seguro o bastante sozinho.
