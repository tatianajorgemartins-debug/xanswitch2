# XAN Switch — Catálogo (site completo)

Site com duas partes:

- **`/` — Catálogo público**: seus clientes acessam, veem os jogos e, ao clicar em
  qualquer um, abrem o WhatsApp com uma mensagem pronta (nome do jogo + preço).
- **`/admin` — Painel de administração**: protegido por senha. É onde você
  adiciona, edita, arquiva e exclui jogos do catálogo.

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
2. Adicione estas duas variáveis (as outras duas — `DATABASE_URL` e
   `BLOB_READ_WRITE_TOKEN` — já foram criadas sozinhas nos passos
   anteriores):

   | Nome | Valor | Exemplo |
   |---|---|---|
   | `ADMIN_PASSWORD` | A senha que você vai digitar pra entrar em `/admin` | `MinhaSenh@Forte123` |
   | `WHATSAPP_NUMBER` | Seu número com DDI, só números | `5521999999999` |

   Marque **Production**, **Preview** e **Development** pras duas.

3. Clique em **Save**.

> **Dica:** escolha uma senha só sua pro `ADMIN_PASSWORD`, de preferência
> diferente de outras senhas que você já usa. Qualquer pessoa com essa
> senha consegue adicionar/editar/excluir jogos do catálogo.

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
3. Pra tirar um jogo do catálogo sem apagar de vez, use **"📦 Arquivar"** —
   ele some do catálogo público mas fica guardado, e dá pra restaurar depois.
4. Pra editar ou excluir de vez, clique nos **⋮** (três pontinhos) no canto
   do card.
5. Mande o link `https://seu-link.vercel.app/` pros seus clientes — toda
   mudança que você fizer no admin aparece lá na hora, sem precisar
   republicar nada.

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
  page.tsx              → catálogo público (busca + cards + link do WhatsApp)
  CatalogClient.tsx      → a parte interativa do catálogo público
  layout.tsx, globals.css → visual (cores, fontes, estilo geral)
  admin/
    page.tsx             → painel admin (protegido)
    AdminClient.tsx       → toda a interface do admin (grade, formulário, etc)
    actions.ts            → as ações de adicionar/editar/arquivar/excluir
    login/page.tsx         → tela de login
lib/
  db.ts        → funções que conversam com o banco de dados
  auth.ts      → login/sessão (senha + cookie assinado)
  whatsapp.ts  → monta o link do WhatsApp com a mensagem certa
  color.ts     → escolhe texto claro/escuro pra contrastar com a cor da etiqueta
db/schema.sql  → o script que cria a tabela de jogos no banco
proxy.ts       → protege as páginas /admin (redireciona pro login se não tiver sessão)
```

## Sobre a segurança do login

O painel usa uma checagem em duas camadas: uma rápida (existe cookie de
sessão?) que roda antes de qualquer coisa, e uma completa (o cookie é
válido de verdade?) que roda de novo dentro de cada página e ação do admin.
Isso segue a recomendação atual do Next.js — depender só da checagem
rápida não é mais considerado seguro o bastante sozinho.
