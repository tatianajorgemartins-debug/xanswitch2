// Imagem 1080×1350 do resultado do "Qual Link é você?", pra baixar e postar
// no feed/stories. Desenhada num <canvas> no próprio navegador, com o mesmo
// visual do quiz (fundo verde, moldura dourada dupla, Cinzel/Cormorant).
import { LINKS, linkImage, type LinkId } from './quizData.ts';
import { cinzel, cormorant } from './fonts.ts';

const W = 1080;
const H = 1350;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = url;
  });
}

// Quebra o texto em linhas que caibam em maxWidth.
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

function seal(ctx: CanvasRenderingContext2D, text: string, y: number, font: string) {
  ctx.font = `700 30px ${font}`;
  ctx.fillStyle = '#E9C977';
  ctx.textAlign = 'center';
  const spaced = text.toUpperCase().split('').join('  ');
  ctx.fillText(`◆  ${spaced}  ◆`, W / 2, y);
  const half = ctx.measureText(`◆  ${spaced}  ◆`).width / 2;
  ctx.strokeStyle = 'rgba(233,201,119,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - half - 110, y - 10);
  ctx.lineTo(W / 2 - half - 20, y - 10);
  ctx.moveTo(W / 2 + half + 20, y - 10);
  ctx.lineTo(W / 2 + half + 110, y - 10);
  ctx.stroke();
}

export async function renderStoryImage(resultId: LinkId): Promise<Blob> {
  const link = LINKS[resultId];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não consegue gerar a imagem.');

  const title = cinzel.style.fontFamily;
  const body = cormorant.style.fontFamily;
  await Promise.all([
    document.fonts.load(`900 64px ${title}`),
    document.fonts.load(`700 30px ${title}`),
    document.fonts.load(`600 40px ${body}`)
  ]).catch(() => {});

  // Fundo verde com vinheta e brilho dourado atrás do Link.
  const bg = ctx.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.45, H * 0.8);
  bg.addColorStop(0, '#1d4129');
  bg.addColorStop(0.5, '#0c1b13');
  bg.addColorStop(1, '#07110C');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 700, 10, W / 2, 700, 380);
  glow.addColorStop(0, 'rgba(242,205,115,.28)');
  glow.addColorStop(1, 'rgba(242,205,115,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Moldura dupla dourada.
  ctx.strokeStyle = 'rgba(214,177,94,.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = 'rgba(214,177,94,.26)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(54, 54, W - 108, H - 108);

  const [logo, art] = await Promise.all([
    loadImage('/quiz-zelda/logo-xan.webp').catch(() => null),
    loadImage(linkImage(resultId))
  ]);
  if (logo) {
    const lw = 200;
    ctx.drawImage(logo, (W - lw) / 2, 100, lw, (logo.height / logo.width) * lw);
  }

  seal(ctx, 'Qual Link é você?', 230, title);

  // O Link, inteiro, no meio.
  const maxW = 560;
  const maxH = 480;
  const scale = Math.min(maxW / art.width, maxH / art.height);
  const aw = art.width * scale;
  const ah = art.height * scale;
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(art, (W - aw) / 2, 745 - ah, aw, ah);
  ctx.shadowColor = 'transparent';

  ctx.textAlign = 'center';
  ctx.fillStyle = '#CBBF9F';
  ctx.font = `600 40px ${body}`;
  ctx.fillText("Meu Link é", W / 2, 815);

  // Nome em Cinzel com sombra preta firme, quebrando em até 2 linhas.
  ctx.font = `900 72px ${title}`;
  let nameLines = wrap(ctx, link.nome.toUpperCase(), W - 200);
  if (nameLines.length > 2) {
    ctx.font = `900 56px ${title}`;
    nameLines = wrap(ctx, link.nome.toUpperCase(), W - 200);
  }
  const nameSize = parseInt(ctx.font.match(/(\d+)px/)?.[1] ?? '72', 10);
  let y = 895;
  for (const line of nameLines) {
    ctx.fillStyle = '#000';
    ctx.fillText(line, W / 2, y + 4);
    ctx.fillStyle = '#FFF6E0';
    ctx.fillText(line, W / 2, y);
    y += nameSize * 1.08;
  }

  ctx.font = `700 34px ${title}`;
  ctx.fillStyle = '#F2CD73';
  ctx.fillText(link.arquetipo.toUpperCase(), W / 2, y + 14);

  ctx.font = `italic 600 38px ${body}`;
  ctx.fillStyle = '#FFF6E0';
  let fy = y + 90;
  for (const line of wrap(ctx, link.frase, W - 260).slice(0, 3)) {
    ctx.fillText(line, W / 2, fy);
    fy += 46;
  }

  ctx.font = `700 28px ${title}`;
  ctx.fillStyle = '#E9C977';
  ctx.fillText('@XAN.SWITCH  ·  XANSWITCH.COM.BR', W / 2, H - 100);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png')
  );
}
