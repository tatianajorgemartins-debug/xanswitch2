// Gerador automático de notas do Zelda Tour: análise do áudio, sem tela e
// sem servidor (roda no Web Worker do editor e nos testes do Node).
//
// Duas etapas:
//  1. extrair(): a parte pesada, feita uma vez por arquivo + instrumento em
//     foco. Calcula, quadro a quadro, a "força de início de nota" (spectral
//     flux), a altura (YIN), a energia e o brilho do som, e estima o BPM.
//  2. gerarNotas(): a parte leve, refeita a cada "Regerar". Escolhe os
//     inícios de nota (limiar adaptativo), a altura e a duração de cada um,
//     encaixa na grade e distribui nas 5 pistas.
//
// Instrumento em foco (sem inteligência artificial, só processamento de sinal):
//  - faixa de frequência do instrumento;
//  - separação harmônico/percussivo (HPSS: filtro de mediana no espectro),
//    que tira a bateria das notas (ou deixa só ela, no foco "Ritmo");
//  - centro × laterais do estéreo: voz costuma ficar no centro e guitarras
//    abertas pros lados.

// ---------- Tipos ----------

export type Foco = 'tudo' | 'melodia' | 'guitarra' | 'baixo' | 'ritmo';
type Fonte = 'mix' | 'centro' | 'lados';

export const FOCOS: Record<Foco, { nome: string; dica: string; faixa: [number, number]; fonte: Fonte; hpss: 'h' | 'p' | null }> = {
  tudo: { nome: 'Tudo (música inteira)', dica: 'Pega os ataques mais fortes de qualquer instrumento.', faixa: [60, 4000], fonte: 'mix', hpss: null },
  melodia: { nome: 'Melodia / voz', dica: 'Centro do estéreo, sem bateria: bom pra voz e solo principal.', faixa: [150, 2000], fonte: 'centro', hpss: 'h' },
  guitarra: { nome: 'Violão / guitarra', dica: 'Laterais do estéreo, de 80 Hz a 1,4 kHz, sem bateria.', faixa: [80, 1400], fonte: 'lados', hpss: 'h' },
  baixo: { nome: 'Baixo', dica: 'Só os graves (40–300 Hz), sem bateria.', faixa: [40, 300], fonte: 'mix', hpss: 'h' },
  ritmo: { nome: 'Ritmo / bateria', dica: 'Só a parte percussiva: as pistas seguem o "brilho" de cada batida.', faixa: [40, 8000], fonte: 'mix', hpss: 'p' }
};

export type Caracteristicas = {
  duracao: number; // s
  taxa: number; // quadros por segundo (envelope, energia, brilho)
  centro: number; // s: o quadro q representa o tempo q / taxa + centro (meio da janela)
  env: Float32Array; // força de início de nota, 0..1
  energia: Float32Array;
  brilho: Float32Array; // centroide espectral (Hz)
  taxaAltura: number; // quadros por segundo da altura
  altura: Float32Array; // MIDI (fracionário); NaN = sem altura
  confianca: Float32Array; // 0..1
  bpm: number;
  inicioBatida: number; // s
  usouEstereo: boolean; // separou por posição no estéreo (false = arquivo mono, usou o mix)
};

export type Quantizacao = 0 | 1 | 2 | 4; // 0 = sem; 1 = 1/4 (batida); 2 = 1/8; 4 = 1/16
export type NivelDificuldade = 'facil' | 'medio' | 'dificil' | 'insano';
export type ModoPistas = 'ocarina' | 'relativo';

export type Parametros = {
  sensibilidade: number; // 0..100
  intervaloMinMs: number;
  quantizacao: Quantizacao;
  dificuldade: NivelDificuldade;
  modo: ModoPistas;
  offsetMs: number; // soma em todas as notas (latência)
  notaLongaMs: number; // acima disso vira nota de segurar (0 = nunca)
  bpm: number;
  inicioBatida: number;
};

export type PistaGerada = 'verde' | 'amarelo' | 'vermelho' | 'roxo' | 'azul';
export const ORDEM_PISTAS: PistaGerada[] = ['verde', 'amarelo', 'vermelho', 'roxo', 'azul'];

export type NotaGerada = { t: number; pista: PistaGerada; dur?: number; midi?: number };

export type Resultado = { notas: NotaGerada[]; comAltura: number; candidatos: number };

// ---------- FFT ----------

function fft(re: Float64Array, im: Float64Array, inversa = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let tam = 2; tam <= n; tam <<= 1) {
    const ang = ((inversa ? 2 : -2) * Math.PI) / tam;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += tam) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < tam / 2; k++) {
        const a = i + k;
        const b = a + tam / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inversa) for (let i = 0; i < n; i++) (re[i] /= n), (im[i] /= n);
}

// Mediana de um trecho pequeno (cópia ordenada).
function mediana(v: Float32Array | number[], de: number, ate: number, tmp: Float32Array): number {
  const n = ate - de;
  for (let i = 0; i < n; i++) tmp[i] = v[de + i];
  const s = tmp.subarray(0, n).sort();
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export const hzParaMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

// ---------- Etapa 1: extrair ----------

const N = 1024; // janela da FFT
const SALTO = 256; // ~11,6 ms a 22 050 Hz
const KERNEL = 17; // mediana do HPSS

// L e R já em ~22 050 Hz (R = null se mono).
export function extrair(
  L: Float32Array,
  R: Float32Array | null,
  taxaAmostra: number,
  foco: Foco,
  faixaManual: [number, number] | null = null,
  progresso: (p: number) => void = () => {}
): Caracteristicas {
  const cfg = FOCOS[foco];
  const [fBaixa, fAlta] = faixaManual ?? cfg.faixa;

  // Sinal base: o mix (média dos canais). O foco no centro ou nas laterais
  // vem da máscara de estéreo (abaixo), frequência por frequência.
  const x = new Float32Array(L.length);
  if (R) for (let i = 0; i < L.length; i++) x[i] = (L[i] + R[i]) / 2;
  else x.set(L);
  // Arquivo mono (ou quase): não dá pra separar por posição.
  let usouEstereo = false;
  if (R && cfg.fonte !== 'mix') {
    let eLados = 0;
    let eCentro = 0;
    for (let i = 0; i < L.length; i += 4) {
      const sd = (L[i] - R[i]) / 2;
      const m = (L[i] + R[i]) / 2;
      eLados += sd * sd;
      eCentro += m * m;
    }
    usouEstereo = eLados > eCentro * 0.01;
  }

  const quadros = Math.max(1, Math.floor((x.length - N) / SALTO) + 1);
  const bins = N / 2 + 1;
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const binHz = taxaAmostra / N;
  const kBaixo = Math.max(1, Math.floor(fBaixa / binHz));
  const kAlto = Math.min(bins - 1, Math.ceil(fAlta / binHz));

  // Espectro do mix (magnitude) e, com estéreo, a máscara de posição:
  // |E−D| / (|E|+|D|) é 0 no centro e 1 num lado só.
  const mag = new Float32Array(quadros * bins);
  let mascara: Float32Array | null = usouEstereo ? new Float32Array(quadros * bins) : null;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const re2 = new Float64Array(N);
  const im2 = new Float64Array(N);
  for (let q = 0; q < quadros; q++) {
    const ini = q * SALTO;
    if (usouEstereo && R && mascara) {
      for (let i = 0; i < N; i++) {
        re[i] = L[ini + i] * hann[i];
        im[i] = 0;
        re2[i] = R[ini + i] * hann[i];
        im2[i] = 0;
      }
      fft(re, im);
      fft(re2, im2);
      for (let k = 0; k < bins; k++) {
        const somaR = (re[k] + re2[k]) / 2;
        const somaI = (im[k] + im2[k]) / 2;
        mag[q * bins + k] = Math.hypot(somaR, somaI);
        const a = Math.hypot(re[k], im[k]);
        const b = Math.hypot(re2[k], im2[k]);
        const lado = a + b > 1e-9 ? Math.hypot(re[k] - re2[k], im[k] - im2[k]) / (a + b) : 0;
        mascara[q * bins + k] = cfg.fonte === 'lados' ? Math.pow(Math.min(1, lado), 0.7) : Math.pow(Math.max(0, 1 - lado), 2);
      }
    } else {
      for (let i = 0; i < N; i++) {
        re[i] = x[ini + i] * hann[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let k = 0; k < bins; k++) mag[q * bins + k] = Math.hypot(re[k], im[k]);
    }
    if (q % 500 === 0) progresso(0.25 * (q / quadros));
  }

  // HPSS (sobre o que sobrou da máscara de estéreo): harmônico = mediana no
  // tempo; percussivo = mediana na frequência.
  if (cfg.hpss) {
    const base = mascara;
    const foco = new Float32Array(quadros * bins);
    for (let i = 0; i < foco.length; i++) foco[i] = mag[i] * (base ? base[i] : 1);
    const nova = new Float32Array(quadros * bins);
    const tmp = new Float32Array(KERNEL);
    const coluna = new Float32Array(quadros);
    const meio = KERNEL >> 1;
    const H = new Float32Array(quadros * bins);
    for (let k = kBaixo; k <= kAlto; k++) {
      for (let q = 0; q < quadros; q++) coluna[q] = foco[q * bins + k];
      for (let q = 0; q < quadros; q++) H[q * bins + k] = mediana(coluna, Math.max(0, q - meio), Math.min(quadros, q + meio + 1), tmp);
      if (k % 20 === 0) progresso(0.25 + 0.2 * ((k - kBaixo) / Math.max(1, kAlto - kBaixo)));
    }
    for (let q = 0; q < quadros; q++) {
      const linha = foco.subarray(q * bins, (q + 1) * bins);
      for (let k = kBaixo; k <= kAlto; k++) {
        const pm = mediana(linha, Math.max(0, k - meio), Math.min(bins, k + meio + 1), tmp);
        const h = H[q * bins + k];
        const h2 = h * h;
        const p2 = pm * pm;
        const mh = h2 + p2 > 0 ? h2 / (h2 + p2) : 0;
        nova[q * bins + k] = (cfg.hpss === 'h' ? mh : 1 - mh) * (base ? base[q * bins + k] : 1);
      }
      if (q % 500 === 0) progresso(0.45 + 0.15 * (q / quadros));
    }
    mascara = nova;
  }

  // Envelope de início (flux), energia e brilho, só na faixa.
  const env = new Float32Array(quadros);
  const energia = new Float32Array(quadros);
  const brilho = new Float32Array(quadros);
  const ant = new Float32Array(bins);
  let maxEnv = 0;
  for (let q = 0; q < quadros; q++) {
    let fluxo = 0;
    let e = 0;
    let soma = 0;
    for (let k = kBaixo; k <= kAlto; k++) {
      const v = mag[q * bins + k] * (mascara ? mascara[q * bins + k] : 1);
      const lv = Math.log1p(100 * v);
      if (q > 0 && lv > ant[k]) fluxo += lv - ant[k];
      ant[k] = lv;
      e += v * v;
      soma += v * k * binHz;
    }
    const total = Math.sqrt(e);
    env[q] = fluxo;
    energia[q] = total;
    let somaV = 0;
    for (let k = kBaixo; k <= kAlto; k++) somaV += mag[q * bins + k] * (mascara ? mascara[q * bins + k] : 1);
    brilho[q] = somaV > 0 ? soma / somaV : 0;
    if (fluxo > maxEnv) maxEnv = fluxo;
  }
  if (maxEnv > 0) for (let q = 0; q < quadros; q++) env[q] /= maxEnv;
  progresso(0.62);

  // Sinal pra altura: só a faixa (e só o harmônico), de volta pro tempo (overlap-add).
  let sinal: Float32Array;
  if (cfg.hpss === 'p') sinal = new Float32Array(0);
  else {
    sinal = new Float32Array(x.length);
    const peso = new Float32Array(x.length);
    for (let q = 0; q < quadros; q++) {
      const ini = q * SALTO;
      for (let i = 0; i < N; i++) {
        re[i] = x[ini + i] * hann[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let k = 0; k < bins; k++) {
        const g = k < kBaixo || k > kAlto ? 0 : mascara ? mascara[q * bins + k] : 1;
        re[k] *= g;
        im[k] *= g;
        if (k > 0 && k < N / 2) {
          re[N - k] = re[k];
          im[N - k] = -im[k];
        }
      }
      fft(re, im, true);
      for (let i = 0; i < N; i++) {
        sinal[ini + i] += re[i] * hann[i];
        peso[ini + i] += hann[i] * hann[i];
      }
      if (q % 500 === 0) progresso(0.62 + 0.13 * (q / quadros));
    }
    for (let i = 0; i < sinal.length; i++) if (peso[i] > 1e-6) sinal[i] /= peso[i];
  }

  // Altura (YIN) a cada 2 quadros.
  const passoAltura = SALTO * 2;
  const quadrosAltura = sinal.length ? Math.max(1, Math.floor((sinal.length - 2048) / passoAltura)) : 0;
  const altura = new Float32Array(Math.max(quadrosAltura, 1)).fill(NaN);
  const confianca = new Float32Array(Math.max(quadrosAltura, 1));
  const tauMin = Math.max(2, Math.floor(taxaAmostra / Math.min(fAlta, 1500)));
  const tauMax = Math.min(1000, Math.ceil(taxaAmostra / Math.max(fBaixa, 40)));
  const W = Math.min(1024, Math.max(384, tauMax));
  const d = new Float64Array(tauMax + 2);
  for (let q = 0; q < quadrosAltura; q++) {
    const ini = q * passoAltura;
    if (ini + W + tauMax + 1 >= sinal.length) break;
    let rms = 0;
    for (let i = 0; i < W; i++) rms += sinal[ini + i] * sinal[ini + i];
    if (rms / W < 1e-7) continue;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) {
        const dif = sinal[ini + i] - sinal[ini + i + tau];
        s += dif * dif;
      }
      d[tau] = s;
    }
    // Diferença normalizada acumulada.
    let acum = 0;
    let melhor = -1;
    let melhorV = 1;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      acum += d[tau];
      d[tau] = acum > 0 ? (d[tau] * tau) / acum : 1;
    }
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (d[tau] < 0.15) {
        while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++;
        melhor = tau;
        melhorV = d[tau];
        break;
      }
      if (d[tau] < melhorV) {
        melhorV = d[tau];
        melhor = tau;
      }
    }
    if (melhor < 0 || melhorV > 0.4) continue;
    // Erro de oitava: se metade/terço/quarto do período também é um vale
    // quase tão bom, a nota de verdade é a mais aguda.
    for (const div of [4, 3, 2]) {
      const alvo = Math.round(melhor / div);
      if (alvo < tauMin) continue;
      let vale = alvo;
      for (let t2 = Math.max(tauMin, alvo - 2); t2 <= alvo + 2; t2++) if (d[t2] < d[vale]) vale = t2;
      if (d[vale] < Math.max(0.2, melhorV * 1.6)) {
        melhor = vale;
        melhorV = d[vale];
        break;
      }
    }
    // Interpolação parabólica.
    const a = d[melhor - 1] ?? d[melhor];
    const b = d[melhor];
    const c = d[melhor + 1] ?? d[melhor];
    const desloc = a + c - 2 * b !== 0 ? (0.5 * (a - c)) / (a + c - 2 * b) : 0;
    const f = taxaAmostra / (melhor + desloc);
    if (f < fBaixa * 0.8 || f > fAlta * 1.25) continue;
    altura[q] = hzParaMidi(f);
    confianca[q] = 1 - melhorV;
    if (q % 300 === 0) progresso(0.75 + 0.2 * (q / quadrosAltura));
  }

  const taxa = taxaAmostra / SALTO;
  // O quadro q cobre a janela que começa em q*SALTO: o ataque aparece com
  // ela centrada nele, meia janela depois do começo.
  const centro = N / 2 / taxaAmostra;
  const batidaEstimada = estimarBatida(env, taxa);
  const bpm = batidaEstimada.bpm;
  const inicioBatida = Math.round((batidaEstimada.inicioBatida + centro) * 1000) / 1000;
  progresso(1);
  return {
    duracao: x.length / taxaAmostra,
    taxa,
    centro,
    env,
    energia,
    brilho,
    taxaAltura: taxaAmostra / passoAltura,
    altura,
    confianca,
    bpm,
    inicioBatida,
    usouEstereo
  };
}

// ---------- BPM e grade ----------

// Autocorrelação do envelope (60–200 bpm, com preferência suave perto de
// 120) e, depois, a fase que mais coincide com os picos.
export function estimarBatida(env: Float32Array, taxa: number): { bpm: number; inicioBatida: number } {
  const n = env.length;
  let media = 0;
  for (let i = 0; i < n; i++) media += env[i];
  media /= Math.max(1, n);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) e[i] = Math.max(0, env[i] - media);
  const lagMin = Math.floor((60 / 200) * taxa);
  const lagMax = Math.ceil((60 / 60) * taxa);
  let melhorLag = Math.round((60 / 120) * taxa);
  let melhorV = -Infinity;
  const ac = new Float64Array(lagMax + 2);
  for (let lag = lagMin; lag <= lagMax + 1 && lag < n; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += e[i] * e[i + lag];
    ac[lag] = s / (n - lag);
  }
  for (let lag = lagMin + 1; lag <= lagMax; lag++) {
    const bpm = (60 * taxa) / lag;
    const peso = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.8, 2));
    // Somar o dobro do período reforça o tempo certo (e não a metade).
    const v = (ac[lag] + 0.5 * (ac[lag * 2] ?? 0)) * peso;
    if (v > melhorV) {
      melhorV = v;
      melhorLag = lag;
    }
  }
  const a = ac[melhorLag - 1];
  const b = ac[melhorLag];
  const c = ac[melhorLag + 1];
  const den = a + c - 2 * b;
  const lagFino = den !== 0 ? melhorLag + (0.5 * (a - c)) / den : melhorLag;
  const bruto = (60 * taxa) / lagFino;

  // Refino: a autocorrelação só tem a resolução de 1 quadro (~0,3 bpm), e
  // numa música longa isso desloca a grade em quase 1 s no fim. Testa bpms
  // de 0,02 em 0,02 por perto e fica com a grade (bpm + fase) que mais
  // coincide com os picos de início de nota.
  const pontuar = (b: number) => {
    const periodo = (60 / b) * taxa;
    let melhorFase = 0;
    let melhorSoma = -1;
    for (let f = 0; f < periodo; f += 0.5) {
      let soma = 0;
      for (let t = f; t < n; t += periodo) {
        const i = Math.round(t);
        soma += env[i] + 0.5 * ((env[i - 1] ?? 0) + (env[i + 1] ?? 0));
      }
      if (soma > melhorSoma) {
        melhorSoma = soma;
        melhorFase = f;
      }
    }
    // normaliza pelo número de batidas (bpm maior teria mais termos)
    return { soma: melhorSoma / (n / periodo), fase: melhorFase };
  };
  let bpm = bruto;
  let melhor = pontuar(bruto);
  for (let b = bruto - 1.5; b <= bruto + 1.5; b += 0.02) {
    const r = pontuar(b);
    if (r.soma > melhor.soma) {
      melhor = r;
      bpm = b;
    }
  }
  // Música costuma ter bpm inteiro: arredonda se a grade inteira for quase tão boa.
  const inteiro = Math.round(bpm);
  const rInteiro = pontuar(inteiro);
  if (Math.abs(bpm - inteiro) < 0.6 && rInteiro.soma >= melhor.soma * 0.96) {
    bpm = inteiro;
    melhor = rInteiro;
  } else bpm = Math.round(bpm * 100) / 100;
  return { bpm, inicioBatida: Math.round((melhor.fase / taxa) * 1000) / 1000 };
}

// ---------- Etapa 2: gerar as notas ----------

// Quantas batidas no mínimo entre notas em cada dificuldade.
const ESPACO_BATIDAS: Record<NivelDificuldade, number> = { facil: 2, medio: 1, dificil: 0.5, insano: 0 };

// Ocarina of Time: Ré4 → verde (A), Fá4 → amarelo (C↓), Lá4 → vermelho (C→),
// Si4 → roxo (C←), Ré5 → azul (C↑). Em qualquer oitava, pela nota mais
// próxima; o Ré vai pro verde ou pro azul conforme está abaixo ou acima do
// meio da melodia.
export function pistaOcarina(midi: number, meioMelodia: number): PistaGerada {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const alvos: [number, PistaGerada][] = [
    [2, 'verde'],
    [5, 'amarelo'],
    [9, 'vermelho'],
    [11, 'roxo']
  ];
  let melhor: PistaGerada = 'verde';
  let dist = 99;
  for (const [alvo, pista] of alvos) {
    const dd = Math.min(Math.abs(pc - alvo), 12 - Math.abs(pc - alvo));
    if (dd < dist || (dd === dist && alvo > 2)) {
      dist = dd;
      melhor = pista;
    }
  }
  if (melhor === 'verde' && midi >= meioMelodia) return 'azul';
  return melhor;
}

function quantil(ordenado: number[], q: number) {
  if (!ordenado.length) return 0;
  const i = Math.min(ordenado.length - 1, Math.max(0, Math.round(q * (ordenado.length - 1))));
  return ordenado[i];
}

// Relativo: divide a extensão (sem os extremos) em 5 faixas iguais de nota.
function pistaRelativa(v: number, cortes: number[]): PistaGerada {
  let i = 0;
  while (i < 4 && v > cortes[i]) i++;
  return ORDEM_PISTAS[i];
}

export function gerarNotas(c: Caracteristicas, p: Parametros): Resultado {
  const { env, taxa } = c;
  const n = env.length;
  const batida = 60 / Math.max(30, p.bpm);
  const s = Math.min(100, Math.max(0, p.sensibilidade)) / 100;

  // 1. Picos acima de um limiar que acompanha a música (média local + delta).
  const janela = Math.round(taxa * 0.4);
  const delta = 0.22 - 0.2 * s; // sensibilidade alta = limiar baixo
  const somaPref = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) somaPref[i + 1] = somaPref[i] + env[i];
  const minQuadros = Math.max(1, Math.round((p.intervaloMinMs / 1000) * taxa));
  const picos: { q: number; forca: number }[] = [];
  let ultimo = -Infinity;
  for (let q = 1; q < n - 1; q++) {
    const de = Math.max(0, q - janela);
    const ate = Math.min(n, q + janela + 1);
    const mediaLocal = (somaPref[ate] - somaPref[de]) / (ate - de);
    const limiar = mediaLocal * (1.1 + 0.6 * (1 - s)) + delta;
    if (env[q] < limiar) continue;
    let maxLocal = true;
    for (let k = Math.max(0, q - 3); k <= Math.min(n - 1, q + 3); k++) if (env[k] > env[q]) maxLocal = false;
    if (!maxLocal) continue;
    if (q - ultimo < minQuadros) {
      // fica com o mais forte dos dois
      if (picos.length && env[q] > picos[picos.length - 1].forca + limiar) picos[picos.length - 1] = { q, forca: env[q] - limiar };
      continue;
    }
    picos.push({ q, forca: env[q] - limiar });
    ultimo = q;
  }

  // 2. Densidade da dificuldade: os mais fortes primeiro, com espaço mínimo.
  const espaco = Math.max(ESPACO_BATIDAS[p.dificuldade] * batida * 0.95, p.intervaloMinMs / 1000);
  const escolhidos: { t: number; forca: number }[] = [];
  for (const pk of [...picos].sort((a, b) => b.forca - a.forca)) {
    const t = pk.q / taxa + c.centro;
    if (escolhidos.every((e) => Math.abs(e.t - t) >= espaco)) escolhidos.push({ t, forca: pk.forca });
  }
  escolhidos.sort((a, b) => a.t - b.t);

  // 3. Altura e duração de cada nota.
  const passo = p.quantizacao ? batida / p.quantizacao : 0;
  const encaixar = (t: number) => (passo ? p.inicioBatida + Math.round((t - p.inicioBatida) / passo) * passo : t);
  const brutas: { t: number; fim: number; midi: number | null; brilho: number; forca: number }[] = [];
  for (let i = 0; i < escolhidos.length; i++) {
    const t = escolhidos[i].t;
    const prox = escolhidos[i + 1]?.t ?? c.duracao;
    const de = Math.floor((t + 0.03) * c.taxaAltura);
    const ate = Math.min(c.altura.length, Math.ceil(Math.min(t + 0.25, prox) * c.taxaAltura));
    const vals: number[] = [];
    for (let q = de; q < ate; q++) if (!Number.isNaN(c.altura[q]) && c.confianca[q] > 0.6) vals.push(c.altura[q]);
    vals.sort((a, b) => a - b);
    const midi = vals.length ? vals[Math.floor(vals.length / 2)] : null;

    // Quanto tempo a mesma nota se sustenta.
    let fim = t + 0.1;
    if (midi !== null) {
      const qEnergia = Math.round(t * taxa);
      const energiaInicio = Math.max(...Array.from(c.energia.subarray(qEnergia, Math.min(c.energia.length, qEnergia + 6))), 1e-9);
      let q = de;
      let falhas = 0;
      for (; q < c.altura.length && q / c.taxaAltura < prox - 0.05; q++) {
        const e = c.energia[Math.min(c.energia.length - 1, Math.round((q / c.taxaAltura) * taxa))];
        const ok = !Number.isNaN(c.altura[q]) && Math.abs(c.altura[q] - midi) < 0.7 && e > energiaInicio * 0.2;
        if (ok) falhas = 0;
        else if (++falhas > 2) break;
      }
      fim = Math.max(fim, (q - falhas) / c.taxaAltura);
    }
    const qb = Math.min(c.brilho.length - 1, Math.round(t * taxa) + 2);
    brutas.push({ t, fim, midi, brilho: c.brilho[qb], forca: escolhidos[i].forca });
  }

  // 4. Pistas.
  const alturas = brutas.filter((b) => b.midi !== null).map((b) => b.midi as number).sort((a, b) => a - b);
  const brilhos = brutas.map((b) => b.brilho).sort((a, b) => a - b);
  const meio = quantil(alturas, 0.5);
  // Extensão da melodia (sem os 5% mais extremos) dividida em 5 faixas iguais.
  const piso = quantil(alturas, 0.05);
  const teto = Math.max(piso + 1, quantil(alturas, 0.95));
  const cortesAltura = [1, 2, 3, 4].map((i) => piso + ((teto - piso) * i) / 5);
  const cortesBrilho = [0.2, 0.4, 0.6, 0.8].map((q) => quantil(brilhos, q));
  const usarAltura = alturas.length >= Math.max(3, brutas.length * 0.3);

  const offset = p.offsetMs / 1000;
  const porTempo = new Map<number, NotaGerada & { forca: number }>();
  for (const b of brutas) {
    let pista: PistaGerada;
    if (usarAltura && b.midi !== null) pista = p.modo === 'ocarina' ? pistaOcarina(b.midi, meio) : pistaRelativa(b.midi, cortesAltura);
    else pista = pistaRelativa(b.brilho, cortesBrilho);
    const t = Math.max(0, Math.round((encaixar(b.t) + offset) * 1000) / 1000);
    const sustenta = b.fim - b.t;
    const nota: NotaGerada & { forca: number } = { t, pista, forca: b.forca, ...(b.midi !== null ? { midi: Math.round(b.midi * 10) / 10 } : {}) };
    if (p.notaLongaMs > 0 && sustenta * 1000 >= p.notaLongaMs) {
      const fimEncaixado = passo ? encaixar(b.fim) : b.fim;
      const dur = Math.round((fimEncaixado - encaixar(b.t)) * 1000) / 1000;
      if (dur >= 0.2) nota.dur = dur;
    }
    // Duas notas no mesmo lugar depois de encaixar: fica a mais forte.
    const chave = Math.round(t * 1000);
    const ja = porTempo.get(chave);
    if (!ja || ja.forca < nota.forca) porTempo.set(chave, nota);
  }
  const notas = [...porTempo.values()].sort((a, b) => a.t - b.t).map(({ forca: _f, ...resto }) => resto);
  // Nota longa não pode atravessar a próxima.
  for (let i = 0; i < notas.length - 1; i++) {
    const nd = notas[i].dur;
    if (nd && notas[i].t + nd > notas[i + 1].t - 0.08) {
      const novo = Math.round((notas[i + 1].t - notas[i].t - 0.08) * 1000) / 1000;
      if (novo >= 0.2) notas[i].dur = novo;
      else delete notas[i].dur;
    }
  }
  return { notas, comAltura: brutas.filter((b) => b.midi !== null).length, candidatos: picos.length };
}
