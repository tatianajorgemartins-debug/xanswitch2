// Motor do "Ocarina Hero": desenha a pista no <canvas> (requestAnimationFrame)
// e julga os toques. O tempo vem SEMPRE do relógio de áudio
// (AudioContext.currentTime, via SomOcarina) — assim notas, metrônomo e
// toques ficam sincronizados, e pausar o áudio pausa o jogo.
//
// latencia (segundos, da tela de calibração): quanto o som chega atrasado
// no ouvido. O jogo "atrasa" a pista e o julgamento nesse tanto.
import {
  DIFICULDADES,
  ENERGIA_ACERTO,
  ENERGIA_ERRO,
  ENERGIA_INICIAL,
  ENERGIA_TOQUE_VAZIO,
  JANELA_BOM,
  JANELA_PERFEITO,
  PISTAS,
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

export type OpcoesMotor = {
  latencia: number;
  // rótulo de tecla embaixo de cada pista ('' = não mostra, ex: celular)
  rotulos: string[];
  onFim: (r: ResultadoMusica) => void;
};

const PERSPECTIVA = 2.2;
const ANTECEDENCIA_SOM = 0.25;
const ESPERA_INICIAL = 1.2;

export class MotorOcarina {
  private notas: EstadoNota[];
  private inicio = 0;
  private raf = 0;
  private rodando = false;
  private acabou = false;
  private duracao: number;
  private antecedencia: number;
  private agendadoAte = -1; // último tempo (da música) com metrônomo agendado

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

  private w = 0;
  private h = 0;
  private dpr = 1;
  private obs: ResizeObserver | null = null;
  private ultimoQuadro = 0;
  private quadros: number[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private chart: Chart,
    private som: SomOcarina,
    private op: OpcoesMotor
  ) {
    this.notas = chart.notas.map((n) => ({ n, pista: indicePista(n.pista), julgada: null, segurando: false, voz: null, fimSegurar: 0 }));
    this.duracao = duracaoChart(chart);
    this.antecedencia = DIFICULDADES[chart.dificuldade].antecedencia;
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
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    if (!this.rodando) this.desenhar(this.tempo());
  }

  // Tempo da música (segundos), já descontada a latência.
  private tempo(): number {
    return this.som.agora - this.inicio - this.op.latencia;
  }

  iniciar() {
    this.inicio = this.som.agora + ESPERA_INICIAL;
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
      if (e.n.t - t > JANELA_BOM) break; // as próximas estão ainda mais longe
      if (dt <= JANELA_BOM && dt < menor) {
        menor = dt;
        alvo = e;
      }
    }
    if (!alvo) {
      // Tocou sem nota: som abafado, perde o combo.
      this.som.erro();
      this.combo = 0;
      this.energia -= ENERGIA_TOQUE_VAZIO;
      this.mostrar(pista, 'Errou', '#ff5c7a', t);
      return;
    }
    const perfeito = menor <= JANELA_PERFEITO;
    alvo.julgada = perfeito ? 'perfeito' : 'bom';
    if (perfeito) this.perfeitos++;
    else this.bons++;
    this.combo++;
    this.maiorCombo = Math.max(this.maiorCombo, this.combo);
    this.pontos += (perfeito ? PONTOS_PERFEITO : PONTOS_BOM) * multiplicador(this.combo);
    this.energia = Math.min(1, this.energia + ENERGIA_ACERTO);
    this.brilho[pista] = t;
    this.mostrar(pista, perfeito ? 'Perfeito!' : 'Bom', perfeito ? '#7dffb0' : '#ffd24e', t);
    const freq = frequencia(alvo.n.nota ?? PISTAS[pista].nota);
    if (alvo.n.dur) {
      alvo.segurando = true;
      alvo.fimSegurar = t;
      alvo.voz = this.som.nota(freq, this.som.agora, null);
    } else {
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

  // ---------- Laço ----------

  private quadro = (agoraMs: number) => {
    if (!this.rodando) return;
    const dtQuadro = this.ultimoQuadro ? Math.min(0.1, (agoraMs - this.ultimoQuadro) / 1000) : 0;
    this.ultimoQuadro = agoraMs;
    this.quadros.push(agoraMs);
    if (this.quadros.length > 61) this.quadros.shift();

    const t = this.tempo();
    this.agendarAcompanhamento(t);

    // Notas que passaram sem toque.
    for (const e of this.notas) {
      if (e.n.t > t) break;
      if (!e.julgada && t - e.n.t > JANELA_BOM) {
        e.julgada = 'erro';
        this.erros++;
        this.combo = 0;
        this.energia -= ENERGIA_ERRO;
        this.mostrar(e.pista, 'Errou', '#ff5c7a', t);
      }
      // Notas longas: pontos enquanto segura; acaba sozinha no fim.
      if (e.segurando && e.n.dur) {
        const fim = e.n.t + e.n.dur;
        this.pontos += dtQuadro * 40 * multiplicador(this.combo);
        e.fimSegurar = Math.min(t, fim);
        if (t >= fim) this.soltarNota(e);
      }
    }

    if (this.energia <= 0) {
      this.energia = 0;
      this.terminar(false);
      return;
    }
    if (t > this.duracao + 1.2) {
      this.terminar(true);
      return;
    }
    this.desenhar(t);
    this.raf = requestAnimationFrame(this.quadro);
  };

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
    const { w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const mostrarTeclas = this.op.rotulos.some(Boolean);
    const baseLarg = Math.min(w * 0.96, 600);
    const larguraPista = baseLarg / PISTAS.length;
    const yAcerto = h - (mostrarTeclas ? 70 : 46);
    const yTopo = h * 0.05;
    const cx = w / 2;
    const s1 = 1 / (1 + PERSPECTIVA);
    const escala = (z: number) => 1 / (1 + Math.max(-0.2, z) * PERSPECTIVA);
    const yDe = (z: number) => yAcerto - ((yAcerto - yTopo) * (1 - escala(z))) / (1 - s1);
    const xDe = (pista: number, z: number) => cx + (pista - 2) * larguraPista * escala(z);
    const zDe = (tn: number) => (tn - t) / this.antecedencia;

    // Pista (trapézio)
    const meio = (larguraPista * PISTAS.length) / 2;
    ctx.beginPath();
    ctx.moveTo(cx - meio * s1, yTopo);
    ctx.lineTo(cx + meio * s1, yTopo);
    ctx.lineTo(cx + meio * escala(-0.08), yDe(-0.08));
    ctx.lineTo(cx - meio * escala(-0.08), yDe(-0.08));
    ctx.closePath();
    const fundo = ctx.createLinearGradient(0, yTopo, 0, yAcerto);
    fundo.addColorStop(0, 'rgba(30, 14, 70, 0.15)');
    fundo.addColorStop(1, 'rgba(46, 22, 104, 0.85)');
    ctx.fillStyle = fundo;
    ctx.fill();

    // Brilho da pista apertada + divisórias
    for (let i = 0; i < PISTAS.length; i++) {
      const aceso = this.apertada[i] || t - this.brilho[i] < 0.12;
      if (aceso) {
        ctx.beginPath();
        ctx.moveTo(xDe(i - 0.5, 1), yTopo);
        ctx.lineTo(xDe(i + 0.5, 1), yTopo);
        ctx.lineTo(xDe(i + 0.5, 0), yAcerto);
        ctx.lineTo(xDe(i - 0.5, 0), yAcerto);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, yTopo, 0, yAcerto);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, PISTAS[i].cor + '55');
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(190, 160, 255, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= PISTAS.length; i++) {
      ctx.beginPath();
      ctx.moveTo(xDe(i - 0.5, 1), yTopo);
      ctx.lineTo(xDe(i - 0.5, -0.08), yDe(-0.08));
      ctx.stroke();
    }

    // Linhas de tempo (cada batida)
    const batida = 60 / this.chart.bpm;
    for (let k = Math.max(0, Math.floor(t / batida)); k * batida < t + this.antecedencia; k++) {
      const z = zDe(k * batida);
      if (z < 0 || z > 1) continue;
      const y = yDe(z);
      ctx.strokeStyle = k % 4 === 0 ? 'rgba(200, 170, 255, 0.28)' : 'rgba(200, 170, 255, 0.1)';
      ctx.lineWidth = k % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx - meio * escala(z), y);
      ctx.lineTo(cx + meio * escala(z), y);
      ctx.stroke();
    }

    // Alvos na linha de acerto
    const raio = Math.min(larguraPista * 0.36, 34);
    for (let i = 0; i < PISTAS.length; i++) {
      const x = xDe(i, 0);
      ctx.beginPath();
      ctx.arc(x, yAcerto, raio, 0, Math.PI * 2);
      ctx.fillStyle = this.apertada[i] ? PISTAS[i].cor + '88' : 'rgba(10, 6, 24, 0.75)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = PISTAS[i].cor;
      ctx.stroke();
      this.simbolo(ctx, i, x, yAcerto, raio * 0.55, PISTAS[i].cor);
      if (mostrarTeclas && this.op.rotulos[i]) {
        ctx.fillStyle = 'rgba(230, 220, 255, 0.75)';
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.op.rotulos[i], x, yAcerto + raio + 18);
      }
    }

    // Notas (de trás pra frente)
    for (let idx = this.notas.length - 1; idx >= 0; idx--) {
      const e = this.notas[idx];
      const z0 = zDe(e.n.t);
      const fim = e.n.t + (e.n.dur ?? 0);
      if (z0 > 1.05 || zDe(fim) < -0.15) continue;
      if (e.julgada && e.julgada !== 'erro' && !e.n.dur) continue;
      const cor = PISTAS[e.pista].cor;
      const apagada = e.julgada === 'erro';
      // Rastro da nota longa
      if (e.n.dur) {
        const zIni = e.segurando ? 0 : z0;
        const zFim = Math.min(1, zDe(fim));
        if (zFim > zIni && !(e.julgada && !e.segurando && e.julgada !== 'erro')) {
          const larg = raio * 0.5;
          ctx.beginPath();
          ctx.moveTo(xDe(e.pista, zIni) - larg * escala(zIni), yDe(zIni));
          ctx.lineTo(xDe(e.pista, zFim) - larg * escala(zFim), yDe(zFim));
          ctx.lineTo(xDe(e.pista, zFim) + larg * escala(zFim), yDe(zFim));
          ctx.lineTo(xDe(e.pista, zIni) + larg * escala(zIni), yDe(zIni));
          ctx.closePath();
          ctx.fillStyle = apagada ? 'rgba(120,110,140,0.35)' : e.segurando ? cor + 'dd' : cor + '88';
          ctx.fill();
        }
        if (e.segurando || (e.julgada && e.julgada !== 'erro')) continue;
      }
      const s = escala(z0);
      const x = xDe(e.pista, z0);
      const y = yDe(z0);
      const r = raio * s;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = apagada ? '#5a5070' : cor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      this.simbolo(ctx, e.pista, x, y, r * 0.55, apagada ? '#2a2238' : '#1a1030');
    }

    // Avisos (Perfeito / Bom / Errou)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < PISTAS.length; i++) {
      const f = this.feedback[i];
      const idade = t - f.t;
      if (!f.texto || idade > 0.55 || idade < 0) continue;
      ctx.globalAlpha = 1 - idade / 0.55;
      ctx.fillStyle = f.cor;
      ctx.font = `900 ${Math.round(Math.min(18, larguraPista * 0.2))}px system-ui, sans-serif`;
      ctx.fillText(f.texto, xDe(i, 0), yAcerto - raio - 16 - idade * 30);
      ctx.globalAlpha = 1;
    }

    // Placar, combo, multiplicador e energia da Navi
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(String(Math.round(this.pontos)).padStart(6, '0'), 14, 12);
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220, 205, 255, 0.85)';
    ctx.fillText(`Combo ${this.combo}`, 14, 40);
    const mult = multiplicador(this.combo);
    if (mult > 1) {
      ctx.fillStyle = mult === 4 ? '#ff7ab8' : mult === 3 ? '#ffd24e' : '#7dffb0';
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.fillText(`x${mult}`, 14, 58);
    }
    const barraL = Math.min(150, w * 0.32);
    const bx = w - barraL - 14;
    ctx.fillStyle = 'rgba(220, 205, 255, 0.85)';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Energia da Navi', w - 14, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, 32, barraL, 10);
    const en = Math.max(0, this.energia);
    ctx.fillStyle = en < 0.25 ? '#ff5c7a' : en < 0.5 ? '#ffd24e' : '#7dd8ff';
    ctx.fillRect(bx, 32, barraL * en, 10);
    // a fadinha
    const fx = bx + barraL * en;
    const fg = ctx.createRadialGradient(fx, 37, 1, fx, 37, 12);
    fg.addColorStop(0, 'rgba(255,255,255,1)');
    fg.addColorStop(0.4, 'rgba(160,220,255,0.8)');
    fg.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, 37, 12, 0, Math.PI * 2);
    ctx.fill();

    // Progresso da música
    const prog = Math.max(0, Math.min(1, t / this.duracao));
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = '#a463ff';
    ctx.fillRect(0, 0, w * prog, 3);

    // Contagem antes da primeira nota
    const primeira = this.notas[0]?.n.t ?? 0;
    if (t < primeira - 0.2 && t > -ESPERA_INICIAL - 1) {
      const faltam = Math.ceil(primeira - 0.2 - t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `900 ${Math.round(Math.min(72, w * 0.16))}px system-ui, sans-serif`;
      ctx.fillText(faltam > 3 ? 'Prepare-se!' : String(faltam), cx, h * 0.38);
    }
  }

  // "A" na pista azul; seta nos botões C.
  private simbolo(ctx: CanvasRenderingContext2D, pista: number, x: number, y: number, r: number, cor: string) {
    const seta = PISTAS[pista].seta;
    ctx.fillStyle = cor;
    if (!seta) {
      ctx.font = `900 ${Math.max(8, Math.round(r * 1.5))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', x, y + r * 0.08);
      return;
    }
    const giro = { cima: 0, direita: Math.PI / 2, baixo: Math.PI, esquerda: -Math.PI / 2 }[seta];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(giro);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, r * 0.6);
    ctx.lineTo(-r * 0.9, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
