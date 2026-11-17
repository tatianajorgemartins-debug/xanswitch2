'use client';
/* eslint-disable @next/next/no-img-element */

// NOVO LAYOUT DA HOME — EM TESTE (só aparece em /admin/teste?d=novo).
// Segue o documento "Xan Switch — novo layout do site: decisões de UX, UI e
// SEO". Usa os dados reais do catálogo; "Comprar" leva pra /jogo/[id], que
// já abre a compra do jogo. Nada aqui muda a página inicial do site.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Item, ReviewItem } from '@/app/CatalogClient';
import type { CatalogData } from '@/lib/catalogData';
import { fallbackToOriginal, imageSrcSet } from '@/lib/imageVariants';
import { installmentsLabel } from '@/lib/installments';
import { NH_FONTES } from './fontes';
import './nova-home.css';

const INSTAGRAM = 'https://instagram.com/xan.switch';
const POR_PAGINA = 12;

type Ordem = 'vendidos' | 'desconto' | 'menor' | 'maior';
type Filtro = { tipo: 'todos' } | { tipo: 's2' } | { tipo: 'franquia'; nome: string } | { tipo: 'outros' };

const ehS2 = (it: Item) => it.platform === 'switch2' || it.platform === 'both';
const plataforma = (it: Item) => (it.platform === 'switch2' ? 'NINTENDO SWITCH 2' : it.platform === 'both' ? 'SWITCH E SWITCH 2' : 'NINTENDO SWITCH');
const reais = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

export default function NovaHome({ data }: { data: CatalogData }) {
  const { items, reviews, whatsappContactUrl } = data;
  const whats = whatsappContactUrl ?? 'https://wa.me/';
  const jogos = useMemo(() => items.filter((it) => !it.isUpcoming), [items]);
  const total = jogos.length;

  // Maior desconto do catálogo (vai no título)
  const maiorDesconto = useMemo(() => Math.max(0, ...jogos.map((it) => (it.isOnSale ? it.salePercent ?? 0 : 0))), [jogos]);

  // Jogo em destaque no topo: o de maior desconto com capa (senão, o 1º destaque)
  const destaque = useMemo(() => {
    const comCapa = jogos.filter((it) => it.imageUrl);
    const promo = [...comCapa].filter((it) => it.isOnSale).sort((a, b) => (b.salePercent ?? 0) - (a.salePercent ?? 0))[0];
    return promo ?? data.featuredItems.find((it) => it.imageUrl) ?? comCapa[0] ?? null;
  }, [jogos, data.featuredItems]);

  // "Os mais desejados": lista de desejos; sem ela, os mais vendidos
  const desejados = useMemo(() => {
    const base = data.mostWantedItems.length >= 4 ? data.mostWantedItems : data.bestsellerItems;
    const lista = base.length ? base : jogos;
    return lista.filter((it) => it.imageUrl).slice(0, 10);
  }, [data.mostWantedItems, data.bestsellerItems, jogos]);

  // Filtros por franquia, com a quantidade de jogos de cada uma
  const chips = useMemo(() => {
    const conta = new Map<string, number>();
    for (const it of jogos) if (it.franchise) conta.set(it.franchise, (conta.get(it.franchise) ?? 0) + 1);
    const franquias = [...conta.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const nomes = new Set(franquias.map(([f]) => f));
    const outros = jogos.filter((it) => !it.franchise || !nomes.has(it.franchise)).length;
    const s2 = jogos.filter(ehS2).length;
    const lista: { rotulo: string; n: number; filtro: Filtro }[] = [{ rotulo: 'Todos', n: total, filtro: { tipo: 'todos' } }];
    if (s2) lista.push({ rotulo: 'Switch 2', n: s2, filtro: { tipo: 's2' } });
    for (const [f, n] of franquias) lista.push({ rotulo: f, n, filtro: { tipo: 'franquia', nome: f } });
    if (outros) lista.push({ rotulo: 'Outros', n: outros, filtro: { tipo: 'outros' } });
    return { lista, nomes };
  }, [jogos, total]);

  const [filtro, setFiltro] = useState<Filtro>({ tipo: 'todos' });
  const [ordem, setOrdem] = useState<Ordem>('vendidos');
  const [busca, setBusca] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const catalogo = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = jogos.filter((it) => {
      if (termo && !`${it.name} ${it.franchise ?? ''}`.toLowerCase().includes(termo)) return false;
      if (filtro.tipo === 's2') return ehS2(it);
      if (filtro.tipo === 'franquia') return it.franchise === filtro.nome;
      if (filtro.tipo === 'outros') return !it.franchise || !chips.nomes.has(it.franchise);
      return true;
    });
    if (ordem === 'vendidos') lista = [...lista].sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller));
    if (ordem === 'desconto') lista = [...lista].sort((a, b) => (b.isOnSale ? b.salePercent ?? 0 : 0) - (a.isOnSale ? a.salePercent ?? 0 : 0));
    if (ordem === 'menor') lista = [...lista].sort((a, b) => a.price - b.price);
    if (ordem === 'maior') lista = [...lista].sort((a, b) => b.price - a.price);
    return lista;
  }, [jogos, busca, filtro, ordem, chips.nomes]);

  const mesmoFiltro = (f: Filtro) =>
    f.tipo === filtro.tipo && (f.tipo !== 'franquia' || (filtro.tipo === 'franquia' && filtro.nome === f.nome));

  // Cabeçalho some ao rolar pra baixo e volta ao rolar pra cima
  const [escondido, setEscondido] = useState(false);
  useEffect(() => {
    let ultimo = window.scrollY;
    const rolou = () => {
      const y = window.scrollY;
      if (Math.abs(y - ultimo) < 6) return;
      setEscondido(y > ultimo && y > 120);
      ultimo = y;
    };
    window.addEventListener('scroll', rolou, { passive: true });
    return () => window.removeEventListener('scroll', rolou);
  }, []);

  // Carrossel
  const trilho = useRef<HTMLDivElement>(null);
  const rolarCarrossel = (dir: number) => {
    const el = trilho.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 260) + 16) * 2 });
  };

  // Avaliações: média e as três em destaque
  const notas = reviews.filter((r) => r.rating > 0);
  const media = notas.length ? notas.reduce((s, r) => s + r.rating, 0) / notas.length : 0;
  const mediaTxt = media.toFixed(1).replace('.', ',');
  const avaliacoes = [...reviews].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, 3);

  return (
    <div className={`nh ${NH_FONTES}`}>
      <a href="#catalogo" className="nh-pular">
        Pular para o catálogo
      </a>

      {/* ============ CABEÇALHO ============ */}
      <header className={`nh-topo${escondido ? ' is-escondido' : ''}`}>
        <div className="nh-topo-in">
          <a href="#inicio" className="nh-logo" aria-label="XAN Switch, início">
            <img src="/logo.png" alt="" width={116} height={48} />
          </a>
          <nav aria-label="Principal" className="nh-menu">
            <ul>
              <li>
                <a href="#catalogo" aria-current="page">
                  Jogos
                </a>
              </li>
              <li>
                <a href="#catalogo" onClick={() => setFiltro({ tipo: 's2' })}>
                  Switch 2
                </a>
              </li>
              <li>
                <a href="#destaques">Promoções</a>
              </li>
              <li>
                <a href="#como-funciona">Como funciona</a>
              </li>
              <li>
                <a href="#duvidas">Dúvidas</a>
              </li>
            </ul>
          </nav>
          <form
            role="search"
            className="nh-busca"
            onSubmit={(e) => {
              e.preventDefault();
              document.getElementById('catalogo')?.scrollIntoView();
            }}
          >
            <label htmlFor="nh-busca" className="nh-vh">
              Buscar jogo
            </label>
            <input
              id="nh-busca"
              type="search"
              placeholder="Buscar jogo (ex.: Zelda)"
              autoComplete="off"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setMostrar(POR_PAGINA);
              }}
            />
            <button type="submit" aria-label="Buscar">
              <Icone d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5" />
            </button>
          </form>
          <div className="nh-topo-acoes">
            <a href={whats} className="nh-btn-sec nh-btn-p" target="_blank" rel="noopener noreferrer">
              <IconeWhats /> <span className="nh-so-largo">WhatsApp</span>
            </a>
            <Link href="/?conta=1" aria-label="Minha conta" className="nh-btn-sec nh-btn-icone">
              <Icone d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </Link>
          </div>
        </div>
      </header>

      <main id="inicio">
        {/* ============ TOPO ============ */}
        <section className="nh-hero nh-larg" aria-labelledby="nh-h1">
          <div className="nh-hero-texto">
            <p className="nh-selo">
              <Icone d="M20 6 9 17l-5-5" cor="var(--nh-verde)" larg={2.6} tam={14} />
              Código oficial Nintendo · Switch e Switch 2
            </p>
            <h1 id="nh-h1">
              Jogos digitais de Nintendo Switch{' '}
              {maiorDesconto > 0 ? (
                <>
                  com <span className="nh-verde">até {maiorDesconto}% off</span>
                </>
              ) : (
                <>
                  com <span className="nh-verde">preço de Pix</span>
                </>
              )}
            </h1>
            <p className="nh-hero-sub">
              Pague no Pix ou em até 12x no cartão e receba o código no seu e-mail ou WhatsApp <strong>no mesmo dia</strong>. Cada compra ainda
              vale um card colecionável e pontos para o próximo jogo.
            </p>
            <div className="nh-hero-botoes">
              <a href="#catalogo" className="nh-btn-comprar nh-btn-g">
                Ver os {total} jogos <Icone d="M5 12h14M13 6l6 6-6 6" larg={2.4} />
              </a>
              <a href="#quiz" className="nh-btn-sec nh-btn-g">
                Não sei qual jogo escolher
              </a>
            </div>
            <ul className="nh-confianca">
              {notas.length > 0 && (
                <li>
                  <span aria-hidden="true" className="nh-estrelas">
                    ★★★★★
                  </span>
                  <strong>{mediaTxt}</strong> em {notas.length} avaliações
                </li>
              )}
              <li>
                <Icone d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" cor="var(--nh-verde)" tam={16} />
                Tutorial de resgate incluso
              </li>
              <li>
                <Icone d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" cor="var(--nh-verde)" tam={16} />
                Pix confirmado na hora
              </li>
            </ul>
          </div>
          {destaque && <CardDestaque it={destaque} />}
        </section>

        {/* ============ COMO FUNCIONA ============ */}
        <section id="como-funciona" className="nh-larg nh-passos" aria-labelledby="nh-como">
          <h2 id="nh-como" className="nh-vh">
            Como funciona
          </h2>
          <ol>
            {[
              ['Escolha o jogo', `${total} jogos de Switch e Switch 2.`],
              ['Pague no Pix ou 12x', 'Pix com confirmação na hora.'],
              ['Receba o código', 'Por e-mail ou WhatsApp, no mesmo dia, com tutorial de resgate.']
            ].map(([t, d], i) => (
              <li key={t}>
                <span aria-hidden="true">{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ============ BLACK FRIDAY ============ */}
        <section className="nh-larg nh-bf-sec" aria-labelledby="nh-bf">
          <div className="nh-bf">
            <div>
              <p>BLACK FRIDAY XAN · 27 DE NOVEMBRO</p>
              <h2 id="nh-bf">Entre na lista e receba as ofertas antes de todo mundo</h2>
            </div>
            <a
              href={`${whats}?text=${encodeURIComponent('Quero entrar na lista da Black Friday')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nh-bf-btn"
            >
              Quero o aviso no WhatsApp
            </a>
          </div>
        </section>

        {/* ============ OS MAIS DESEJADOS ============ */}
        {desejados.length > 0 && (
          <section id="destaques" className="nh-larg nh-secao" aria-roledescription="carrossel" aria-labelledby="nh-dest">
            <div className="nh-secao-topo">
              <div>
                <h2 id="nh-dest">Os mais desejados</h2>
                <p>Os jogos que a galera mais quer.</p>
              </div>
              <div className="nh-setas">
                <button type="button" className="nh-btn-sec" aria-label="Jogos anteriores" onClick={() => rolarCarrossel(-1)}>
                  <Icone d="M15 6l-6 6 6 6" tam={20} larg={2.2} />
                </button>
                <button type="button" className="nh-btn-sec" aria-label="Próximos jogos" onClick={() => rolarCarrossel(1)}>
                  <Icone d="M9 6l6 6-6 6" tam={20} larg={2.2} />
                </button>
              </div>
            </div>
            <div className="nh-trilho" ref={trilho} tabIndex={0} role="group" aria-label="Jogos em destaque">
              {desejados.map((it, i) => (
                <CardJogo key={it.id} it={it} grande rotulo={`${i + 1} de ${desejados.length}`} />
              ))}
            </div>
          </section>
        )}

        {/* ============ CATÁLOGO ============ */}
        <section id="catalogo" className="nh-larg nh-secao" aria-labelledby="nh-cat">
          <div className="nh-secao-topo">
            <div>
              <h2 id="nh-cat">Catálogo completo</h2>
              <p>
                {total} jogos de Switch e Switch 2. Filtre por franquia.
              </p>
            </div>
            <div className="nh-ordem">
              <label htmlFor="nh-ordem">Ordenar</label>
              <select id="nh-ordem" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                <option value="vendidos">Mais vendidos</option>
                <option value="desconto">Maior desconto</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
              </select>
            </div>
          </div>
          <div className="nh-chips" role="group" aria-label="Filtrar por franquia">
            {chips.lista.map((c) => {
              const on = mesmoFiltro(c.filtro);
              return (
                <button
                  key={c.rotulo}
                  type="button"
                  aria-pressed={on}
                  className={`nh-chip${on ? ' is-on' : ''}`}
                  onClick={() => {
                    setFiltro(c.filtro);
                    setMostrar(POR_PAGINA);
                  }}
                >
                  {on && <Icone d="M20 6 9 17l-5-5" tam={14} larg={3} />}
                  {c.rotulo} <span>{c.n}</span>
                </button>
              );
            })}
          </div>
          {busca && (
            <p className="nh-busca-info" role="status">
              {catalogo.length} {catalogo.length === 1 ? 'jogo' : 'jogos'} para “{busca}”.{' '}
              <button type="button" onClick={() => setBusca('')}>
                Limpar busca
              </button>
            </p>
          )}
          {catalogo.length > 0 ? (
            <div className="nh-grade">
              {catalogo.slice(0, mostrar).map((it) => (
                <CardJogo key={it.id} it={it} />
              ))}
            </div>
          ) : (
            <p className="nh-vazio">Nenhum jogo encontrado. Tente outro nome ou fale com a gente no WhatsApp.</p>
          )}
          {catalogo.length > mostrar && (
            <div className="nh-mais">
              <button type="button" className="nh-btn-sec nh-btn-g" onClick={() => setMostrar(catalogo.length)}>
                Ver todos os {catalogo.length} jogos
              </button>
            </div>
          )}
        </section>

        {/* ============ QUIZZES ============ */}
        <section id="quiz" className="nh-larg nh-secao" aria-labelledby="nh-quiz">
          <h2 id="nh-quiz" className="nh-h2-solo">
            Em dúvida? Deixa que a gente te ajuda
          </h2>
          <div className="nh-quizzes">
            <article className="nh-quiz is-zelda">
              <p className="nh-rotulo">QUIZ · VALE CARD</p>
              <h3>
                <Link className="nh-link-card" href="/testes">
                  Qual Link é você?
                </Link>
              </h3>
              <p>10 perguntas, 13 heróis. Termine o quiz e ganhe um card colecionável.</p>
              <p className="nh-quiz-cta">Começar a jornada →</p>
            </article>
            <article className="nh-quiz">
              <p className="nh-rotulo">RECOMENDAÇÃO</p>
              <h3>
                <Link className="nh-link-card" href="/testes">
                  Qual será seu próximo jogo?
                </Link>
              </h3>
              <p>Responda o que você curte e receba indicações do catálogo.</p>
              <p className="nh-quiz-cta">Descobrir meu próximo jogo →</p>
            </article>
          </div>
        </section>

        {/* ============ CARD + PONTOS ============ */}
        <section className="nh-larg nh-secao" aria-labelledby="nh-card">
          <div className="nh-colecao">
            <div>
              <p className="nh-rotulo is-ouro">SÓ NA XAN</p>
              <h2 id="nh-card">Todo jogo vem com um card colecionável e pontos de desconto</h2>
              <p>
                Cada jogo vale de 1 a 5 pontos no card. Junte a coleção e use os pontos para pagar menos no próximo jogo.
              </p>
              <Link href="/?conta=1">Ver minha coleção e meus pontos</Link>
            </div>
            <div className="nh-cards-leque" aria-hidden="true">
              {desejados.slice(0, 3).map((it) => (
                <img key={it.id} src={it.imageUrl!} srcSet={imageSrcSet(it.imageUrl)} sizes="160px" alt="" loading="lazy" decoding="async" onError={fallbackToOriginal} />
              ))}
            </div>
          </div>
        </section>

        {/* ============ AVALIAÇÕES ============ */}
        {avaliacoes.length > 0 && (
          <section className="nh-larg nh-secao" aria-labelledby="nh-aval">
            <div className="nh-secao-topo">
              <div>
                <h2 id="nh-aval">Quem comprou, recomenda</h2>
                <p>
                  <span aria-hidden="true" className="nh-estrelas">
                    ★★★★★
                  </span>{' '}
                  <strong>{mediaTxt} de 5</strong> · {notas.length} avaliações
                </p>
              </div>
            </div>
            <div className="nh-avaliacoes">
              {avaliacoes.map((r) => (
                <Avaliacao key={r.id} r={r} />
              ))}
            </div>
          </section>
        )}

        {/* ============ PERGUNTAS FREQUENTES ============ */}
        <section id="duvidas" className="nh-faq" aria-labelledby="nh-faq">
          <h2 id="nh-faq">Perguntas frequentes</h2>
          {FAQ.map(([p, r]) => (
            <details key={p}>
              <summary>
                {p}
                <Icone d="m6 9 6 6 6-6" tam={20} classe="nh-chev" />
              </summary>
              <p>{r}</p>
            </details>
          ))}
        </section>
      </main>

      {/* ============ RODAPÉ ============ */}
      <footer className="nh-rodape">
        <div className="nh-larg nh-rodape-in">
          <div>
            <img src="/logo.png" alt="XAN Switch" width={120} height={50} loading="lazy" />
            <p>Nintendo mais barato. Jogos digitais de Switch e Switch 2 com código oficial, pagamento no Pix e entrega no mesmo dia.</p>
          </div>
          <nav aria-label="Rodapé">
            <h2>Loja</h2>
            <ul>
              <li>
                <a href="#catalogo">Todos os jogos</a>
              </li>
              <li>
                <a href="#catalogo" onClick={() => setFiltro({ tipo: 's2' })}>
                  Jogos de Switch 2
                </a>
              </li>
              <li>
                <a href="#duvidas">Como resgatar o código</a>
              </li>
              <li>
                <Link href="/privacidade">Política de privacidade</Link>
              </li>
            </ul>
          </nav>
          <div>
            <h2>Atendimento</h2>
            <ul>
              <li>
                <a href={whats} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
                  Instagram @xan.switch
                </a>
              </li>
              <li className="nh-pendente">[CNPJ e razão social]</li>
            </ul>
          </div>
          <div>
            <h2>Pagamento</h2>
            <ul className="nh-pagamentos">
              <li>Pix</li>
              <li>Cartão em até 12x</li>
            </ul>
          </div>
        </div>
        <p className="nh-larg nh-seo">
          Comprar jogos digitais de Nintendo Switch com desconto: na XAN Switch você encontra Zelda, Mario, Pokémon, Donkey Kong e outros títulos
          de Switch e Switch 2 com código oficial, pagamento via Pix ou cartão e entrega rápida. Nintendo Switch é marca registrada da Nintendo; a
          XAN Switch é uma loja independente.
        </p>
      </footer>

      <a href={whats} className="nh-whats-flutuante" aria-label="Falar no WhatsApp" target="_blank" rel="noopener noreferrer">
        <IconeWhats tam={26} />
      </a>
    </div>
  );
}

const FAQ: [string, string][] = [
  [
    'É seguro comprar jogo digital por código?',
    'Sim. Você recebe um código oficial Nintendo para resgatar na eShop, com tutorial passo a passo e suporte pelo WhatsApp.'
  ],
  ['Em quanto tempo recebo o código?', 'No mesmo dia, por e-mail ou WhatsApp. No Pix a confirmação do pagamento é na hora.'],
  ['Funciona no Switch 2?', 'Sim. Os jogos marcados “Switch 2” são do console novo, e a maioria dos jogos de Switch também roda no Switch 2.'],
  [
    'Preciso de conta de outro país na eShop?',
    'Os códigos são da eShop japonesa: para resgatar, sua conta muda a região para Japão por um momento, e a gente manda o passo a passo. A Nintendo só deixa trocar a região com o saldo da eShop zerado.'
  ],
  [
    'Como funcionam os pontos e o card?',
    'Cada compra vale um card colecionável, e cada card vale de 1 a 5 pontos. Os pontos viram desconto no próximo jogo (nos jogos participantes, pagando no Pix).'
  ]
];

// Card do jogo: só o nome é link (a área clicável cobre o card todo); o
// botão "Comprar" fica por cima, separado.
function CardJogo({ it, grande = false, rotulo }: { it: Item; grande?: boolean; rotulo?: string }) {
  const href = `/jogo/${it.id}`;
  return (
    <article
      className={`nh-card${grande ? ' is-grande' : ''}`}
      {...(rotulo ? { role: 'group', 'aria-roledescription': 'slide', 'aria-label': rotulo } : {})}
    >
      <div className="nh-card-capa">
        {it.imageUrl ? (
          <img
            src={it.imageUrl}
            srcSet={imageSrcSet(it.imageUrl)}
            sizes={grande ? '260px' : '(max-width: 520px) 45vw, 240px'}
            alt=""
            loading="lazy"
            decoding="async"
            onError={fallbackToOriginal}
          />
        ) : (
          <span className="nh-sem-capa">{it.name}</span>
        )}
        <div className="nh-card-selos">
          {it.isOnSale && it.salePercent ? <span className="nh-off">-{it.salePercent}%</span> : null}
          {it.isBestseller && <span className="nh-tag">MAIS VENDIDO</span>}
        </div>
      </div>
      <header>
        <p className="nh-plataforma">{plataforma(it)}</p>
        <h3>
          <Link className="nh-link-card" href={href}>
            {it.name}
          </Link>
        </h3>
      </header>
      <div className="nh-preco">
        {it.isOnSale && it.originalPriceLabel && (
          <p className="nh-de">
            <s>{it.originalPriceLabel}</s>
          </p>
        )}
        <p className="nh-por">
          {reais(it.price)} <span>no Pix</span>
        </p>
        <p className="nh-parcelas">ou {installmentsLabel(it.price)}</p>
      </div>
      <footer>
        <Link href={href} className={grande ? 'nh-btn-comprar nh-card-btn' : 'nh-btn-add nh-card-btn'} tabIndex={-1} aria-hidden="true">
          Comprar
        </Link>
      </footer>
    </article>
  );
}

function CardDestaque({ it }: { it: Item }) {
  return (
    <article className="nh-card nh-destaque">
      <div className="nh-card-capa">
        {it.imageUrl && (
          <img
            src={it.imageUrl}
            srcSet={imageSrcSet(it.imageUrl)}
            sizes="(max-width: 900px) 90vw, 440px"
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={fallbackToOriginal}
          />
        )}
        <div className="nh-card-selos">
          <span className="nh-tag">{it.isOnSale ? 'MAIOR DESCONTO DA LOJA' : 'EM DESTAQUE'}</span>
        </div>
      </div>
      <header className="nh-destaque-topo">
        <div>
          <p className="nh-plataforma">{plataforma(it)}</p>
          <h2>
            <Link className="nh-link-card" href={`/jogo/${it.id}`}>
              {it.name}
            </Link>
          </h2>
        </div>
        {it.isOnSale && it.salePercent ? <span className="nh-off is-grande">-{it.salePercent}%</span> : null}
      </header>
      <footer className="nh-destaque-pe">
        <div className="nh-preco">
          {it.isOnSale && it.originalPriceLabel && (
            <p className="nh-de">
              <s>{it.originalPriceLabel}</s>
            </p>
          )}
          <p className="nh-por is-grande">
            {reais(it.price)} <span>no Pix</span>
          </p>
          <p className="nh-parcelas">ou {installmentsLabel(it.price)}</p>
        </div>
        <Link href={`/jogo/${it.id}`} className="nh-btn-comprar nh-card-btn" tabIndex={-1} aria-hidden="true">
          Comprar
        </Link>
      </footer>
    </article>
  );
}

function Avaliacao({ r }: { r: ReviewItem }) {
  return (
    <figure className="nh-aval">
      <blockquote>
        <span aria-label={`${r.rating} de 5 estrelas`} className="nh-estrelas">
          {'★'.repeat(Math.round(r.rating))}
        </span>
        <p>{r.comment}</p>
      </blockquote>
      <figcaption>
        <strong>{r.name}</strong>
        {r.instagram ? ` · ${r.instagram.startsWith('@') ? r.instagram : `@${r.instagram}`}` : ' · cliente'}
      </figcaption>
    </figure>
  );
}

function Icone({ d, tam = 18, larg = 2, cor = 'currentColor', classe }: { d: string; tam?: number; larg?: number; cor?: string; classe?: string }) {
  return (
    <svg aria-hidden="true" className={classe} width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={larg} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function IconeWhats({ tam = 18 }: { tam?: number }) {
  return <Icone d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12Z" tam={tam} />;
}
