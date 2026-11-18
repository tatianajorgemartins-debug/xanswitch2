// Motor do "Zelda Tour": desenha a pista no <canvas> (requestAnimationFrame)
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
  ESPECIAL_CHEIO,
  ESPECIAL_METADE,
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
  sequenciasEstrela,
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
  seq: number; // sequência de estrelas da nota (-1 = nota comum)
};

export type HudMotor = {
  pontos: number;
  combo: number;
  mult: number;
  energia: number; // 0 a 1
  tempo: number; // segundos da música
  duracao: number;
  barra: number; // barra de especial, de 0 a 1
  especial: boolean; // especial ligado agora
  pronta: boolean; // dá pra ativar o especial
};

// Onde ficam as pistas na tela (pra pôr os botões de toque em cima).
// bordaTopo e bordaAcerto: onde a borda direita da pista está no fundo e na
// linha de acerto (entre os dois pontos ela é uma reta).
export type GeometriaMotor = { esquerda: number; largura: number; topo: number; acerto: number; base: number; bordaTopo: number; bordaAcerto: number };

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
// Partículas do cenário (vaga-lumes e folhas), em frações da tela.
type Ambiente = { x: number; y: number; v: number; queda: number; fase: number; tam: number; alfa: number; folha: boolean };

const OURO = '#ffd23e';
// Índices dos desenhos prontos das notas
const SPRITE_APAGADA = 5;
const SPRITE_OURO = 6;
const SPRITE_ESTRELA = 7; // 7 a 11: uma Triforce por pista
const SPRITE_ESTRELA_OURO = 12;

export class MotorOcarina {
  private notas: EstadoNota[];
  private inicio = 0;
  private raf = 0;
  private rodando = false;
  private acabou = false;
  private duracao: number;
  private antecedencia: number;
  private agendadoAte = -1; // último tempo (da música) com metrônomo agendado
  private cliqueIdx = 0; // próxima nota que ainda não teve o clique agendado
  // Primeira nota que ainda importa (as de antes já foram julgadas e saíram
  // da tela): os laços de cada quadro começam daqui, não do início.
  private ini = 0;
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
  private ambiente: Ambiente[] = [];
  private relogio = 0; // segundos de jogo, pro balanço das partículas
  private spriteLuz: HTMLCanvasElement | null = null;
  private spriteFolha: HTMLCanvasElement | null = null;

  // Especial: meias barras guardadas (0, 1 ou 2) e até quando ele vale.
  private meias = 0;
  private especialAte = -Infinity;
  private seqFaltam: number[] = [];
  private seqFalhou: boolean[] = [];

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
  private ctx: CanvasRenderingContext2D | null;
  // Camadas que não mudam a cada quadro, desenhadas uma vez (e de novo ao
  // mudar o tamanho, quando a imagem/fonte termina de carregar):
  // a pista de pedra, os anéis com as letras e as notas de cada cor.
  private camadaPista: HTMLCanvasElement | null = null;
  private camadaAneis: HTMLCanvasElement | null = null;
  private spritesNotas: HTMLCanvasElement[] = [];
  private spriteRaio = 0; // raio (px de tela) com que os sprites foram feitos
  private camadasCom = ''; // o que estava pronto quando as camadas foram feitas
  private hud: HudMotor = { pontos: 0, combo: 0, mult: 1, energia: 1, tempo: 0, duracao: 0, barra: 0, especial: false, pronta: false };
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
    // notas depois do fim definido no editor não entram
    const fim = chart.fimEm && op.audio ? chart.fimEm : Infinity;
    const notas = chart.notas.filter((n) => n.t >= this.comecarEm - 0.02 && n.t < fim);
    const seqs = sequenciasEstrela(notas);
    this.notas = notas.map((n, i) => ({ n, pista: indicePista(n.pista), julgada: null, segurando: false, voz: null, fimSegurar: 0, seq: seqs[i] }));
    for (const s of seqs) {
      if (s < 0) continue;
      this.seqFaltam[s] = (this.seqFaltam[s] ?? 0) + 1;
      this.seqFalhou[s] = false;
    }
    // Com áudio, a partida vai até o fim da música; sem, até a última nota.
    this.duracao = op.audio ? Math.min(op.audio.duration, chart.fimEm ?? Infinity) : duracaoChart(chart);
    this.antecedencia = DIFICULDADES[chart.dificuldade].antecedencia;
    this.img = carregarImagensOcarina();
    this.ctx = canvas.getContext('2d');
    const f = getComputedStyle(canvas).getPropertyValue('--oc-cinzel').trim();
    if (f) this.fonte = `${f}, Georgia, serif`;
    // a fonte das letras chegou: refaz os anéis
    document.fonts?.ready.then(() => (this.camadasCom = '')).catch(() => {});
    this.criarAmbiente();
    this.ajustarTamanho();
    if (typeof ResizeObserver !== 'undefined') {
      this.obs = new ResizeObserver(() => this.ajustarTamanho());
      this.obs.observe(canvas);
    }
  }

  get terminou(): boolean {
    return this.acabou;
  }

  // Partida correndo (não pausada nem encerrada).
  get emJogo(): boolean {
    return this.rodando && !this.acabou;
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
      base: this.ty + ph,
      bordaTopo: this.xDe(4.8, 1),
      bordaAcerto: this.xDe(4.8, 0)
    });
    this.camadasCom = '';
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
    if (this.op.audio) this.faixa = this.som.faixa(this.op.audio, this.inicio, this.comecarEm, this.chart.fimEm);
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
    for (let i = this.ini; i < this.notas.length; i++) {
      const e = this.notas[i];
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
    this.pontos += (perfeito ? PONTOS_PERFEITO : PONTOS_BOM) * multiplicador(this.combo) * this.bonus(t);
    this.energia = Math.min(1, this.energia + ENERGIA_ACERTO);
    this.brilho[pista] = t;
    this.mostrar(pista, perfeito ? 'Perfeito!' : 'Bom', perfeito ? '#ffe9a8' : '#c8f7c5', t);
    this.faisca(pista, perfeito ? 8 : 5);
    this.acertouEstrela(alvo, t);
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
    for (let i = this.ini; i < this.notas.length; i++) {
      const e = this.notas[i];
      if (e.pista === pista && e.segurando) this.soltarNota(e);
    }
  }

  // ---------- Especial ----------

  private bonus(t: number) {
    return t < this.especialAte ? 2 : 1;
  }

  // Última estrela da sequência, sem errar nenhuma: enche meia barra. Com o
  // especial ligado, vira mais 5 segundos dele.
  private acertouEstrela(e: EstadoNota, t: number) {
    if (e.seq < 0 || this.seqFalhou[e.seq]) return;
    if (--this.seqFaltam[e.seq] > 0) return;
    if (t < this.especialAte) this.especialAte = Math.min(t + ESPECIAL_CHEIO, this.especialAte + ESPECIAL_METADE);
    else this.meias = Math.min(2, this.meias + 1);
    this.mostrar(e.pista, 'Sequência!', '#ffe08a', t);
    for (let i = 0; i < PISTAS.length; i++) this.faisca(i, 6);
    this.som.sequencia();
  }

  // Espaço ou o botão do celular. Barra cheia: 10 s; pela metade: 5 s.
  ativarEspecial(): boolean {
    if (!this.emJogo || this.meias === 0) return false;
    const t = this.tempo();
    if (t < this.especialAte) return false;
    this.especialAte = t + (this.meias === 2 ? ESPECIAL_CHEIO : ESPECIAL_METADE);
    this.meias = 0;
    for (let i = 0; i < PISTAS.length; i++) this.faisca(i, 14);
    const agora = this.som.agora;
    ['D5', 'F5', 'A5', 'D6'].forEach((n, i) => this.som.nota(frequencia(n), agora + i * 0.08, 0.26, 0.24));
    return true;
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
        cor: i % 3 === 0 && this.tempo() >= this.especialAte ? PISTAS[pista].cor : '#ffe08a',
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
    this.moverAmbiente(dtQuadro, t < this.especialAte);
    if (!this.op.audio) this.agendarAcompanhamento(t);
    if (this.op.clique) this.agendarCliques();

    // Pula as notas que já acabaram (julgadas e fora da tela).
    const saiu = t + (Z_MIN - 0.1) * this.antecedencia;
    while (this.ini < this.notas.length) {
      const e = this.notas[this.ini];
      if (!e.julgada || e.segurando || e.n.t + (e.n.dur ?? 0) >= saiu) break;
      this.ini++;
    }

    // Notas que passaram sem toque.
    for (let i = this.ini; i < this.notas.length; i++) {
      const e = this.notas[i];
      if (e.n.t > t) break;
      if (!e.julgada && t - e.n.t > this.janelaBom) {
        e.julgada = 'erro';
        this.faixa?.abafar();
        this.erros++;
        this.combo = 0;
        if (e.seq >= 0) this.seqFalhou[e.seq] = true;
        this.energia -= ENERGIA_ERRO;
        this.mostrar(e.pista, 'Errou', '#ff8a8a', t);
      }
      // Notas longas: pontos enquanto segura; acaba sozinha no fim.
      if (e.segurando && e.n.dur) {
        const fim = e.n.t + e.n.dur;
        this.pontos += dtQuadro * 40 * multiplicador(this.combo) * this.bonus(t);
        e.fimSegurar = Math.min(t, fim);
        if (Math.random() < dtQuadro * 14) this.faisca(e.pista, 2);
        if (t >= fim) this.soltarNota(e);
      }
    }

    // Faíscas (tira as apagadas no mesmo array, sem criar outro por quadro)
    const ps = this.particulas;
    const grav = 420 * this.sx * 4 * dtQuadro;
    let vivas = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.vida -= dtQuadro;
      if (p.vida <= 0) continue;
      p.x += p.vx * dtQuadro;
      p.y += p.vy * dtQuadro;
      p.vy += grav;
      ps[vivas++] = p;
    }
    ps.length = vivas;

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
    const agora = this.som.agora;
    const ate = agora - this.inicio + this.comecarEm + ANTECEDENCIA_SOM;
    let ultimo = this.cliqueIdx > 0 ? this.notas[this.cliqueIdx - 1].n.t : -1;
    while (this.cliqueIdx < this.notas.length) {
      const tn = this.notas[this.cliqueIdx].n.t;
      if (tn > ate) break;
      // acorde = um clique só
      if (Math.abs(tn - ultimo) > 0.001) {
        const quando = this.inicio + (tn - this.comecarEm);
        if (quando >= agora - 0.01) this.som.clique(Math.max(quando, agora));
      }
      ultimo = tn;
      this.cliqueIdx++;
    }
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

  // Camadas fixas (pista, anéis, notas): feitas de novo só quando algo muda.
  private montarCamadas() {
    const img = this.img;
    const chave = `${pronta(img?.pista)}|${pronta(img?.anel)}`;
    if (this.camadasCom === chave && this.camadaAneis) return;
    this.camadasCom = chave;
    const { dpr, sx } = this;
    const novo = (velho: HTMLCanvasElement | null) => {
      const c = velho ?? document.createElement('canvas');
      c.width = Math.round(this.w * dpr);
      c.height = Math.round(this.h * dpr);
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [c, g] as const;
    };

    // Pista de pedra, já no tamanho da tela
    if (img && pronta(img.pista)) {
      const [c, g] = novo(this.camadaPista);
      g.drawImage(img.pista, this.tx, this.ty, PISTA_W * sx, PISTA_H * this.sy);
      this.camadaPista = c;
    } else this.camadaPista = null;

    // Anéis com as letras (o brilho de apertar vai por cima, a cada quadro)
    const [c, g] = novo(this.camadaAneis);
    const yAcerto = this.yDe(0);
    const { anelL, anelA } = this.tamAnel();
    for (let i = 0; i < PISTAS.length; i++) {
      const x = this.xDe(i, 0);
      if (img && pronta(img.anel)) {
        g.drawImage(img.anel, x - anelL / 2, yAcerto - anelA / 2, anelL, anelA);
      } else {
        g.beginPath();
        g.ellipse(x, yAcerto, anelL / 2, anelA / 2, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(12, 30, 16, 0.85)';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#e8c46e';
        g.stroke();
      }
      const letra = this.op.rotulos[i];
      if (letra) {
        const tam = Math.round(anelA * (letra.length > 1 ? 0.36 : 0.56));
        g.font = `700 ${tam}px ${this.fonte}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const gr = g.createLinearGradient(0, yAcerto - tam / 2, 0, yAcerto + tam / 2);
        gr.addColorStop(0, '#fffbe6');
        gr.addColorStop(1, '#e9cf8f');
        g.fillStyle = gr;
        g.shadowColor = 'rgba(0,0,0,0.6)';
        g.shadowBlur = 4;
        g.shadowOffsetY = 1;
        g.fillText(letra, x, yAcerto + tam * 0.04);
        g.shadowColor = 'transparent';
        g.shadowBlur = 0;
        g.shadowOffsetY = 0;
      }
    }
    this.camadaAneis = c;

    // Uma nota pronta de cada cor (e a apagada), no maior tamanho que ela
    // aparece; no quadro só se copia a imagem, em vez de desenhar gradiente
    // e quatro contornos por nota.
    const raio = P_LARG * sx * 0.34 * this.r(Z_MIN);
    const meiaL = raio * 1.5;
    const meiaA = raio * 1.1;
    this.spriteRaio = raio;
    this.spritesNotas = Array.from({ length: SPRITE_ESTRELA_OURO + 1 }, (_, i) => {
      const s = this.spritesNotas[i] ?? document.createElement('canvas');
      s.width = Math.ceil(meiaL * 2 * dpr);
      s.height = Math.ceil(meiaA * 2 * dpr);
      const sg = s.getContext('2d')!;
      sg.setTransform(dpr, 0, 0, dpr, (s.width / 2) | 0, (s.height / 2) | 0);
      sg.clearRect(-s.width, -s.height, s.width * 2, s.height * 2);
      // No especial as notas comuns ficam douradas: a Triforce ganha disco
      // branco pra continuar diferente delas.
      if (i === SPRITE_ESTRELA_OURO) this.triforce(sg, raio, '#ffffff');
      else if (i >= SPRITE_ESTRELA) this.triforce(sg, raio, PISTAS[i - SPRITE_ESTRELA].cor);
      else if (i === SPRITE_OURO) {
        sg.shadowColor = OURO;
        sg.shadowBlur = raio * 0.45;
        this.nota(sg, 0, 0, raio, 0, false, OURO);
        sg.shadowBlur = 0;
        sg.shadowColor = 'transparent';
      } else this.nota(sg, 0, 0, raio, Math.min(i, 4), i === SPRITE_APAGADA);
      return s;
    });
    this.montarSpritesAmbiente();
  }

  // ---------- Partículas do cenário ----------

  private criarAmbiente() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const total = this.canvas.clientWidth < 700 ? 16 : 30;
    this.ambiente = Array.from({ length: total }, (_, i) => {
      const folha = i % 3 === 0;
      return {
        x: Math.random(),
        y: Math.random(),
        v: (folha ? 0.035 : 0.014) + Math.random() * 0.02,
        queda: folha ? 0.025 + Math.random() * 0.03 : -0.006 - Math.random() * 0.01,
        fase: Math.random() * Math.PI * 2,
        tam: folha ? 8 + Math.random() * 8 : 12 + Math.random() * 20,
        alfa: folha ? 0.55 + Math.random() * 0.3 : 0.45 + Math.random() * 0.5,
        folha
      };
    });
  }

  private moverAmbiente(dt: number, especial: boolean) {
    this.relogio += dt;
    const ritmo = especial ? 2.4 : 1;
    for (const p of this.ambiente) {
      p.x += p.v * ritmo * dt;
      p.y += p.queda * ritmo * dt;
      if (p.x > 1.06) p.x = -0.06;
      if (p.y > 1.05) p.y = -0.05;
      if (p.y < -0.05) p.y = 1.05;
    }
  }

  private montarSpritesAmbiente() {
    if (this.spriteLuz) return;
    const luz = document.createElement('canvas');
    luz.width = luz.height = 64;
    const gl = luz.getContext('2d')!;
    const rad = gl.createRadialGradient(32, 32, 0, 32, 32, 32);
    rad.addColorStop(0, 'rgba(255, 255, 220, 1)');
    rad.addColorStop(0.18, 'rgba(226, 255, 140, 0.85)');
    rad.addColorStop(0.5, 'rgba(170, 240, 90, 0.2)');
    rad.addColorStop(1, 'rgba(170, 240, 90, 0)');
    gl.fillStyle = rad;
    gl.fillRect(0, 0, 64, 64);
    this.spriteLuz = luz;

    const folha = document.createElement('canvas');
    folha.width = 48;
    folha.height = 28;
    const gf = folha.getContext('2d')!;
    gf.beginPath();
    gf.moveTo(3, 14);
    gf.quadraticCurveTo(22, -6, 45, 14);
    gf.quadraticCurveTo(22, 34, 3, 14);
    const verde = gf.createLinearGradient(0, 0, 48, 28);
    verde.addColorStop(0, '#9bd85a');
    verde.addColorStop(1, '#3f8f3a');
    gf.fillStyle = verde;
    gf.fill();
    gf.strokeStyle = 'rgba(20, 60, 24, 0.7)';
    gf.lineWidth = 1.5;
    gf.beginPath();
    gf.moveTo(5, 14);
    gf.lineTo(42, 14);
    gf.stroke();
    this.spriteFolha = folha;
  }

  private desenharAmbiente(ctx: CanvasRenderingContext2D, especial: boolean) {
    const { spriteLuz, spriteFolha, w, h, relogio } = this;
    if (!spriteLuz || !spriteFolha) return;
    const esc = Math.max(0.7, Math.min(1.4, Math.min(w, h) / 700));
    for (const p of this.ambiente) {
      if (!p.folha) continue;
      const x = (p.x + Math.sin(relogio * 0.8 + p.fase) * 0.012) * w;
      const y = p.y * h;
      const giro = p.fase + relogio * 1.1;
      const l = p.tam * esc * 1.7;
      const a = l * 0.58 * (0.45 + 0.55 * Math.abs(Math.cos(giro * 0.7)));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(giro);
      ctx.globalAlpha = p.alfa;
      ctx.drawImage(spriteFolha, -l / 2, -a / 2, l, a);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ambiente) {
      if (p.folha) continue;
      const pisca = 0.55 + 0.45 * Math.sin(relogio * 2.2 + p.fase);
      const l = p.tam * esc * (especial ? 1.35 : 1);
      ctx.globalAlpha = Math.min(1, p.alfa * pisca * (especial ? 1.3 : 1));
      ctx.drawImage(spriteLuz, p.x * w + Math.sin(relogio * 0.9 + p.fase) * 14 - l / 2, p.y * h + Math.cos(relogio * 0.7 + p.fase) * 10 - l / 2, l, l);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private tamAnel() {
    const anelL = P_LARG * this.sx * 0.8;
    const anel = this.img?.anel;
    const anelA = anel && pronta(anel) ? anelL * (anel.naturalHeight / anel.naturalWidth) : anelL * 0.53;
    return { anelL, anelA };
  }

  private desenhar(t: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h, sx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.montarCamadas();
    const img = this.img;
    const zDe = (tn: number) => (tn - t) / this.antecedencia;
    const yAcerto = this.yDe(0);
    const largPista = P_LARG * sx; // largura de uma pista na linha de acerto

    // Notas na tela: de this.ini até a primeira que ainda nem apareceu.
    let fimVis = this.ini;
    const tVis = t + this.antecedencia * 1.05;
    while (fimVis < this.notas.length && this.notas[fimVis].n.t <= tVis) fimVis++;

    const especial = t < this.especialAte;
    this.desenharAmbiente(ctx, especial);

    // Pista de pedra
    if (this.camadaPista) {
      ctx.drawImage(this.camadaPista, 0, 0, w, h);
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

    // Especial: a pista inteira ganha uma luz dourada que pulsa
    if (especial) {
      const luz = ctx.createLinearGradient(0, this.yDe(1), 0, yAcerto);
      const forca = 0.26 + 0.08 * Math.sin(t * 7);
      luz.addColorStop(0, 'rgba(255, 196, 60, 0.04)');
      luz.addColorStop(1, `rgba(255, 196, 60, ${forca.toFixed(3)})`);
      ctx.fillStyle = luz;
      ctx.fillRect(0, this.yDe(1), w, h);
    }

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
    for (let idx = fimVis - 1; idx >= this.ini; idx--) {
      const e = this.notas[idx];
      if (!e.n.dur) continue;
      const fim = e.n.t + e.n.dur;
      const z0 = zDe(e.n.t);
      if (z0 > 1.05 || zDe(fim) < Z_MIN) continue;
      if (e.julgada && e.julgada !== 'erro' && !e.segurando) continue; // soltou antes
      const zIni = e.segurando ? 0 : Math.max(Z_MIN, z0);
      const zFim = Math.min(1, zDe(fim));
      if (zFim > zIni) this.rastro(ctx, e.pista, zIni, zFim, e.julgada === 'erro' ? 'apagado' : e.segurando ? 'aceso' : 'normal', especial);
    }
    ctx.restore();

    // Anéis na linha de acerto: brilho de quem está aceso, a camada pronta
    // dos anéis e, por cima, o anel aceso clareado.
    const { anelL, anelA } = this.tamAnel();
    const aceso = (i: number) => this.apertada[i] || t - this.brilho[i] < 0.18;
    for (let i = 0; i < PISTAS.length; i++) {
      if (!aceso(i)) continue;
      const x = this.xDe(i, 0);
      const g = ctx.createRadialGradient(x, yAcerto, 0, x, yAcerto, anelL * 0.75);
      g.addColorStop(0, PISTAS[i].cor + 'aa');
      g.addColorStop(0.5, 'rgba(255, 220, 130, 0.35)');
      g.addColorStop(1, 'rgba(255, 220, 130, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - anelL, yAcerto - anelL, anelL * 2, anelL * 2);
    }
    if (this.camadaAneis) ctx.drawImage(this.camadaAneis, 0, 0, w, h);
    if (img && pronta(img.anel)) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < PISTAS.length; i++) {
        if (!aceso(i)) continue;
        const x = this.xDe(i, 0);
        ctx.globalAlpha = this.apertada[i] ? 0.55 : 0.35;
        ctx.drawImage(img.anel, x - anelL / 2, yAcerto - anelA / 2, anelL, anelA);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Notas (de trás pra frente)
    const sl = this.spritesNotas.length ? this.spritesNotas[0].width / this.dpr / this.spriteRaio : 0;
    const sa = this.spritesNotas.length ? this.spritesNotas[0].height / this.dpr / this.spriteRaio : 0;
    for (let idx = fimVis - 1; idx >= this.ini; idx--) {
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
      const raio = largPista * 0.34 * s;
      const estrela = !apagada && e.seq >= 0 && !this.seqFalhou[e.seq];
      const qual = apagada
        ? SPRITE_APAGADA
        : estrela
          ? especial
            ? SPRITE_ESTRELA_OURO
            : SPRITE_ESTRELA + e.pista
          : especial
            ? SPRITE_OURO
            : e.pista;
      const sprite = this.spritesNotas[qual];
      const pulso = estrela ? 1 + 0.07 * Math.sin(t * 8) : 1;
      const sw = sl * raio * pulso;
      const sh = sa * raio * pulso;
      if (sprite) ctx.drawImage(sprite, x - sw / 2, y - sh / 2, sw, sh);
      else this.nota(ctx, x, y, raio, e.pista, apagada);
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

    if (this.op.onHud) {
      const hud = this.hud; // o mesmo objeto todo quadro
      hud.pontos = Math.round(this.pontos);
      hud.combo = this.combo;
      hud.mult = multiplicador(this.combo) * this.bonus(t);
      hud.energia = Math.max(0, this.energia);
      hud.tempo = Math.max(0, t);
      hud.duracao = this.duracao;
      hud.especial = especial;
      hud.barra = especial ? Math.min(1, (this.especialAte - t) / ESPECIAL_CHEIO) : this.meias / 2;
      hud.pronta = !especial && this.meias > 0;
      this.op.onHud(hud);
    }
  }

  // Nota: oval da cor da pista (achatada como os anéis, pra dar a
  // perspectiva), com brilho em cima e um anel claro.
  private nota(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pista: number, apagada: boolean, corFixa?: string) {
    const cor = apagada ? '#5f5a66' : (corFixa ?? PISTAS[pista].cor);
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

  // Nota Triforce: o disco da pista (o centro dele é o tempo certo do toque)
  // com três triângulos dourados e contorno escuro por cima.
  private triforce(ctx: CanvasRenderingContext2D, r: number, corDisco: string) {
    this.nota(ctx, 0, 0, r, 0, false, corDisco);
    const lado = r * 1.5;
    const alt = lado * 0.8;
    const topo = -alt / 2;
    const tri = (x: number, y: number, l: number, a: number) => {
      ctx.moveTo(x, y);
      ctx.lineTo(x + l / 2, y + a);
      ctx.lineTo(x - l / 2, y + a);
      ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#fff4c2';
    ctx.shadowBlur = r * 0.4;
    ctx.beginPath();
    tri(0, topo, lado, alt);
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = '#241500';
    ctx.stroke();
    ctx.fillStyle = '#241500';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    const ouro = ctx.createLinearGradient(0, topo, 0, topo + alt);
    ouro.addColorStop(0, '#fff6bf');
    ouro.addColorStop(0.5, '#ffd23e');
    ouro.addColorStop(1, '#e79a12');
    ctx.fillStyle = ouro;
    ctx.beginPath();
    tri(0, topo, lado / 2, alt / 2);
    tri(-lado / 4, topo + alt / 2, lado / 2, alt / 2);
    tri(lado / 4, topo + alt / 2, lado / 2, alt / 2);
    ctx.fill();
    ctx.restore();
  }

  // Rastro luminoso da nota longa, em perspectiva (vários pedaços).
  private rastro(ctx: CanvasRenderingContext2D, pista: number, zIni: number, zFim: number, estado: 'normal' | 'aceso' | 'apagado', especial: boolean) {
    const cor = estado === 'apagado' ? '#7d7a86' : especial ? OURO : PISTAS[pista].cor;
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
