// Imagem 9:16 (1080×1920) do resultado do "Qual Link é você?", pra postar
// nos stories. Desenhada num <canvas> no próprio navegador, com o mesmo
// visual do site: fundo roxo-escuro, card do Link (o "palco" do
// resultado), Archivo no texto, Cinzel no nome e o dourado do site no
// arquétipo. O texto importante fica fora das faixas de cima e de baixo
// que o Instagram cobre com a própria interface.
import { siteFontFamily } from '@/lib/cardCanvas';
import { LINKS, linkImage, type LinkId } from './quizData.ts';
import { cinzel, cormorant } from './fonts.ts';

const W = 1080;
const H = 1920;
const PAD = 90;

const COLORS = {
  bg: '#0a0716',
  surface: '#140d27',
  surface2: '#1c1338',
  ink: '#f4f1fb',
  muted: '#b7aed4',
  accentFill: '#7b2ff0',
  gold: '#ffd24e',
  goldInk: '#2b1a00'
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Pílula com texto centralizado em (cx, cy); devolve a largura.
function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  opts: { font: string; fill: string; color: string; padX: number; height: number }
): number {
  ctx.font = opts.font;
  const w = ctx.measureText(text).width + opts.padX * 2;
  roundRect(ctx, cx - w / 2, cy - opts.height / 2, w, opts.height, opts.height / 2);
  ctx.fillStyle = opts.fill;
  ctx.fill();
  ctx.fillStyle = opts.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 2);
  ctx.textBaseline = 'alphabetic';
  return w;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

export async function renderStoryImage(resultId: LinkId): Promise<Blob> {
  const link = LINKS[resultId];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não consegue gerar a imagem.');

  const sans = siteFontFamily();
  const display = cinzel.style.fontFamily;
  const serif = cormorant.style.fontFamily;
  await Promise.all([
    document.fonts.load(`800 40px ${sans}`),
    document.fonts.load(`600 40px ${sans}`),
    document.fonts.load(`900 90px ${display}`),
    document.fonts.load(`italic 600 48px ${serif}`)
  ]).catch(() => {});

  // Fundo: roxo do site, luz roxa em cima e o verde de Hyrule embaixo.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createRadialGradient(W / 2, -120, 40, W / 2, -120, 1100);
  top.addColorStop(0, 'rgba(123,47,240,.55)');
  top.addColorStop(1, 'rgba(123,47,240,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);
  const bottom = ctx.createRadialGradient(W / 2, H + 100, 40, W / 2, H + 100, 900);
  bottom.addColorStop(0, 'rgba(78,240,95,.16)');
  bottom.addColorStop(1, 'rgba(78,240,95,0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, W, H);

  const [logo, art] = await Promise.all([loadImage('/logo.png').catch(() => null), loadImage(linkImage(resultId))]);

  // Cabeçalho: logo + selo do quiz.
  if (logo) {
    const lw = 230;
    ctx.drawImage(logo, (W - lw) / 2, 150, lw, (logo.height / logo.width) * lw);
  }
  setLetterSpacing(ctx, '4px');
  ctx.font = `800 28px ${sans}`;
  ctx.fillStyle = COLORS.gold;
  ctx.textAlign = 'center';
  ctx.fillText('◆  QUIZ ZELDA · QUAL LINK É VOCÊ?', W / 2, 330);
  setLetterSpacing(ctx, '0px');

  // Mede o texto primeiro: o palco do Link fica com o espaço que sobrar,
  // pra nada encostar na chamada final (nomes longos, traços em 2 linhas).
  const name = link.nome.startsWith('O ') ? link.nome.slice(2) : link.nome;
  let nameSize = 96;
  ctx.font = `900 ${nameSize}px ${display}`;
  let nameLines = wrap(ctx, name, W - PAD * 2);
  if (nameLines.length > 2) {
    nameSize = 76;
    ctx.font = `900 ${nameSize}px ${display}`;
    nameLines = wrap(ctx, name, W - PAD * 2);
  }
  const chipFont = `600 30px ${sans}`;
  const chipH = 58;
  const gap = 12;
  ctx.font = chipFont;
  const widths = link.tracos.map((t) => ctx.measureText(t).width + 48);
  const rows: { items: number[]; width: number }[] = [];
  widths.forEach((w, i) => {
    const last = rows[rows.length - 1];
    if (last && last.width + gap + w <= W - PAD * 2) {
      last.items.push(i);
      last.width += gap + w;
    } else {
      rows.push({ items: [i], width: w });
    }
  });
  const quoteFont = `italic 600 48px ${serif}`;
  ctx.font = quoteFont;
  const quoteLines = wrap(ctx, link.frase, W - PAD * 2 - 40).slice(0, 3);

  const ctaY = H - 300;
  const textHeight =
    86 + nameSize + 6 + (nameLines.length - 1) * nameSize * 1.04 + 30 + 96 + rows.length * (chipH + gap) + 46 + quoteLines.length * 58;
  const textBottomLimit = ctaY - 42 - 110;

  // "Palco" do Link: card arredondado com o Link inteiro.
  const stageX = PAD;
  const stageY = 380;
  const stageW = W - PAD * 2;
  const stageH = Math.max(340, Math.min(720, textBottomLimit - stageY - textHeight));
  ctx.save();
  roundRect(ctx, stageX, stageY, stageW, stageH, 56);
  ctx.clip();
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(stageX, stageY, stageW, stageH);
  const stageTop = ctx.createRadialGradient(W / 2, stageY, 20, W / 2, stageY, 620);
  stageTop.addColorStop(0, 'rgba(123,47,240,.6)');
  stageTop.addColorStop(1, 'rgba(123,47,240,0)');
  ctx.fillStyle = stageTop;
  ctx.fillRect(stageX, stageY, stageW, stageH);
  const stageFloor = ctx.createRadialGradient(W / 2, stageY + stageH, 20, W / 2, stageY + stageH, 460);
  stageFloor.addColorStop(0, 'rgba(78,240,95,.22)');
  stageFloor.addColorStop(1, 'rgba(78,240,95,0)');
  ctx.fillStyle = stageFloor;
  ctx.fillRect(stageX, stageY, stageW, stageH);
  // Sombra oval no chão.
  const floorY = stageY + stageH - 60;
  ctx.save();
  ctx.translate(W / 2, floorY);
  ctx.scale(1, 0.14);
  const shadow = ctx.createRadialGradient(0, 0, 10, 0, 0, 260);
  shadow.addColorStop(0, 'rgba(0,0,0,.6)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(-300, -300, 600, 600);
  ctx.restore();
  const scale = Math.min((stageW - 160) / art.width, (stageH - 120) / art.height);
  const aw = art.width * scale;
  const ah = art.height * scale;
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;
  ctx.drawImage(art, (W - aw) / 2, floorY + 12 - ah, aw, ah);
  ctx.restore();

  // Nome, arquétipo, traços.
  let y = stageY + stageH + 86;
  ctx.textAlign = 'center';
  ctx.font = `600 38px ${sans}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('Meu Link é', W / 2, y);

  y += nameSize + 6;
  ctx.font = `900 ${nameSize}px ${display}`;
  ctx.fillStyle = COLORS.ink;
  for (const line of nameLines) {
    ctx.fillText(line, W / 2, y);
    y += nameSize * 1.04;
  }

  y += 30;
  pill(ctx, link.arquetipo, W / 2, y, {
    font: `800 38px ${sans}`,
    fill: COLORS.gold,
    color: COLORS.goldInk,
    padX: 34,
    height: 76
  });

  // Traços em pílulas (uma ou duas linhas, centralizadas).
  y += 96;
  for (const row of rows) {
    let x = (W - row.width) / 2;
    for (const i of row.items) {
      pill(ctx, link.tracos[i], x + widths[i] / 2, y, { font: chipFont, fill: COLORS.surface2, color: COLORS.ink, padX: 24, height: chipH });
      x += widths[i] + gap;
    }
    y += chipH + gap;
  }

  // Frase da jornada.
  y += 46;
  ctx.font = quoteFont;
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'center';
  for (const line of quoteLines) {
    ctx.fillText(line, W / 2, y);
    y += 58;
  }

  // Chamada final, acima da faixa de baixo que o Instagram cobre.
  pill(ctx, 'Descubra o seu em xanswitch.com.br/qual-link', W / 2, ctaY, {
    font: `700 32px ${sans}`,
    fill: COLORS.accentFill,
    color: '#ffffff',
    padX: 40,
    height: 84
  });
  ctx.font = `600 30px ${sans}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('@xan.switch', W / 2, ctaY + 90);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png')
  );
}

