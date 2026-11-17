// Compacta o áudio da música NO NAVEGADOR do admin, sem nenhuma biblioteca:
// decodifica o mp3, junta os canais em mono e recodifica em AAC (96 kbps)
// com o codificador do próprio navegador (WebCodecs). O resultado é um
// .aac (ADTS), que toca em qualquer celular. Uma música de 3 min fica com
// ~2 MB. Se o navegador não tiver o codificador, sobe o arquivo original.

export type AudioCompactado = {
  arquivo: Blob;
  tipo: string; // content-type
  ext: 'aac' | 'mp3' | 'm4a';
  duracao: number;
  compactou: boolean;
};

const BITRATE = 96_000;
// Índice da frequência no cabeçalho ADTS.
const FREQ_ADTS: Record<number, number> = { 96000: 0, 88200: 1, 64000: 2, 48000: 3, 44100: 4, 32000: 5, 24000: 6, 22050: 7, 16000: 8 };

function cabecalhoAdts(tamanhoDados: number, taxa: number, canais: number): Uint8Array {
  const total = tamanhoDados + 7;
  const h = new Uint8Array(7);
  const perfil = 1; // AAC LC (tipo 2) − 1
  const fi = FREQ_ADTS[taxa] ?? 4;
  h[0] = 0xff;
  h[1] = 0xf1; // MPEG-4, sem CRC
  h[2] = (perfil << 6) | (fi << 2) | ((canais >> 2) & 1);
  h[3] = ((canais & 3) << 6) | ((total >> 11) & 3);
  h[4] = (total >> 3) & 0xff;
  h[5] = ((total & 7) << 5) | 0x1f;
  h[6] = 0xfc;
  return h;
}

function extensaoOriginal(f: File): AudioCompactado['ext'] {
  const n = f.name.toLowerCase();
  return n.endsWith('.m4a') || n.endsWith('.mp4') ? 'm4a' : n.endsWith('.aac') ? 'aac' : 'mp3';
}

export async function compactarAudio(arquivo: File, progresso: (p: number) => void): Promise<AudioCompactado> {
  const dados = await arquivo.arrayBuffer();
  const ctx = new AudioContext();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(dados.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }
  const original: AudioCompactado = {
    arquivo,
    tipo: arquivo.type || 'audio/mpeg',
    ext: extensaoOriginal(arquivo),
    duracao: buffer.duration,
    compactou: false
  };

  const taxa = buffer.sampleRate === 44100 || buffer.sampleRate === 48000 ? buffer.sampleRate : 44100;
  if (typeof AudioEncoder === 'undefined') return original;
  const config: AudioEncoderConfig & { aac?: { format: 'adts' | 'aac' } } = {
    codec: 'mp4a.40.2',
    sampleRate: taxa,
    numberOfChannels: 1,
    bitrate: BITRATE,
    aac: { format: 'adts' }
  };
  const suporte = await AudioEncoder.isConfigSupported(config).catch(() => null);
  if (!suporte?.supported) return original;

  // Mono (e na taxa certa, se precisar reamostrar).
  let mono: Float32Array;
  if (buffer.sampleRate === taxa) {
    mono = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels;
    }
  } else {
    const off = new OfflineAudioContext(1, Math.ceil(buffer.duration * taxa), taxa);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(off.destination);
    src.start();
    mono = (await off.startRendering()).getChannelData(0);
  }

  const pedacos: Uint8Array[] = [];
  let erro: Error | null = null;
  const enc = new AudioEncoder({
    output: (chunk) => {
      const b = new Uint8Array(chunk.byteLength);
      chunk.copyTo(b);
      // Se o navegador não pôs o cabeçalho ADTS, põe aqui.
      const temCabecalho = b[0] === 0xff && (b[1] & 0xf0) === 0xf0;
      pedacos.push(temCabecalho ? b : new Uint8Array([...cabecalhoAdts(b.length, taxa, 1), ...b]));
    },
    error: (e) => {
      erro = e instanceof Error ? e : new Error(String(e));
    }
  });
  enc.configure(config);
  const BLOCO = taxa; // 1 s por vez
  for (let i = 0; i < mono.length; i += BLOCO) {
    const parte = mono.subarray(i, Math.min(i + BLOCO, mono.length));
    const ad = new AudioData({
      format: 'f32-planar',
      sampleRate: taxa,
      numberOfFrames: parte.length,
      numberOfChannels: 1,
      timestamp: Math.round((i / taxa) * 1_000_000),
      data: new Float32Array(parte)
    });
    enc.encode(ad);
    ad.close();
    if (i % (BLOCO * 10) === 0) {
      progresso(i / mono.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (erro) break;
  }
  await enc.flush().catch((e) => {
    erro = e;
  });
  enc.close();
  progresso(1);
  if (erro || !pedacos.length) return original;

  const total = pedacos.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let o = 0;
  for (const p of pedacos) {
    saida.set(p, o);
    o += p.length;
  }
  // Ficou maior que o original (mp3 já bem leve)? Usa o original.
  if (total >= arquivo.size) return original;
  return { arquivo: new Blob([saida], { type: 'audio/aac' }), tipo: 'audio/aac', ext: 'aac', duracao: buffer.duration, compactou: true };
}

export function formatarBytes(n: number): string {
  return n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.round(n / 1024)} KB`;
}
