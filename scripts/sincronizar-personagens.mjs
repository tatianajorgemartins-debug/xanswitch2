// Sincroniza os personagens do "Silhueta do Dia" com a pasta de imagens.
//
// Uso: duplo clique em "SINCRONIZAR PERSONAGENS.bat" (ou
//      node scripts/sincronizar-personagens.mjs [pasta das imagens])
//
// O que faz:
//  1. procura as imagens na pasta SILHUETA (inclusive subpastas);
//  2. pra cada uma, gera duas imagens otimizadas em public/jogos/silhueta/
//     (WebP, até 600 px): a colorida e a silhueta preta. Os arquivos têm um
//     nome embaralhado ("imagem" no JSON), pra resposta não aparecer no
//     endereço da imagem;
//  3. acrescenta os personagens novos em data/jogos/personagens.json, com o
//     que der pra deduzir do nome do arquivo, "revisar": true e
//     "ativo_desde" = amanhã (assim o desafio de hoje não muda);
//  4. avisa: imagem que sumiu da pasta, nome repetido, imagem sem fundo
//     transparente e nível com menos de 7 personagens.
//
// NUNCA apaga personagem nem muda o que você escreveu no JSON. Só acrescenta
// campos que faltam (imagem, arquivo_original, ativo_desde, inativo_desde).
//
// Nível do personagem novo: vem da subpasta (facil, medio, dificil, insano)
// ou do fim do nome do arquivo ("TOAD - FÁCIL.png"). Sem nenhum dos dois,
// entra como "medio" pra você revisar.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { diaEm, addDias } from '../lib/jogos/dia.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = path.resolve(process.argv[2] ?? 'C:/Users/xandx/Documents/MINHAS VENDAS/SITE/Jogos interativos/SILHUETA');
const ARQUIVO_JSON = path.join(RAIZ, 'data', 'jogos', 'personagens.json');
const SAIDA = path.join(RAIZ, 'public', 'jogos', 'silhueta');
const EXTENSOES = new Set(['.png', '.webp', '.avif', '.jpg', '.jpeg', '.gif']);
const NIVEIS = ['facil', 'medio', 'dificil', 'insano'];
const MINIMO_POR_NIVEL = 7;
const LADO_MAX = 600;
const LADO_SILHUETA = 1100;

const hoje = diaEm();
const amanha = addDias(hoje, 1);

const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (s) => semAcento(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const nivelDe = (s) => {
  const n = slug(s ?? '');
  return NIVEIS.includes(n) ? n : null;
};
const tituloDe = (s) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');

function listarImagens(pasta) {
  const r = [];
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) r.push(...listarImagens(p));
    else if (EXTENSOES.has(path.extname(e.name).toLowerCase())) r.push(p);
  }
  return r;
}

// JSON com listas curtas numa linha só (fica mais fácil de editar).
function formatarJson(lista) {
  return (
    JSON.stringify(lista, null, 2).replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (_, dentro) => `[${dentro.split(/,\s+/).join(', ')}]`) + '\n'
  );
}

// Gera a colorida e a silhueta. Devolve false se a imagem não tem fundo
// transparente (aí não gera nada).
async function processarImagem(origem, nomeBase) {
  const colorida = path.join(SAIDA, `${nomeBase}-c.webp`);
  const silhueta = path.join(SAIDA, `${nomeBase}-s.webp`);

  const { data, info } = await sharp(origem).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alfa = (x, y) => data[(y * w + x) * 4 + 3];
  let transparentes = 0;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = alfa(x, y);
      if (a < 16) transparentes++;
      if (a > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const cantos = [alfa(0, 0), alfa(w - 1, 0), alfa(0, h - 1), alfa(w - 1, h - 1)];
  if (cantos.some((a) => a >= 16) || transparentes / (w * h) < 0.05 || x1 < 0) return false;

  const atualizada = (f) => fs.existsSync(f) && fs.statSync(f).mtimeMs >= fs.statSync(origem).mtimeMs;
  if (atualizada(colorida) && atualizada(silhueta)) return true;

  // Corta o espaço vazio em volta (com uma folguinha) e reduz.
  const folga = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  const left = Math.max(0, x0 - folga);
  const top = Math.max(0, y0 - folga);
  const recorte = { left, top, width: Math.min(w, x1 + folga + 1) - left, height: Math.min(h, y1 + folga + 1) - top };
  const reduzida = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract(recorte)
    .resize({ width: LADO_MAX, height: LADO_MAX, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: rw, height: rh } = reduzida.info;
  // (a colorida e a silhueta têm a mesma proporção: o jogo põe uma sobre a outra)
  await sharp(reduzida.data, { raw: { width: rw, height: rh, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(colorida);

  // Silhueta: todo pixel visível vira preto sólido. Pixels bem
  // transparentes (sombra no chão, brilhos) somem; a borda fica suave.
  // Sai maior que a colorida (o Difícil e o Insano dão zoom nela) — como é
  // uma mancha de uma cor só, o arquivo continua pequeno.
  const grande = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract(recorte)
    .resize({ width: LADO_SILHUETA, height: LADO_SILHUETA, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const s = Buffer.from(grande.data);
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3];
    s[i] = s[i + 1] = s[i + 2] = 0;
    s[i + 3] = a < 70 ? 0 : a >= 150 ? 255 : Math.round(((a - 70) / 80) * 255);
  }
  await sharp(s, { raw: { width: grande.info.width, height: grande.info.height, channels: 4 } })
    .webp({ lossless: true })
    .toFile(silhueta);
  return true;
}

async function main() {
  if (!fs.existsSync(ORIGEM)) {
    console.error(`\n✖ Não achei a pasta das imagens:\n  ${ORIGEM}\n`);
    process.exit(1);
  }
  let lista;
  try {
    lista = JSON.parse(fs.readFileSync(ARQUIVO_JSON, 'utf8'));
    if (!Array.isArray(lista)) throw new Error('o arquivo não é uma lista [ ... ]');
  } catch (e) {
    // JSON com erro de digitação: não mexe em nada.
    console.error(`\n✖ O personagens.json está com erro e não foi alterado:\n  ${e.message}\n  Arrume o arquivo e rode de novo.\n`);
    process.exit(1);
  }
  fs.mkdirSync(SAIDA, { recursive: true });
  const original = formatarJson(lista);

  const avisos = [];
  const novos = [];
  const porArquivo = new Map(lista.map((p) => [p.arquivo_original, p]));
  const ids = new Set(lista.map((p) => p.id));
  const arquivos = listarImagens(ORIGEM);
  const vistos = new Set();

  for (const arquivo of arquivos) {
    const rel = path.relative(ORIGEM, arquivo).split(path.sep).join('/');
    vistos.add(rel);
    const partes = rel.split('/');
    const nivelPasta = partes.slice(0, -1).map(nivelDe).find(Boolean) ?? null;
    const base = path.basename(arquivo, path.extname(arquivo));
    const traco = base.lastIndexOf(' - ');
    const nomeParte = (traco >= 0 ? base.slice(0, traco) : base).trim();
    const nivelNome = traco >= 0 ? nivelDe(base.slice(traco + 3)) : null;
    const nivel = nivelPasta ?? nivelNome;

    let p = porArquivo.get(rel);
    if (!p) {
      // Mesmo arquivo, só mudou de subpasta?
      const mesmoNome = lista.find((q) => q.arquivo_original && path.posix.basename(q.arquivo_original) === path.posix.basename(rel) && !fs.existsSync(path.join(ORIGEM, q.arquivo_original)));
      if (mesmoNome) {
        mesmoNome.arquivo_original = rel;
        p = mesmoNome;
        porArquivo.set(rel, p);
      }
    }
    if (!p) {
      let id = slug(nomeParte) || 'personagem';
      if (ids.has(id)) {
        avisos.push(`Nome repetido: "${rel}" gera o mesmo id de outro personagem ("${id}"). Entrou como "${id}-2"... confira.`);
        let n = 2;
        while (ids.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      ids.add(id);
      p = {
        id,
        nome: tituloDe(nomeParte),
        aceitos: [],
        franquia: '',
        jogo: '',
        estreia: null,
        tipo: '',
        niveis: [nivel ?? 'medio'],
        arquivo_original: rel,
        ativo_desde: amanha,
        revisar: true
      };
      if (!nivel) avisos.push(`"${rel}": sem nível no nome nem na subpasta — entrou como "medio", confira.`);
      lista.push(p);
      porArquivo.set(rel, p);
      novos.push(p);
    }
    if (!p.imagem) p.imagem = crypto.randomBytes(6).toString('hex');
    if (!p.ativo_desde) p.ativo_desde = amanha;

    try {
      const ok = await processarImagem(arquivo, p.imagem);
      if (!ok) {
        avisos.push(`"${rel}" não tem fundo transparente — ficou fora do sorteio ("ativo": false). Troque por um PNG/WebP sem fundo.`);
        if (novos.includes(p)) p.ativo = false;
      }
    } catch (e) {
      avisos.push(`"${rel}": não consegui ler a imagem (${e.message}).`);
      if (novos.includes(p)) p.ativo = false;
    }
  }

  for (const p of lista) {
    if (p.arquivo_original && !vistos.has(p.arquivo_original)) {
      avisos.push(`A imagem de "${p.nome}" (${p.arquivo_original}) sumiu da pasta. O personagem continua no jogo com a imagem já copiada; pra tirar do sorteio, use "ativo": false.`);
    }
    // Desativado agora: guarda até quando valeu, pros dias passados não mudarem.
    if (p.ativo === false && !p.inativo_desde && p.ativo_desde && p.ativo_desde <= hoje) p.inativo_desde = amanha;
  }

  // Quantos estarão no sorteio amanhã, por nível.
  const ativoAmanha = (p) => p.ativo !== false && (!p.ativo_desde || p.ativo_desde <= amanha);
  const porNivel = Object.fromEntries(NIVEIS.map((n) => [n, lista.filter((p) => ativoAmanha(p) && (p.niveis ?? []).includes(n)).length]));
  for (const n of NIVEIS)
    if (porNivel[n] < MINIMO_POR_NIVEL)
      avisos.push(`O nível "${n}" tem só ${porNivel[n]} personagens ativos (o ideal é ${MINIMO_POR_NIVEL} ou mais, senão repete antes de uma semana).`);

  const novoJson = formatarJson(lista);
  if (novoJson !== original) fs.writeFileSync(ARQUIVO_JSON, novoJson);

  const revisar = lista.filter((p) => p.revisar);
  console.log('\n================ SILHUETA DO DIA ================');
  console.log(`${novos.length} personagens novos${novos.length ? ` (entram no jogo em ${amanha.split('-').reverse().join('/')})` : ''}`);
  for (const p of novos) console.log(`  + ${p.nome}  [${p.niveis.join(', ')}]`);
  console.log(`${revisar.length} para revisar no personagens.json${revisar.length ? ': ' + revisar.map((p) => p.id).join(', ') : ''}`);
  console.log(`Total por nível: ${NIVEIS.map((n) => `${n} ${porNivel[n]}`).join(' · ')}  (total ${lista.length})`);
  if (avisos.length) {
    console.log('\nAVISOS:');
    for (const a of avisos) console.log(`  ! ${a}`);
  }
  console.log('\nDepois de revisar, publique o site pra valer.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
