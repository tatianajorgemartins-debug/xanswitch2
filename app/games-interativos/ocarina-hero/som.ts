import { FADE_FIM } from './ocarina';
// Som do "Ocarina Hero", todo sintetizado com Web Audio (nenhum arquivo de
// áudio): a ocarina (senoide + um pouco de triangular, vibrato leve, ataque
// suave e eco), o metrônomo, o grave do acompanhamento e o "erro" abafado.
//
// O relógio do jogo é o deste AudioContext (ctx.currentTime): pausar a
// música = suspender o contexto, e o tempo para junto.

export type Voz = { parar: (quando?: number) => void };

// Som de completar uma sequência de Triforces (já cortado no início do som).
const SOM_SEQUENCIA = '/jogos/ocarina/sons/sequencia.wav';

export class SomOcarina {
  readonly ctx: AudioContext;
  private saida: GainNode;
  private ruido: AudioBuffer;
  private bufferSequencia: AudioBuffer | null = null;

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'interactive' });
    const ctx = this.ctx;

    // Ruído branco (sopro da ocarina e o som de erro).
    this.ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Saída: seco + eco (reverb feito na hora, sem arquivo).
    this.saida = ctx.createGain();
    this.saida.gain.value = 0.8;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 3;
    this.saida.connect(compressor);
    compressor.connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulso(1.8);
    const molhado = ctx.createGain();
    molhado.gain.value = 0.22;
    this.saida.connect(reverb);
    reverb.connect(molhado);
    molhado.connect(compressor);

    // Baixa antes da partida, pra tocar na hora do acerto.
    this.carregarAudio(SOM_SEQUENCIA)
      .then((b) => (this.bufferSequencia = b))
      .catch(() => {});
  }

  // Completou uma sequência de Triforces. Vai direto pra saída, sem eco.
  sequencia(): void {
    if (!this.bufferSequencia) return;
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.bufferSequencia;
    const ganho = this.ctx.createGain();
    ganho.gain.value = 1.2;
    fonte.connect(ganho).connect(this.ctx.destination);
    fonte.start();
  }

  private impulso(segundos: number): AudioBuffer {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * segundos);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    return b;
  }

  get agora(): number {
    return this.ctx.currentTime;
  }

  // Celular: o som só libera depois de um toque. Chame no clique de "Tocar".
  async destravar(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
    const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.ctx.destination);
    s.start();
  }

  pausar(): Promise<void> {
    return this.ctx.state === 'running' ? this.ctx.suspend() : Promise.resolve();
  }
  continuar(): Promise<void> {
    return this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
  }
  fechar(): void {
    this.ctx.close().catch(() => {});
  }

  // Uma nota da ocarina. dur null = toca até parar() (nota longa).
  nota(freq: number, quando = this.ctx.currentTime, dur: number | null = 0.32, volume = 0.32): Voz {
    const ctx = this.ctx;
    const t0 = Math.max(quando, ctx.currentTime);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(volume, t0 + 0.035);
    env.gain.linearRampToValueAtTime(volume * 0.8, t0 + 0.16);
    env.connect(this.saida);

    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = Math.min(9000, freq * 6);
    filtro.connect(env);

    const principal = ctx.createOscillator();
    principal.type = 'sine';
    principal.frequency.value = freq;
    const corpo = ctx.createOscillator();
    corpo.type = 'triangle';
    corpo.frequency.value = freq;
    const corpoGanho = ctx.createGain();
    corpoGanho.gain.value = 0.22;
    const brilho = ctx.createOscillator();
    brilho.type = 'sine';
    brilho.frequency.value = freq * 2;
    const brilhoGanho = ctx.createGain();
    brilhoGanho.gain.value = 0.05;
    principal.connect(filtro);
    corpo.connect(corpoGanho).connect(filtro);
    brilho.connect(brilhoGanho).connect(filtro);

    // Vibrato leve, que entra depois do ataque.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const profundidade = ctx.createGain();
    profundidade.gain.setValueAtTime(0, t0);
    profundidade.gain.linearRampToValueAtTime(freq * 0.006, t0 + 0.28);
    lfo.connect(profundidade);
    profundidade.connect(principal.frequency);
    profundidade.connect(corpo.frequency);

    // Sopro no começo da nota.
    const sopro = ctx.createBufferSource();
    sopro.buffer = this.ruido;
    const soproFiltro = ctx.createBiquadFilter();
    soproFiltro.type = 'bandpass';
    soproFiltro.frequency.value = freq * 2.5;
    soproFiltro.Q.value = 1.5;
    const soproGanho = ctx.createGain();
    soproGanho.gain.setValueAtTime(0.05, t0);
    soproGanho.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    sopro.connect(soproFiltro).connect(soproGanho).connect(env);

    const fontes = [principal, corpo, brilho, lfo];
    for (const f of fontes) f.start(t0);
    sopro.start(t0, Math.random() * 0.5, 0.15);

    let parado = false;
    const parar = (quando = ctx.currentTime) => {
      if (parado) return;
      parado = true;
      const fim = Math.max(quando, t0 + 0.05);
      env.gain.cancelScheduledValues(fim);
      env.gain.setValueAtTime(env.gain.value || volume * 0.8, fim);
      env.gain.linearRampToValueAtTime(0, fim + 0.14);
      for (const f of fontes) f.stop(fim + 0.2);
    };
    if (dur !== null) parar(t0 + dur);
    return { parar };
  }

  // Errou / tocou fora de hora: um "tuc" abafado e curto.
  erro(): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.ruido;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    s.connect(f).connect(g).connect(this.saida);
    s.start(t, Math.random() * 0.5, 0.15);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(og).connect(this.saida);
    o.start(t);
    o.stop(t + 0.16);
  }

  // Metrônomo (madeira): forte no primeiro tempo do compasso.
  tick(quando: number, forte: boolean, volume = 0.12): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = forte ? 1500 : 1100;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = forte ? 1800 : 1300;
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(forte ? volume * 1.4 : volume, quando);
    g.gain.exponentialRampToValueAtTime(0.0008, quando + 0.05);
    o.connect(f).connect(g).connect(this.saida);
    o.start(quando);
    o.stop(quando + 0.06);
  }

  // Clique seco e curtinho (referência de onde está cada nota).
  clique(quando: number, volume = 0.5): void {
    tocarClique(this.ctx, this.ctx.destination, quando, volume);
  }

  // ---------- Áudio da música (mp3/aac enviado pelo admin) ----------

  private cacheAudio = new Map<string, Promise<AudioBuffer>>();

  // Baixa e decodifica o áudio (fica guardado pra próxima partida).
  carregarAudio(url: string): Promise<AudioBuffer> {
    let p = this.cacheAudio.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`áudio não carregou (${r.status})`);
          return r.arrayBuffer();
        })
        .then((b) => this.ctx.decodeAudioData(b));
      p.catch(() => this.cacheAudio.delete(url));
      this.cacheAudio.set(url, p);
    }
    return p;
  }

  // Toca o áudio a partir de `desde` (segundos da música), começando no
  // instante `quando` do relógio. volume() abaixa/sobe (ex: errou uma nota).
  // fim (segundos da música): para ali, com fade de FADE_FIM segundos antes.
  faixa(buffer: AudioBuffer, quando: number, desde = 0, fim?: number): { parar: () => void; abafar: () => void } {
    const ctx = this.ctx;
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    const ganho = ctx.createGain();
    ganho.gain.value = 0.9;
    // ganho separado pro fade (o "abafar" mexe no outro)
    const fade = ctx.createGain();
    fonte.connect(ganho).connect(fade).connect(ctx.destination);
    fonte.start(Math.max(quando, ctx.currentTime), Math.max(0, desde));
    if (fim && fim > desde) {
      const tFim = quando + (fim - desde);
      const tFade = Math.max(quando, tFim - FADE_FIM);
      fade.gain.setValueAtTime(1, tFade);
      fade.gain.linearRampToValueAtTime(0, tFim);
      fonte.stop(tFim + 0.05);
    }
    return {
      parar: () => {
        try {
          fonte.stop();
        } catch {
          // já parou
        }
      },
      // Errou: a música "falha" por um instante, como no Guitar Hero.
      abafar: () => {
        const t = ctx.currentTime;
        ganho.gain.cancelScheduledValues(t);
        ganho.gain.setValueAtTime(ganho.gain.value, t);
        ganho.gain.linearRampToValueAtTime(0.35, t + 0.03);
        ganho.gain.linearRampToValueAtTime(0.9, t + 0.45);
      }
    };
  }

  // Grave do acompanhamento (uma "harpa" bem baixinha).
  grave(freq: number, quando: number, dur: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, quando);
    g.gain.linearRampToValueAtTime(0.16, quando + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, quando + dur);
    o.connect(g).connect(this.saida);
    o.start(quando);
    o.stop(quando + dur + 0.05);
  }
}

// Clique seco (sem eco): estalo de ruído agudo de ~12 ms + um "tic" de
// 2,6 kHz. Corta bem por cima da música, então dá pra ouvir se a nota está
// em cima do tempo. Usado no editor do admin e no "testar".
let ruidoClique: AudioBuffer | null = null;
export function tocarClique(ctx: BaseAudioContext, destino: AudioNode, quando: number, volume = 0.5): void {
  if (!ruidoClique || ruidoClique.sampleRate !== ctx.sampleRate) {
    const n = Math.round(ctx.sampleRate * 0.015);
    ruidoClique = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruidoClique.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 5));
  }
  const s = ctx.createBufferSource();
  s.buffer = ruidoClique;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2500;
  const g = ctx.createGain();
  g.gain.value = volume;
  s.connect(f).connect(g).connect(destino);
  s.start(quando);
  const o = ctx.createOscillator();
  o.frequency.value = 2600;
  const og = ctx.createGain();
  og.gain.setValueAtTime(volume * 0.5, quando);
  og.gain.exponentialRampToValueAtTime(0.0005, quando + 0.025);
  o.connect(og).connect(destino);
  o.start(quando);
  o.stop(quando + 0.03);
}
