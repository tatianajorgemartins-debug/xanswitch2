// Desenha o card colecionável num <canvas> e gera o PNG pra download — tudo
// no navegador, sem depender de nenhum serviço externo (Canvas API padrão).
// O visual daqui é uma versão redesenhada (não pixel-a-pixel idêntica) do
// card animado que aparece na tela em CollectibleCard.tsx: a tela usa
// HTML/CSS (mais fácil de animar a revelação), e este arquivo redesenha o
// mesmo conceito usando só formas e texto do Canvas 2D, que é o jeito de
// virar um arquivo de imagem de verdade pra baixar.

export type CardData = {
  gameName: string;
  imageUrl: string | null;
  points: number; // 1 a 5 — quantas "gemas" aparecem preenchidas
};

const MAX_GEMS = 5;
const CANVAS_WIDTH = 750;
// Mais alto que antes pra caber a caixa da capa QUADRADA (ver imageBoxH
// abaixo) — alguns jogos tinham a logo cortada numa caixa retangular mais
// baixa, então agora ela sempre tem a mesma largura e altura.
const CANVAS_HEIGHT = 1060;

// Mesmas cores do card na tela (ver "Card colecionável" em
// app/redesign.css) — repetidas aqui porque um <canvas> não lê CSS.
const COLOR_BG_TOP = '#1f1540';
const COLOR_BG_MID = '#120c26';
const COLOR_BG_BOTTOM = '#0c0819';
const COLOR_VIOLET = '#7b4df5';
const COLOR_VIOLET_2 = '#9068f2';
const COLOR_SEAL_LIGHT = '#a07cff';
const COLOR_SEAL_DARK = '#7b2ff0';
const COLOR_LAVENDER = '#b9a5ff';
const COLOR_LAVENDER_LIGHT = '#e2d8ff';
const COLOR_LABEL = '#8e86b0';
const COLOR_GLOW = 'rgba(123, 77, 245, 0.75)';

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Losango (um quadrado girado 45°) — a gema do topo e as do rodapé.
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fill: string | CanvasGradient,
  glow = false
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  if (glow) {
    ctx.shadowColor = COLOR_GLOW;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = fill;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

// Selo octogonal (8 lados) do canto inferior direito, com o número de pontos.
function octagonPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Carrega uma imagem pronta pra desenhar no canvas. crossOrigin=anonymous é
// necessário pra depois dar pra exportar o canvas como PNG (imagem "de
// fora" sem isso deixa o canvas "contaminado" e o navegador bloqueia o
// download) — funciona porque o Supabase Storage já manda os cabeçalhos de
// CORS certos pra arquivos de bucket público.
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem do jogo.'));
    img.src = url;
  });
}

// A fonte do site (Archivo, carregada pelo next/font em SiteShell.tsx) tem
// um nome gerado na hora do build — lê o nome de verdade da variável CSS
// que o SiteShell coloca no .redesign. Fora dele, cai numa sans comum.
function siteFontFamily(): string {
  const root = document.querySelector('.redesign');
  const family = root ? getComputedStyle(root).getPropertyValue('--font-redesign').trim() : '';
  return `${family ? `${family}, ` : ''}'Helvetica Neue', Arial, sans-serif`;
}

// Garante que a fonte já está pronta antes de escrever texto com ela — sem
// isso, o canvas às vezes desenha com a fonte de respaldo na primeira vez.
async function ensureFontLoaded(family: string): Promise<void> {
  try {
    await document.fonts.load(`800 32px ${family}`);
  } catch {
    // Sem problema — o canvas usa a fonte de respaldo do font-family.
  }
}

// Espaçamento entre letras (rótulos em caixa alta) — só nos navegadores
// que suportam; nos outros o texto sai sem o espaçamento extra.
function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string): void {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

export async function renderCollectibleCard(canvas: HTMLCanvasElement, data: CardData): Promise<void> {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não suporta desenhar o card.');

  const family = siteFontFamily();
  await ensureFontLoaded(family);
  const font = (size: number) => `800 ${size}px ${family}`;

  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;

  // --- Fundo do card, com um brilho roxo no topo ---
  const bgGradient = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bgGradient.addColorStop(0, COLOR_BG_TOP);
  bgGradient.addColorStop(0.55, COLOR_BG_MID);
  bgGradient.addColorStop(1, COLOR_BG_BOTTOM);
  roundedRectPath(ctx, 0, 0, w, h, 40);
  ctx.fillStyle = bgGradient;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const topGlow = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.75);
  topGlow.addColorStop(0, 'rgba(144, 104, 242, 0.35)');
  topGlow.addColorStop(1, 'rgba(144, 104, 242, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // --- Moldura: contorno lavanda com brilho + traço fino interno ---
  roundedRectPath(ctx, 3, 3, w - 6, h - 6, 38);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(185, 165, 255, 0.6)';
  ctx.shadowColor = COLOR_GLOW;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  roundedRectPath(ctx, 18, 18, w - 36, h - 36, 28);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(185, 165, 255, 0.16)';
  ctx.stroke();

  // --- Topo: logo XAN SWITCH + gema ---
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(20);
  setLetterSpacing(ctx, '4px');
  ctx.fillStyle = '#ffffff';
  ctx.fillText('XAN', 64, 72);
  const xanWidth = ctx.measureText('XAN').width;
  ctx.fillStyle = COLOR_LAVENDER;
  ctx.fillText('SWITCH', 64 + xanWidth + 4, 72);
  setLetterSpacing(ctx, '0px');
  drawDiamond(ctx, w - 72, 72, 16, COLOR_VIOLET_2, true);

  // --- Faixa do título ---
  const bannerY = 108;
  const bannerHeight = 76;
  const bannerGradient = ctx.createLinearGradient(56, 0, w - 56, 0);
  bannerGradient.addColorStop(0, COLOR_VIOLET);
  bannerGradient.addColorStop(1, COLOR_VIOLET_2);
  roundedRectPath(ctx, 56, bannerY, w - 112, bannerHeight, 18);
  ctx.fillStyle = bannerGradient;
  ctx.shadowColor = 'rgba(123, 77, 245, 0.55)';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  fitTextInBox(ctx, data.gameName.toUpperCase(), w / 2, bannerY + bannerHeight / 2, w - 160, 34, family);

  // --- Área central: a capa do jogo — SEMPRE quadrada (mesma largura e
  // altura), pra nenhuma logo de jogo ficar cortada como acontecia com a
  // caixa retangular antiga.
  const imageBoxX = 56;
  const imageBoxY = bannerY + bannerHeight + 20;
  const imageBoxW = w - 112;
  const imageBoxH = imageBoxW;
  roundedRectPath(ctx, imageBoxX, imageBoxY, imageBoxW, imageBoxH, 22);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = COLOR_BG_BOTTOM;
  ctx.fillRect(imageBoxX, imageBoxY, imageBoxW, imageBoxH);

  if (data.imageUrl) {
    try {
      const img = await loadImage(data.imageUrl);
      // "cover": preenche a caixa toda cortando o excesso, em vez de
      // espremer a imagem — mesmo comportamento do object-fit: cover no CSS.
      const scale = Math.max(imageBoxW / img.width, imageBoxH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = imageBoxX + (imageBoxW - drawW) / 2;
      const drawY = imageBoxY + (imageBoxH - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch {
      drawImageFallback(ctx, imageBoxX, imageBoxY, imageBoxW, imageBoxH, family);
    }
  } else {
    drawImageFallback(ctx, imageBoxX, imageBoxY, imageBoxW, imageBoxH, family);
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  // --- Rodapé esquerdo: "CARD DE COLEÇÃO" + gemas ---
  const footerY = imageBoxY + imageBoxH + 52;
  ctx.textAlign = 'left';
  ctx.font = font(17);
  setLetterSpacing(ctx, '4px');
  ctx.fillStyle = COLOR_LABEL;
  ctx.fillText('CARD DE', 64, footerY);
  ctx.fillText('COLEÇÃO', 64, footerY + 26);
  setLetterSpacing(ctx, '0px');

  const gemSize = 20;
  const gemGap = 16;
  const gemsStartX = 64 + gemSize / 2 + 4;
  const gemsY = footerY + 66;
  for (let i = 0; i < MAX_GEMS; i++) {
    const cx = gemsStartX + i * (gemSize + gemGap);
    if (i < data.points) {
      const gemGradient = ctx.createLinearGradient(cx - gemSize, gemsY - gemSize, cx + gemSize, gemsY + gemSize);
      gemGradient.addColorStop(0, COLOR_LAVENDER_LIGHT);
      gemGradient.addColorStop(1, COLOR_VIOLET_2);
      drawDiamond(ctx, cx, gemsY, gemSize, gemGradient, true);
    } else {
      drawDiamond(ctx, cx, gemsY, gemSize, 'rgba(185, 165, 255, 0.16)');
    }
  }

  // --- Rodapé direito: selo octogonal com os pontos ---
  const sealCx = w - 126;
  const sealCy = footerY + 30;
  const sealR = 66;
  const sealGradient = ctx.createLinearGradient(sealCx - sealR, sealCy - sealR, sealCx + sealR, sealCy + sealR);
  sealGradient.addColorStop(0, COLOR_SEAL_LIGHT);
  sealGradient.addColorStop(1, COLOR_SEAL_DARK);
  octagonPath(ctx, sealCx, sealCy, sealR);
  ctx.fillStyle = sealGradient;
  ctx.shadowColor = COLOR_GLOW;
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(56);
  ctx.fillText(String(data.points), sealCx, sealCy - 10);
  ctx.font = font(14);
  setLetterSpacing(ctx, '3px');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('PONTOS', sealCx + 1.5, sealCy + 30);
  setLetterSpacing(ctx, '0px');

  // --- Base do card: "XAN SWITCH" / "SÉRIE 01" ---
  const baseY = h - 50;
  ctx.font = font(17);
  setLetterSpacing(ctx, '4px');
  ctx.fillStyle = COLOR_LABEL;
  ctx.textAlign = 'left';
  ctx.fillText('XAN SWITCH', 64, baseY);
  ctx.textAlign = 'right';
  ctx.fillText('SÉRIE 01', w - 60, baseY);
  setLetterSpacing(ctx, '0px');
}

function drawImageFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  family: string
): void {
  ctx.fillStyle = COLOR_BG_MID;
  ctx.fillRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_LABEL;
  ctx.font = `800 26px ${family}`;
  setLetterSpacing(ctx, '6px');
  ctx.fillText('XAN SWITCH', x + w / 2 + 3, y + h / 2);
  setLetterSpacing(ctx, '0px');
}

// Escreve um texto centralizado, diminuindo o tamanho da fonte até caber na
// largura máxima — evita que nomes de jogo compridos "estourem" a faixa do
// título.
function fitTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  startSize: number,
  family: string
): void {
  let size = startSize;
  while (size > 16) {
    ctx.font = `800 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.fillText(text, cx, cy);
}

// Gera o PNG a partir do canvas já desenhado e dispara o download — um
// clique programático num link temporário, sem precisar de nenhum backend.
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar a imagem do card.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
