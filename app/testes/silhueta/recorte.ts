// Recorte da silhueta (níveis Difícil e Insano): qual pedaço da figura
// aparece. O ponto é escolhido olhando a própria imagem (pra cair num
// pedaço que tenha figura, e não no vazio) e sai da semente do dia — então é
// o mesmo pedaço pra todo mundo.

export type Analise = {
  // tamanho real da imagem
  w: number;
  h: number;
  // grade pequena com a opacidade de cada ponto (0 a 255)
  grade: Uint8Array;
  gw: number;
  gh: number;
};

export type Enquadramento = {
  // centro do recorte, de 0 a 1 em relação à imagem
  u: number;
  v: number;
  // giro em graus e espelhado (só no Insano)
  giro: number;
  espelho: boolean;
};

const LADO_GRADE = 64;

export function analisarImagem(url: string): Promise<Analise> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const k = LADO_GRADE / Math.max(w, h);
      const gw = Math.max(1, Math.round(w * k));
      const gh = Math.max(1, Math.round(h * k));
      const grade = new Uint8Array(gw * gh);
      try {
        const c = document.createElement('canvas');
        c.width = gw;
        c.height = gh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, gw, gh);
          const d = ctx.getImageData(0, 0, gw, gh).data;
          for (let i = 0; i < gw * gh; i++) grade[i] = d[i * 4 + 3];
        }
      } catch {
        // sem canvas: a grade fica vazia e o recorte cai no meio da figura
      }
      resolve({ w, h, grade, gw, gh });
    };
    img.onerror = () => reject(new Error('imagem não carregou'));
    img.src = url;
  });
}

// Quanto da janela (recorte de tamanho f, centro u,v) tem figura.
function cobertura(a: Analise, u: number, v: number, f: number): number {
  const lado = f * Math.max(a.gw, a.gh);
  const x0 = Math.floor(u * a.gw - lado / 2);
  const y0 = Math.floor(v * a.gh - lado / 2);
  const n = Math.max(1, Math.round(lado));
  let cheio = 0;
  let total = 0;
  for (let y = y0; y < y0 + n; y++)
    for (let x = x0; x < x0 + n; x++) {
      total++;
      if (x >= 0 && y >= 0 && x < a.gw && y < a.gh && a.grade[y * a.gw + x] > 128) cheio++;
    }
  return total ? cheio / total : 0;
}

// Escolhe o centro do recorte: um ponto com figura em que a janela não fique
// nem toda preta (sem contorno, impossível) nem quase vazia.
export function escolherEnquadramento(a: Analise, f: number, rng: () => number, embaralhado: boolean): Enquadramento {
  const pontos: [number, number][] = [];
  for (let y = 0; y < a.gh; y++) for (let x = 0; x < a.gw; x++) if (a.grade[y * a.gw + x] > 128) pontos.push([(x + 0.5) / a.gw, (y + 0.5) / a.gh]);
  let melhor: [number, number] = [0.5, 0.5];
  let nota = Infinity;
  for (let i = 0; i < 60 && pontos.length; i++) {
    const [u, v] = pontos[Math.floor(rng() * pontos.length)];
    const c = cobertura(a, u, v, f);
    const distancia = Math.abs(c - 0.5);
    if (distancia < nota) {
      nota = distancia;
      melhor = [u, v];
    }
    if (c >= 0.35 && c <= 0.65) break;
  }
  const giro = embaralhado ? (rng() < 0.5 ? -1 : 1) * (35 + Math.round(rng() * 120)) : 0;
  const espelho = embaralhado && rng() < 0.5;
  return { u: melhor[0], v: melhor[1], giro, espelho };
}

// Posição da imagem dentro da moldura quadrada, em % da moldura. Com f = 1 e
// centro no meio, a figura aparece inteira (como object-fit: contain).
export function posicaoNaMoldura(a: Pick<Analise, 'w' | 'h'>, f: number, u: number, v: number) {
  const m = Math.max(a.w, a.h);
  const largura = (a.w / (f * m)) * 100;
  const altura = (a.h / (f * m)) * 100;
  return { largura, altura, esquerda: 50 - u * largura, topo: 50 - v * altura };
}

// Conforme o recorte abre, o centro vai andando até o meio da figura.
export function centroNoRecorte(e: Enquadramento, f: number, fInicial: number): { u: number; v: number } {
  const t = fInicial >= 1 ? 1 : Math.min(1, Math.max(0, (f - fInicial) / (1 - fInicial)));
  return { u: e.u + (0.5 - e.u) * t * t, v: e.v + (0.5 - e.v) * t * t };
}
