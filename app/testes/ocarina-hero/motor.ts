// Motor do "Ocarina Hero": desenha a pista no <canvas> (requestAnimationFrame)
// e julga os toques. O tempo vem SEMPRE do relógio de áudio
// (AudioContext.currentTime, via SomOcarina) — assim notas, metrônomo e
// toques ficam sincronizados, e pausar o áudio pausa o jogo.
//
// Visual: a pista de pedra (public/jogos/ocarina/ui/pista.webp) em
// perspectiva, notas redondas da cor de cada pista e anéis dourados. O
// placar, o combo, os corações e a barra de progresso são HTML por cima
// (Palco.tsx), alimentados por onHud a cada quadro.
//
// latencia (segundos, da tela de calibração): quanto o som chega atrasado
// no ouvido. O jogo "atrasa" a pista e o julgamento nesse tanto.
import {
  DIFICULDADES,
  ENERGIA_ACERTO,
  ENERGIA_ERRO,
  ENERGIA_INICIAL,
  ENERGIA_TOQUE_VAZIO,
  PISTAS,
  PRECISAO_PADRAO,
  PRECISOES,
  PONTOS_BOM,
  PONTOS_PERFEITO,
  duracaoChart,
  estrelas,
  frequencia,
  indicePista,
  multiplicador,
  precisao,
  type Chart,
  type NotaChart,
  type Precisao,
  type ResultadoMusica
} from './ocarina';
import type { SomOcarina, Voz } from './som';

type Julgamento = 'perfeito' | 'bom' | 'erro';

type EstadoNota = {
  n: NotaChart;
  pista: number;
  julgada: Julgamento | null;
  segurando: boolean;
  voz: Voz | null;
  fimSegurar: number; // até quando segurou (nota longa)
};

export type HudMotor = {
  pontos: number;
  combo: number;
  mult: number;
  energia: number; // 0 a 1
  tempo: number; // segundos da música
  duracao: number;
};

// Onde ficam as pistas na tela (pra pôr os botões de toque em cima).
export type GeometriaMotor = { esquerda: number; largura: number; topo: number; acerto: number; base: number };

export type OpcoesMotor = {
  latencia: number;
  // letra de cada anel ('' = anel sem letra, ex: celular)
  rotulos: string[];
  onFim: (r: ResultadoMusica) => void;
  // Áudio da música, já decodificado (SomOcarina.carregarAudio). Sem ele,
  // toca a ocarina a cada acerto com um metrônomo de fundo.
  audio?: AudioBuffer | null;
  // Começar do meio da música (segundos) — usado no "testar daqui" do admin.
  comecarEm?: number;
  // Um clique seco no tempo de cada nota (referência, no teste do admin).
  clique?: boolean;
  // Quanto o toque pode sair do tempo e ainda valer (menu do jogo).
  precisao?: Precisao;
  onHud?: (h: HudMotor) => void;
  onGeometria?: (g: GeometriaMotor) => void;
};

// ---------- Imagens ----------

const UI = '/jogos/ocarina/ui/';
type Imagens = { pista: HTMLImageElement; anel: HTMLImageElement };
let imagens: Imagens | null = null;

// Começa a baixar as imagens do jogo (dá pra chamar antes, no menu).
export function carregarImagensOcarina(): Imagens | null {
  if (typeof Image === 'undefined') return null;
  if (imagens) return imagens;
  const img = (nome: string) => {
    const i = new Image();
    i.decoding = 'async';
    i.src = UI + nome;
    return i;
  };
  imagens = { pista: img('pista.webp'), anel: img('anel-vazio.webp') };
  return imagens;
}
const pronta = (i: HTMLImageElement | undefined): i is HTMLImageElement => Boolean(i && i.complete && i.naturalWidth > 0);

// ---------- Geometria da pista (em pixels de pista.webp, 1622×877) ----------
// Medida na imagem: as linhas douradas se encontram no horizonte (y = −366);
// a linha de acerto fica em y = 711, onde cada pista tem 250,7 px de largura.
const PISTA_W = 1622;
const PISTA_H = 877;
const P_CX = 813;
const P_ACERTO = 711;
const P_HORIZONTE = -366;
const P_LARG = 250.7;
const P_TOPO = 24;
const R_TOPO = (P_TOPO - P_HORIZONTE) / (P_ACERTO - P_HORIZONTE);
const K = 1 / R_TOPO - 1; // r(z) = 1 / (1 + K·z): z = 0 no acerto, 1 no fundo
const Z_MIN = -0.06;
// Fim do tapete verde (antes da borda de pedra): a luz e os rastros param aqui.
const Z_CAMPO = (1 / ((752 - P_HORIZONTE) / (P_ACERTO - P_HORIZONTE)) - 1) / K;

// Altura/largura das notas ovais (igual aos anéis de baixo).
const ACHATAMENTO = 0.55;

const ANTECEDENCIA_SOM = 0.25;
const ESPERA_INICIAL = 1.2;

type Particula = { x: number; y: number; vx: number; vy: number; vida: number; cor: string; r: number };

export class MotorOcarina {
  private notas: EstadoNota[];
  private inicio = 0;
  private raf = 0;
  private rodando = false;
  private acabou = false;
  private duracao: number;
  private antecedencia: number;
  private agendadoAte = -1; // último tempo (da música) com metrônomo agendado
  private cliqueAte = -1; // último tempo com clique de nota agendado
  private faixa: { parar: () => void; abafar: () => void } | null = null;
  private comecarEm: number;
  private janelaPerfeito: number;
  private janelaBom: number;

  private pontos = 0;
  private combo = 0;
  private maiorCombo = 0;
  private perfeitos = 0;
  private bons = 0;
  private erros = 0;
  private energia = ENERGIA_INICIAL;

  private apertada = PISTAS.map(() => false);
  private brilho = PISTAS.map(() => -10);
  private feedback = PISTAS.map(() => ({ texto: '', cor: '', t: -10 }));
  private particulas: Particula[] = [];

  private w = 0;
  private h = 0;
  private dpr = 1;
  // pista.webp → tela
  private tx = 0;
  private ty = 0;
  private sx = 1;
  private sy = 1;
  private fonte = 'Georgia, serif';
  private img: Imagens | null;
  private obs: ResizeObserver | null = null;
  private ultimoQuadro = 0;
  private quadros: number[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private chart: Chart,
    private som: SomOcarina,
    private op: OpcoesMotor
  ) {
    this.comecarEm = Math.max(0, op.comecarEm ?? 0);
    const prec = PRECISOES[op.precisao ?? PRECISAO_PADRAO] ?? PRECISOES[PRECISAO_PADRAO];
    this.janelaPerfeito = prec.perfeito;
    this.janelaBom = prec.bom;
    this.notas = chart.notas
      .filter((n) => n.t >= this.comecarEm - 0.02)
      .map((n) => ({ n, pista: indicePista(n.pista), julgada: null, segurando: false, voz: null, fimSegurar: 0 }));
    // Com áudio, a partida vai até o fim da música; sem, até a última nota.
    this.duracao = op.audio ? op.audio.duration : duracaoChart(chart);
    this.antecedencia = DIFICULDADES[chart.dificuldade].antecedencia;
    this.img = carregarImagensOcarina();
    const f = getComputedStyle(canvas).getPropertyValue('--oc-cinzel').trim();
    if (f) this.fonte = `${f}, Georgia, serif`;
    this.ajustarTamanho();
    if (typeof ResizeObserver !== 'undefined') {
      this.obs = new ResizeObserver(() => this.ajustarTamanho());
      this.obs.observe(canvas);
    }
  }

  get terminou(): boolean {
    return this.acabou;
  }

  // Quadros por segundo da última fração de segundo (pra conferir desempenho).
  get fps(): number {
    if (this.quadros.length < 2) return 0;
    const span = this.quadros[this.quadros.length - 1] - this.quadros[0];
    return span > 0 ? Math.round(((this.quadros.length - 1) * 1000) / span) : 0;
  }

  private ajustarTamanho() {
    // clientWidth/Height: tamanho real do layout, mesmo com o jogo girado
    // por CSS (celular em pé no modo "deitado").
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.canvas.clientWidth);
    this.h = Math.max(1, this.canvas.clientHeight);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    // Encaixa a pista: embaixo, centralizada, deixando a faixa da barra de
    // progresso. Com a tela em pé (celular), estica na altura.
    const { w, h } = this;
    const proporcao = PISTA_H / PISTA_W;
    const baixo = Math.max(40, h * 0.06);
    const altDisp = h - baixo - Math.min(110, h * 0.13) * 0.4;
    const pw = Math.min(w * 0.97, altDisp / proporcao);
    let ph = pw * proporcao;
    if (ph < altDisp * 0.75) ph = Math.min(altDisp * 0.9, ph * 2.4);
    // pista mais fina (fica estreita e comprida, como um corredor)
    const teclado = this.op.rotulos.some(Boolean);
    const pwFina = Math.min(pw, ph * (teclado ? 1.05 : 1.45));
    this.sx = pwFina / PISTA_W;
    this.sy = ph / PISTA_H;
    this.tx = (w - pwFina) / 2;
    this.ty = h - baixo - ph;
    const larg = P_LARG * 5 * this.sx;
    this.op.onGeometria?.({
      esquerda: this.tx + P_CX * this.sx - larg / 2,
      largura: larg,
      topo: this.Y(P_TOPO),
      acerto: this.Y(P_ACERTO),
      base: this.ty + ph
    });
    if (!this.rodando) this.desenhar(this.tempo());
  }

  private X(x: number) {
    return this.tx + x * this.sx;
  }
  private Y(y: number) {
    return this.ty + y * this.sy;
  }
  private r(z: number) {
    return 1 / (1 + K * Math.max(Z_MIN, z));
  }
  private yDe(z: number) {
    return this.Y(P_HORIZONTE + (P_ACERTO - P_HORIZONTE) * this.r(z));
  }
  private xDe(pista: number, z: number) {
    return this.X(P_CX + (pista - 2) * P_LARG * this.r(z));
  }

  // Tempo da música (segundos), já descontada a latência.
  private tempo(): number {
    return this.som.agora - this.inicio - this.op.latencia + this.comecarEm;
  }

  iniciar() {
    // Espera o bastante pra primeira nota ter tempo de descer a pista.
    const primeira = (this.notas[0]?.n.t ?? this.comecarEm) - this.comecarEm;
    const espera = Math.max(ESPERA_INICIAL, this.antecedencia - primeira + 0.4);
    this.inicio = this.som.agora + espera;
    if (this.op.audio) this.faixa = this.som.faixa(this.op.audio, this.inicio, this.comecarEm);
    this.rodando = true;
    this.raf = requestAnimationFrame(this.quadro);
  }

  async pausar() {
    if (!this.rodando || this.acabou) return;
    this.rodando = false;
    cancelAnimationFrame(this.raf);
    for (const e of this.notas) if (e.segurando) this.soltarNota(e);
    this.apertada = this.apertada.map(() => false);
    await this.som.pausar();
  }

  async continuar() {
    if (this.rodando || this.acabou) return;
    await this.som.continuar();
    this.rodando = true;
    this.raf = requestAnimationFrame(this.quadro);
  }

  destruir() {
    this.rodando = false;
    this.acabou = true;
    cancelAnimationFrame(this.raf);
    this.obs?.disconnect();
    this.faixa?.parar();
    for (const e of this.notas) e.voz?.parar();
  }

  // ---------- Toques ----------

  pressionar(pista: number) {
    if (!this.rodando || this.acabou || this.apertada[pista]) return;
    this.apertada[pista] = true;
    const t = this.tempo();
    let alvo: EstadoNota | null = null;
    let menor = Infinity;
    for (const e of this.notas) {
      if (e.pista !== pista || e.julgada) continue;
      const dt = Math.abs(e.n.t - t);
      if (e.n.t - t > this.janelaBom) break; // as próximas estão ainda mais longe
      if (dt <= this.janelaBom && dt < menor) {
        menor = dt;
        alvo = e;
      }
    }
    if (!alvo) {
      // Tocou sem nota: som abafado, perde o combo.
      this.som.erro();
      this.faixa?.abafar();
      this.combo = 0;
      this.energia -= ENERGIA_TOQUE_VAZIO;
      this.mostrar(pista, 'Errou', '#ff8a8a', t);
      return;
    }
    const perfeito = menor <= this.janelaPerfeito;
    alvo.julgada = perfeito ? 'perfeito' : 'bom';
    if (perfeito) this.perfeitos++;
    else this.bons++;
    this.combo++;
    this.maiorCombo = Math.max(this.maiorCombo, this.combo);
    this.pontos += (perfeito ? PONTOS_PERFEITO : PONTOS_BOM) * multiplicador(this.combo);
    this.energia = Math.min(1, this.energia + ENERGIA_ACERTO);
    this.brilho[pista] = t;
    this.mostrar(pista, perfeito ? 'Perfeito!' : 'Bom', perfeito ? '#ffe9a8' : '#c8f7c5', t);
    this.faisca(pista, perfeito ? 8 : 5);
    // Com áudio próprio, a música já está tocando: o acerto não faz som.
    const freq = frequencia(alvo.n.nota ?? PISTAS[pista].nota);
    if (alvo.n.dur) {
      alvo.segurando = true;
      alvo.fimSegurar = t;
      alvo.voz = this.op.audio ? null : this.som.nota(freq, this.som.agora, null);
    } else if (!this.op.audio) {
      this.som.nota(freq, this.som.agora, 0.3);
    }
  }

  soltar(pista: number) {
    this.apertada[pista] = false;
    for (const e of this.notas) if (e.pista === pista && e.segurando) this.soltarNota(e);
  }

  private soltarNota(e: EstadoNota) {
    e.segurando = false;
    e.voz?.parar();
    e.voz = null;
  }

  private mostrar(pista: number, texto: string, cor: string, t: number) {
    this.feedback[pista] = { texto, cor, t };
  }

  // Faíscas douradas (e da cor da pista) saindo do anel.
  private faisca(pista: number, n: number) {
    const x = this.xDe(pista, 0);
    const y = this.yDe(0);
    const esc = this.sx * 4;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = (90 + Math.random() * 160) * esc;
      this.particulas.push({
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        vida: 0.45 + Math.random() * 0.35,
        cor: i % 3 === 0 ? PISTAS[pista].cor : '#ffe08a',
        r: (1.5 + Math.random() * 2.5) * Math.max(0.6, esc * 0.5)
      });
    }
    if (this.particulas.length > 300) this.particulas.splice(0, this.particulas.length - 300);
  }

  // ---------- Laço ----------

  private quadro = (agoraMs: number) => {
    if (!this.rodando) return;
    const dtQuadro = this.ultimoQuadro ? Math.min(0.1, (agoraMs - this.ultimoQuadro) / 1000) : 0;
    this.ultimoQuadro = agoraMs;
    this.quadros.push(agoraMs);
    if (this.quadros.length > 61) this.quadros.shift();

    const t = this.tempo();
    if (!this.op.audio) this.agendarAcompanhamento(t);
    if (this.op.clique) this.agendarCliques();

    // Notas que passaram sem toque.
    for (const e of this.notas) {
      if (e.n.t > t) break;
      if (!e.julgada && t - e.n.t > this.janelaBom) {
        e.julgada = 'erro';
        this.faixa?.abafar();
        this.erros++;
        this.combo = 0;
        this.energia -= ENERGIA_ERRO;
        this.mostrar(e.pista, 'Errou', '#ff8a8a', t);
      }
      // Notas longas: pontos enquanto segura; acaba sozinha no fim.
      if (e.segurando && e.n.dur) {
        const fim = e.n.t + e.n.dur;
        this.pontos += dtQuadro * 40 * multiplicador(this.combo);
        e.fimSegurar = Math.min(t, fim);
        if (Math.random() < dtQuadro * 14) this.faisca(e.pista, 2);
        if (t >= fim) this.soltarNota(e);
      }
    }

    // Faíscas
    for (const p of this.particulas) {
      p.vida -= dtQuadro;
      p.x += p.vx * dtQuadro;
      p.y += p.vy * dtQuadro;
      p.vy += 420 * this.sx * 4 * dtQuadro;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);

    if (this.energia <= 0) {
      this.energia = 0;
      this.terminar(false);
      return;
    }
    if (t > this.duracao + (this.op.audio ? 0.3 : 1.2)) {
      this.terminar(true);
      return;
    }
    this.desenhar(t);
    this.raf = requestAnimationFrame(this.quadro);
  };

  // Clique seco no tempo de cada nota (som, sem a latência: a latência só
  // atrasa a imagem e o julgamento).
  private agendarCliques() {
    const tSom = this.som.agora - this.inicio + this.comecarEm;
    const ate = tSom + ANTECEDENCIA_SOM;
    let ultimo = -1;
    for (const e of this.notas) {
      if (e.n.t <= this.cliqueAte) continue;
      if (e.n.t > ate) break;
      // acorde = um clique só
      if (Math.abs(e.n.t - ultimo) > 0.001) {
        const quando = this.inicio + (e.n.t - this.comecarEm);
        if (quando >= this.som.agora - 0.01) this.som.clique(Math.max(quando, this.som.agora));
      }
      ultimo = e.n.t;
    }
    this.cliqueAte = Math.max(this.cliqueAte, ate);
  }

  // Metrônomo suave em cada tempo e um grave no começo de cada compasso.
  private agendarAcompanhamento(t: number) {
    const batida = 60 / this.chart.bpm;
    const ate = t + ANTECEDENCIA_SOM;
    let k = Math.max(0, Math.floor(this.agendadoAte / batida) + 1);
    const tom = frequencia(this.chart.tom ?? 'D2');
    for (; k * batida <= ate && k * batida <= this.duracao + 0.5; k++) {
      const quando = this.inicio + k * batida;
      if (quando < this.som.agora) continue;
      this.som.tick(quando, k % 4 === 0, 0.06);
      if (k % 4 === 0) this.som.grave(tom, quando, batida * 3);
      if (k % 4 === 2) this.som.grave(tom * 1.5, quando, batida * 1.6);
    }
    this.agendadoAte = Math.max(this.agendadoAte, (k - 1) * batida);
  }

  private terminar(completou: boolean) {
    if (this.acabou) return;
    this.acabou = true;
    this.rodando = false;
    cancelAnimationFrame(this.raf);
    for (const e of this.notas) e.voz?.parar();
    this.faixa?.parar();
    if (!completou) this.som.erro();
    const total = this.notas.length;
    const prec = precisao(this.perfeitos, this.bons, total);
    this.op.onFim({
      chartId: this.chart.id,
      completou,
      pontos: Math.round(this.pontos),
      precisao: prec,
      maiorCombo: this.maiorCombo,
      perfeitos: this.perfeitos,
      bons: this.bons,
      // notas que passaram sem toque (se a música parou antes, as que nem
      // chegaram não contam como erro)
      erros: this.erros,
      estrelas: estrelas(completou, prec)
    });
  }

  // ---------- Desenho ----------

  private desenhar(t: number) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, sx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const img = this.img;
    const zDe = (tn: number) => (tn - t) / this.antecedencia;
    const yAcerto = this.yDe(0);
    const largPista = P_LARG * sx; // largura de uma pista na linha de acerto

    // Pista de pedra
    if (img && pronta(img.pista)) {
      ctx.drawImage(img.pista, this.tx, this.ty, PISTA_W * sx, PISTA_H * this.sy);
    } else {
      ctx.fillStyle = 'rgba(14, 36, 22, 0.9)';
      ctx.beginPath();
      ctx.moveTo(this.xDe(-0.5, 1), this.yDe(1));
      ctx.lineTo(this.xDe(4.5, 1), this.yDe(1));
      ctx.lineTo(this.xDe(4.5, Z_MIN), this.yDe(Z_MIN));
      ctx.lineTo(this.xDe(-0.5, Z_MIN), this.yDe(Z_MIN));
      ctx.fill();
    }

    // Recorte: nada desenhado fora do tapete verde.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.xDe(-0.5, 1), this.yDe(1));
    ctx.lineTo(this.xDe(4.5, 1), this.yDe(1));
    ctx.lineTo(this.xDe(4.5, Z_CAMPO), this.yDe(Z_CAMPO));
    ctx.lineTo(this.xDe(-0.5, Z_CAMPO), this.yDe(Z_CAMPO));
    ctx.closePath();
    ctx.clip();

    // Pista apertada / acerto: luz subindo da cor da pista
    for (let i = 0; i < PISTAS.length; i++) {
      const idade = t - this.brilho[i];
      const forca = this.apertada[i] ? 1 : idade < 0.25 ? 1 - idade / 0.25 : 0;
      if (forca <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(this.xDe(i - 0.5, 0.75), this.yDe(0.75));
      ctx.lineTo(this.xDe(i + 0.5, 0.75), this.yDe(0.75));
      ctx.lineTo(this.xDe(i + 0.5, Z_CAMPO), this.yDe(Z_CAMPO));
      ctx.lineTo(this.xDe(i - 0.5, Z_CAMPO), this.yDe(Z_CAMPO));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, this.yDe(0.75), 0, yAcerto);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, PISTAS[i].cor + Math.round(forca * 70).toString(16).padStart(2, '0'));
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Linhas de compasso (bem discretas, douradas)
    const batida = 60 / this.chart.bpm;
    const ib = this.chart.inicioBatida ?? 0;
    for (let k = Math.max(0, Math.floor((t - ib) / batida)); ib + k * batida < t + this.antecedencia; k++) {
      const z = zDe(ib + k * batida);
      if (z < 0 || z > 1) continue;
      const y = this.yDe(z);
      const forte = k % 4 === 0;
      ctx.strokeStyle = forte ? 'rgba(232, 196, 110, 0.28)' : 'rgba(232, 196, 110, 0.1)';
      ctx.lineWidth = (forte ? 2 : 1) * Math.max(0.6, this.r(z));
      ctx.beginPath();
      ctx.moveTo(this.xDe(-0.5, z), y);
      ctx.lineTo(this.xDe(4.5, z), y);
      ctx.stroke();
    }

    // Rastros das notas longas (antes dos anéis e das notas)
    for (let idx = this.notas.length - 1; idx >= 0; idx--) {
      const e = this.notas[idx];
      if (!e.n.dur) continue;
      const fim = e.n.t + e.n.dur;
      const z0 = zDe(e.n.t);
      if (z0 > 1.05 || zDe(fim) < Z_MIN) continue;
      if (e.julgada && e.julgada !== 'erro' && !e.segurando) continue; // soltou antes
      const zIni = e.segurando ? 0 : Math.max(Z_MIN, z0);
      const zFim = Math.min(1, zDe(fim));
      if (zFim > zIni) this.rastro(ctx, e.pista, zIni, zFim, e.julgada === 'erro' ? 'apagado' : e.segurando ? 'aceso' : 'normal');
    }
    ctx.restore();

    // Anéis na linha de acerto
    const anelL = largPista * 0.8;
    const anelA = img && pronta(img.anel) ? anelL * (img.anel.naturalHeight / img.anel.naturalWidth) : anelL * 0.53;
    for (let i = 0; i < PISTAS.length; i++) {
      const x = this.xDe(i, 0);
      const idade = t - this.brilho[i];
      const aceso = this.apertada[i] || idade < 0.18;
      if (aceso) {
        const g = ctx.createRadialGradient(x, yAcerto, 0, x, yAcerto, anelL * 0.75);
        g.addColorStop(0, PISTAS[i].cor + 'aa');
        g.addColorStop(0.5, 'rgba(255, 220, 130, 0.35)');
        g.addColorStop(1, 'rgba(255, 220, 130, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - anelL, yAcerto - anelL, anelL * 2, anelL * 2);
      }
      if (img && pronta(img.anel)) {
        ctx.drawImage(img.anel, x - anelL / 2, yAcerto - anelA / 2, anelL, anelA);
        if (aceso) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = this.apertada[i] ? 0.55 : 0.35;
          ctx.drawImage(img.anel, x - anelL / 2, yAcerto - anelA / 2, anelL, anelA);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        ctx.beginPath();
        ctx.ellipse(x, yAcerto, anelL / 2, anelA / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(12, 30, 16, 0.85)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#e8c46e';
        ctx.stroke();
      }
      const letra = this.op.rotulos[i];
      if (letra) {
        const tam = Math.round(anelA * (letra.length > 1 ? 0.36 : 0.56));
        ctx.font = `700 ${tam}px ${this.fonte}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const g = ctx.createLinearGradient(0, yAcerto - tam / 2, 0, yAcerto + tam / 2);
        g.addColorStop(0, '#fffbe6');
        g.addColorStop(1, '#e9cf8f');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.fillText(letra, x, yAcerto + tam * 0.04);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
    }

    // Notas (de trás pra frente)
    for (let idx = this.notas.length - 1; idx >= 0; idx--) {
      const e = this.notas[idx];
      const z0 = zDe(e.n.t);
      if (z0 > 1.04 || z0 < Z_MIN - 0.04) continue;
      if (e.julgada && e.julgada !== 'erro') continue;
      if (e.segurando) continue;
      const s = this.r(z0);
      const x = this.xDe(e.pista, z0);
      const y = this.yDe(z0);
      const apagada = e.julgada === 'erro';
      // aparece suave lá no fundo
      // some logo depois de passar do anel (não desce pela borda de pedra)
      const depois = z0 < 0 ? Math.max(0, 1 - z0 / Z_MIN) : 1;
      const alfa = Math.min(1, (1.04 - z0) / 0.12) * (apagada ? 0.35 : 1) * depois;
      if (alfa <= 0.01) continue;
      ctx.globalAlpha = alfa;
      this.nota(ctx, x, y, largPista * 0.34 * s, e.pista, apagada);
      ctx.globalAlpha = 1;
    }

    // Faíscas
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particulas) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida * 2.2));
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Avisos (Perfeito / Bom / Errou)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < PISTAS.length; i++) {
      const f = this.feedback[i];
      const idade = t - f.t;
      if (!f.texto || idade > 0.6 || idade < 0) continue;
      ctx.globalAlpha = 1 - idade / 0.6;
      ctx.fillStyle = f.cor;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      ctx.font = `700 ${Math.round(Math.max(11, Math.min(26, largPista * 0.17)))}px ${this.fonte}`;
      ctx.fillText(f.texto, this.xDe(i, 0), yAcerto - anelA * 0.9 - idade * 40);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1;
    }

    // Contagem antes da música começar
    if (t < this.comecarEm) {
      const faltam = Math.ceil(this.comecarEm - t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tam = Math.round(Math.min(84, w * 0.13));
      ctx.font = `700 ${faltam > 3 ? Math.round(tam * 0.6) : tam}px ${this.fonte}`;
      const g = ctx.createLinearGradient(0, h * 0.42 - tam / 2, 0, h * 0.42 + tam / 2);
      g.addColorStop(0, '#fff6d6');
      g.addColorStop(1, '#d9a93a');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 14;
      ctx.fillText(faltam > 3 ? 'Prepare-se!' : String(faltam), w / 2, this.yDe(0.55));
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }

    this.op.onHud?.({
      pontos: Math.round(this.pontos),
      combo: this.combo,
      mult: multiplicador(this.combo),
      energia: Math.max(0, this.energia),
      tempo: Math.max(0, t),
      duracao: this.duracao
    });
  }

  // Nota: oval da cor da pista (achatada como os anéis, pra dar a
  // perspectiva), com brilho em cima e um anel claro.
  private nota(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pista: number, apagada: boolean) {
    const cor = apagada ? '#5f5a66' : PISTAS[pista].cor;
    const ry = r * ACHATAMENTO;
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.18, r * 1.04, ry * 1.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ACHATAMENTO);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, cor);
    g.addColorStop(1, cor);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.2, r * 0.13);
    ctx.strokeStyle = apagada ? 'rgba(40,36,48,0.8)' : 'rgba(255,255,255,0.88)';
    ctx.stroke();
  }

  // Rastro luminoso da nota longa, em perspectiva (vários pedaços).
  private rastro(ctx: CanvasRenderingContext2D, pista: number, zIni: number, zFim: number, estado: 'normal' | 'aceso' | 'apagado') {
    const cor = estado === 'apagado' ? '#7d7a86' : PISTAS[pista].cor;
    const base = P_LARG * this.sx * 0.12;
    const camadas: [number, string, number][] =
      estado === 'apagado'
        ? [[1, cor, 0.35]]
        : [
            [2.6, cor, estado === 'aceso' ? 0.3 : 0.18],
            [1, cor, estado === 'aceso' ? 0.95 : 0.8],
            [0.35, '#ffffff', estado === 'aceso' ? 0.75 : 0.45]
          ];
    const passos = 10;
    for (const [mult, c, alfa] of camadas) {
      ctx.beginPath();
      for (let k = 0; k <= passos; k++) {
        const z = zIni + ((zFim - zIni) * k) / passos;
        const x = this.xDe(pista, z) - base * mult * this.r(z);
        if (k === 0) ctx.moveTo(x, this.yDe(z));
        else ctx.lineTo(x, this.yDe(z));
      }
      for (let k = passos; k >= 0; k--) {
        const z = zIni + ((zFim - zIni) * k) / passos;
        ctx.lineTo(this.xDe(pista, z) + base * mult * this.r(z), this.yDe(z));
      }
      ctx.closePath();
      ctx.globalAlpha = alfa;
      ctx.fillStyle = c;
      if (mult > 2) ctx.globalCompositeOperation = 'lighter';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // ponta arredondada no fim
    if (estado !== 'apagado') {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.ellipse(this.xDe(pista, zFim), this.yDe(zFim), base * this.r(zFim), base * this.r(zFim) * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
