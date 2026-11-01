// Imagem 9:16 (1080×1920) do resultado do "Qual Link é você?", pra postar
// nos stories. Desenhada num <canvas> no próprio navegador, no visual do
// quiz (verde de Hyrule, moldura dourada dupla, Cinzel/Cormorant). O Link é
// o herói da imagem: ocupa tudo o que o texto não usa, com "LINK" gigante
// vazado atrás e luz dourada embaixo. O texto importante fica fora das
// faixas de cima e de baixo que o Instagram cobre com a própria interface.
import { LINKS, linkImage, type LinkId } from './quizData.ts';
import { cinzel, cinzelDecorative, cormorant } from './fonts.ts';

const W = 1080;
const H = 1920;
const PAD = 100;

const GOLD = '#f2cd73';
const GOLD_SOFT = '#e9c977';
const CREAM = '#fff6e0';
const MUTED = '#cbbf9f';

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

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}

// Selo: ◆ TEXTO ◆ com linhas finas douradas dos lados.
function seal(ctx: CanvasRenderingContext2D, text: string, y: number, font: string) {
  ctx.font = font;
  setLetterSpacing(ctx, '6px');
  ctx.fillStyle = GOLD_SOFT;
  ctx.textAlign = 'center';
  const label = `◆  ${text}  ◆`;
  ctx.fillText(label, W / 2, y);
  const half = ctx.measureText(label).width / 2;
  setLetterSpacing(ctx, '0px');
  for (const dir of [-1, 1]) {
    const from = W / 2 + dir * (half + 20);
    const to = W / 2 + dir * (half + 120);
    const grad = ctx.createLinearGradient(from, 0, to, 0);
    grad.addColorStop(0, 'rgba(233,201,119,.7)');
    grad.addColorStop(1, 'rgba(233,201,119,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(from, to), y - 11, 100, 2);
  }
}

export async function renderStoryImage(resultId: LinkId): Promise<Blob> {
  const link = LINKS[resultId];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não consegue gerar a imagem.');

  const display = cinzel.style.fontFamily;
  const deco = cinzelDecorative.style.fontFamily;
  const serif = cormorant.style.fontFamily;
  await Promise.all([
    document.fonts.load(`900 90px ${display}`),
    document.fonts.load(`700 30px ${display}`),
    document.fonts.load(`700 200px ${deco}`),
    document.fonts.load(`italic 600 48px ${serif}`)
  ]).catch(() => {});

  // Fundo: verde quase preto, com luz verde em cima e vinheta nas bordas.
  ctx.fillStyle = '#07110c';
  ctx.fillRect(0, 0, W, H);
  const topGlow = ctx.createRadialGradient(W / 2, 200, 40, W / 2, 200, 1100);
  topGlow.addColorStop(0, 'rgba(36,82,52,.85)');
  topGlow.addColorStop(1, 'rgba(36,82,52,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, H);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Moldura dupla dourada, com losangos no meio de cima e de baixo.
  ctx.strokeStyle = 'rgba(214,177,94,.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = 'rgba(214,177,94,.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  ctx.fillStyle = '#07110c';
  ctx.fillRect(W / 2 - 26, 30, 52, 22);
  ctx.fillRect(W / 2 - 26, H - 52, 52, 22);
  ctx.font = `700 26px ${display}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD_SOFT;
  ctx.fillText('◆', W / 2, 51);
  ctx.fillText('◆', W / 2, H - 31);

  const [logo, art] = await Promise.all([
    loadImage('/quiz-zelda/logo-xan.webp').catch(() => null),
    loadImage(linkImage(resultId))
  ]);

  // Cabeçalho (dentro da faixa de cima: só marca, nada essencial).
  if (logo) {
    const lw = 190;
    ctx.drawImage(logo, (W - lw) / 2, 120, lw, (logo.height / logo.width) * lw);
  }
  seal(ctx, 'QUAL LINK É VOCÊ?', 300, `700 30px ${display}`);

  // Mede o texto de baixo primeiro: o Link fica com todo o resto.
  const name = link.nome.startsWith('O ') ? link.nome.slice(2) : link.nome;
  let nameSize = 92;
  ctx.font = `900 ${nameSize}px ${display}`;
  let nameLines = wrap(ctx, name.toUpperCase(), W - PAD * 2);
  if (nameLines.length > 2) {
    nameSize = 74;
    ctx.font = `900 ${nameSize}px ${display}`;
    nameLines = wrap(ctx, name.toUpperCase(), W - PAD * 2);
  }
  const quoteFont = `italic 600 46px ${serif}`;
  ctx.font = quoteFont;
  const quoteLines = wrap(ctx, link.frase, W - PAD * 2 - 20).slice(0, 2);

  const ctaY = H - 330;
  // Mesmas medidas usadas pra escrever o texto mais abaixo.
  const textHeight = nameSize + (nameLines.length - 1) * nameSize * 1.05 + quoteLines.length * 56 + 206;
  const textTop = ctaY - 70 - textHeight;

  // Palco: "LINK" gigante vazado atrás, luz dourada e sombra no chão.
  const heroTop = 350;
  const floorY = textTop - 40;
  const heroCenter = (heroTop + floorY) / 2;
  ctx.save();
  let bigSize = Math.round(Math.min(360, (floorY - heroTop) * 0.55));
  ctx.font = `700 ${bigSize}px ${deco}`;
  const bigWidth = ctx.measureText('LINK').width;
  // A perna do K passa um pouco da medida — por isso a folga maior.
  if (bigWidth > W - 340) {
    bigSize = Math.floor((bigSize * (W - 340)) / bigWidth);
    ctx.font = `700 ${bigSize}px ${deco}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(242,205,115,.16)';
  ctx.strokeText('LINK', W / 2, heroCenter);
  ctx.restore();

  const glow = ctx.createRadialGradient(W / 2, floorY - 120, 20, W / 2, floorY - 120, 560);
  glow.addColorStop(0, 'rgba(242,205,115,.42)');
  glow.addColorStop(0.5, 'rgba(242,205,115,.12)');
  glow.addColorStop(1, 'rgba(242,205,115,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, floorY);
  ctx.scale(1, 0.13);
  const shadow = ctx.createRadialGradient(0, 0, 10, 0, 0, 340);
  shadow.addColorStop(0, 'rgba(0,0,0,.75)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(-400, -400, 800, 800);
  ctx.restore();

  const maxW = W - 120;
  const maxH = floorY - heroTop - 10;
  const scale = Math.min(maxW / art.width, maxH / art.height);
  const aw = art.width * scale;
  const ah = art.height * scale;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.drawImage(art, (W - aw) / 2, floorY + 14 - ah, aw, ah);
  ctx.restore();

  // Texto: "Meu Link é", nome, arquétipo e frase.
  let y = textTop + 40;
  ctx.textAlign = 'center';
  ctx.font = `italic 600 44px ${serif}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('Meu Link é', W / 2, y);

  y += 16 + nameSize;
  ctx.font = `900 ${nameSize}px ${display}`;
  for (const line of nameLines) {
    ctx.fillStyle = '#000';
    ctx.fillText(line, W / 2, y + 6);
    ctx.fillStyle = CREAM;
    ctx.fillText(line, W / 2, y);
    y += nameSize * 1.05;
  }

  // Arquétipo em pílula dourada, logo abaixo da última linha do nome.
  y += 50 - nameSize * 1.05;
  ctx.font = `900 34px ${display}`;
  setLetterSpacing(ctx, '2px');
  const label = link.arquetipo.toUpperCase();
  const pw = Math.min(W - PAD * 2, ctx.measureText(label).width + 70);
  const pillGrad = ctx.createLinearGradient(0, y, 0, y + 76);
  pillGrad.addColorStop(0, '#f6da8c');
  pillGrad.addColorStop(1, '#d6a94a');
  ctx.save();
  ctx.shadowColor = 'rgba(242,205,115,.45)';
  ctx.shadowBlur = 40;
  roundRect(ctx, (W - pw) / 2, y, pw, 76, 38);
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1b1405';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, y + 40);
  ctx.textBaseline = 'alphabetic';
  setLetterSpacing(ctx, '0px');
  y += 76 + 66;

  ctx.font = quoteFont;
  ctx.fillStyle = GOLD;
  for (const line of quoteLines) {
    ctx.fillText(line, W / 2, y);
    y += 56;
  }

  // Chamada final, acima da faixa de baixo que o Instagram cobre.
  ctx.font = `700 32px ${display}`;
  setLetterSpacing(ctx, '3px');
  const cta = 'XANSWITCH.COM.BR/QUAL-LINK';
  const cw = Math.min(W - 120, ctx.measureText(cta).width + 80);
  roundRect(ctx, (W - cw) / 2, ctaY - 40, cw, 80, 40);
  ctx.fillStyle = 'rgba(15,32,24,.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,177,94,.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.textBaseline = 'middle';
  ctx.fillText(cta, W / 2, ctaY + 2);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 28px ${display}`;
  ctx.fillStyle = CREAM;
  ctx.fillText('DESCUBRA O SEU  ·  @XAN.SWITCH', W / 2, ctaY + 92);
  setLetterSpacing(ctx, '0px');

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png')
  );
}

