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

// Cores do design system do site (ver :root em app/globals.css) — repetidas
// aqui porque um <canvas> não lê variáveis CSS, só valores concretos.
const COLOR_BG_DARK = '#0a0716';
const COLOR_PANEL = '#170f2e';
const COLOR_PURPLE = '#a463ff';
const COLOR_PURPLE_2 = '#7b2ff0';
const COLOR_GREEN = '#4ef05f';
const COLOR_GOLD = '#ffd24e';
const COLOR_GOLD_2 = '#f0a93f';
const COLOR_INK = '#f4f1fb';
const COLOR_INK_DIM = '#b7aed4';

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Losango decorativo (um quadrado girado 45°) — usado nos 4 cantos da
// moldura e como ícone de "gema" no rodapé.
function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, fill: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
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

// Garante que a fonte pixelada dos títulos já está pronta antes de escrever
// texto com ela — sem isso, o canvas às vezes desenha com a fonte de
// respaldo (fallback) na primeira vez que a página carrega.
async function ensureTitleFontLoaded(): Promise<void> {
  try {
    await document.fonts.load('700 32px "Press Start 2P"');
  } catch {
    // Sem problema — o canvas usa a fonte de respaldo (fallback) do
    // font-family, só fica menos "gamer" que o normal.
  }
}

export async function renderCollectibleCard(canvas: HTMLCanvasElement, data: CardData): Promise<void> {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não suporta desenhar o card.');

  await ensureTitleFontLoaded();
  const titleFont = '700 30px "Press Start 2P", cursive';
  const labelFont = '700 16px "Press Start 2P", cursive';
  const bodyFont = '700 15px Rajdhani, sans-serif';

  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;

  // --- Fundo do card ---
  const bgGradient = ctx.createLinearGradient(0, 0, w, h);
  bgGradient.addColorStop(0, COLOR_PANEL);
  bgGradient.addColorStop(1, COLOR_BG_DARK);
  roundedRectPath(ctx, 0, 0, w, h, 28);
  ctx.fillStyle = bgGradient;
  ctx.fill();

  // --- Moldura dupla: contorno metálico externo + traço fino luminoso interno ---
  const outerGradient = ctx.createLinearGradient(0, 0, w, h);
  outerGradient.addColorStop(0, COLOR_GOLD);
  outerGradient.addColorStop(0.5, '#e8c98a');
  outerGradient.addColorStop(1, COLOR_GOLD_2);
  roundedRectPath(ctx, 10, 10, w - 20, h - 20, 24);
  ctx.lineWidth = 6;
  ctx.strokeStyle = outerGradient;
  ctx.stroke();

  roundedRectPath(ctx, 24, 24, w - 48, h - 48, 18);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(164, 99, 255, 0.6)';
  ctx.shadowColor = COLOR_PURPLE;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- Losangos decorativos nos 4 cantos ---
  const cornerInset = 40;
  drawDiamond(ctx, cornerInset, cornerInset, 14, COLOR_GOLD);
  drawDiamond(ctx, w - cornerInset, cornerInset, 14, COLOR_GOLD);
  drawDiamond(ctx, cornerInset, h - cornerInset, 14, COLOR_GOLD);
  drawDiamond(ctx, w - cornerInset, h - cornerInset, 14, COLOR_GOLD);

  // --- Topo: logo XAN SWITCH + gema decorativa ---
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = labelFont;
  ctx.fillStyle = COLOR_INK;
  ctx.fillText('XAN', 70, 78);
  const xanWidth = ctx.measureText('XAN').width;
  ctx.fillStyle = COLOR_GREEN;
  ctx.fillText('SWITCH', 70 + xanWidth + 8, 78);
  drawDiamond(ctx, w - 75, 78, 16, COLOR_PURPLE);

  // --- Faixa/selo do título ---
  const bannerY = 112;
  const bannerHeight = 56;
  const bannerGradient = ctx.createLinearGradient(60, 0, w - 60, 0);
  bannerGradient.addColorStop(0, COLOR_PURPLE_2);
  bannerGradient.addColorStop(1, COLOR_PURPLE);
  roundedRectPath(ctx, 60, bannerY, w - 120, bannerHeight, 12);
  ctx.fillStyle = bannerGradient;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLOR_GOLD;
  ctx.stroke();

  ctx.font = titleFont;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  fitTextInBox(ctx, data.gameName.toUpperCase(), w / 2, bannerY + bannerHeight / 2, w - 160, 26);

  // --- Área central: a capa do jogo — SEMPRE quadrada (mesma largura e
  // altura), pra nenhuma logo de jogo ficar cortada como acontecia com a
  // caixa retangular antiga.
  const imageBoxX = 70;
  const imageBoxY = bannerY + bannerHeight + 28;
  const imageBoxW = w - 140;
  const imageBoxH = imageBoxW;
  roundedRectPath(ctx, imageBoxX, imageBoxY, imageBoxW, imageBoxH, 16);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = COLOR_BG_DARK;
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
      drawImageFallback(ctx, imageBoxX, imageBoxY, imageBoxW, imageBoxH);
    }
  } else {
    drawImageFallback(ctx, imageBoxX, imageBoxY, imageBoxW, imageBoxH);
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.stroke();

  // --- Rodapé esquerdo: "CARD DE COLEÇÃO" + gemas ---
  const footerY = imageBoxY + imageBoxH + 50;
  ctx.textAlign = 'left';
  ctx.font = '700 13px "Press Start 2P", cursive';
  ctx.fillStyle = COLOR_INK_DIM;
  ctx.fillText('CARD DE', 70, footerY);
  ctx.fillText('COLEÇÃO', 70, footerY + 22);

  const gemSize = 20;
  const gemGap = 14;
  const gemsStartX = 70 + gemSize / 2;
  const gemsY = footerY + 54;
  for (let i = 0; i < MAX_GEMS; i++) {
    const filled = i < data.points;
    drawDiamond(ctx, gemsStartX + i * (gemSize + gemGap), gemsY, gemSize, filled ? COLOR_GOLD : 'rgba(255,255,255,0.12)');
  }

  // --- Rodapé direito: selo octogonal com os pontos ---
  const sealCx = w - 130;
  const sealCy = footerY + 20;
  const sealR = 62;
  const sealGradient = ctx.createRadialGradient(sealCx, sealCy, 4, sealCx, sealCy, sealR);
  sealGradient.addColorStop(0, COLOR_GOLD);
  sealGradient.addColorStop(1, COLOR_GOLD_2);
  octagonPath(ctx, sealCx, sealCy, sealR);
  ctx.fillStyle = sealGradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLOR_BG_DARK;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b1a00';
  ctx.font = '700 40px "Press Start 2P", cursive';
  ctx.fillText(String(data.points), sealCx, sealCy - 8);
  ctx.font = '700 12px "Press Start 2P", cursive';
  ctx.fillText('PONTOS', sealCx, sealCy + 26);

  // --- Base do card: "XAN SWITCH" / "SÉRIE 01" ---
  const baseY = h - 46;
  ctx.textAlign = 'left';
  ctx.font = bodyFont;
  ctx.fillStyle = COLOR_INK_DIM;
  ctx.fillText('XAN SWITCH', 70, baseY);
  ctx.textAlign = 'right';
  ctx.fillText('SÉRIE 01', w - 70, baseY);
}

function drawImageFallback(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLOR_PANEL;
  ctx.fillRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_INK_DIM;
  ctx.font = '700 16px "Press Start 2P", cursive';
  ctx.fillText('XAN', x + w / 2, y + h / 2 - 12);
  ctx.fillText('SWITCH', x + w / 2, y + h / 2 + 16);
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
  startSize: number
): void {
  let size = startSize;
  while (size > 12) {
    ctx.font = `700 ${size}px "Press Start 2P", cursive`;
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
