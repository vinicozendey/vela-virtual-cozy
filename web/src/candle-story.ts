import type { Candle } from './types';

// The preview and the exported file use the same canvas, with space for Stories UI.
export async function createCandleStory(candle: Candle, saint: string | undefined, site: string): Promise<Blob> {
  // Use the matching system fonts if the site's web fonts are unavailable.
  await Promise.allSettled([
    document.fonts.load('500 64px Fraunces'),
    document.fonts.load('400 32px "DM Sans"'),
    document.fonts.load('600 32px "DM Sans"'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem.');
  const ended = candle.status === 'ended';
  const colors = candle.theme === 'rose' ? ['#fff8f5', '#f1d8d0', '#d9a59c']
    : candle.theme === 'blue' ? ['#f6fbfc', '#dcebed', '#9ebdc8'] : ['#fffaf2', '#f3e6d2', '#d9be92'];
  const background = ctx.createLinearGradient(0, 0, 1080, 1920);
  background.addColorStop(0, colors[0]); background.addColorStop(1, colors[1]);
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = '#b8755233'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(55, 65, 970, 1790, [485, 485, 35, 35]); ctx.stroke();

  function text(value: string, y: number, font: string, color = '#3b342c') {
    ctx!.font = font; ctx!.textAlign = 'center'; ctx!.fillStyle = color;
    ctx!.fillText(value, 540, y);
  }
  function lines(value: string, font: string, width: number) {
    ctx!.font = font;
    const result: string[] = []; let line = '';
    // Wrap even a single unbroken title without cutting off its text.
    for (const word of value.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx!.measureText(candidate).width <= width) { line = candidate; continue; }
      if (line) result.push(line);
      line = '';
      for (const character of Array.from(word)) {
        if (ctx!.measureText(line + character).width > width && line) { result.push(line); line = ''; }
        line += character;
      }
    }
    if (line) result.push(line);
    return result;
  }

  text('✦', 260, '48px Georgia', '#b87552');
  text('Vela Virtual', 328, '500 48px Fraunces, Georgia, serif');
  text(ended ? 'VELA ENCERRADA' : 'UMA INTENÇÃO, MUITAS ORAÇÕES', 402, '600 23px "DM Sans", sans-serif', '#9d5b43');

  if (!ended) {
    const glow = ctx.createRadialGradient(540, 690, 10, 540, 690, 290);
    glow.addColorStop(0, '#f5c47866'); glow.addColorStop(1, '#f5c47800');
    ctx.fillStyle = glow; ctx.fillRect(240, 400, 600, 600);
    ctx.fillStyle = '#e7a34b'; ctx.beginPath(); ctx.moveTo(540, 535);
    ctx.bezierCurveTo(530, 595, 476, 628, 502, 685);
    ctx.bezierCurveTo(536, 735, 601, 685, 575, 633);
    ctx.bezierCurveTo(552, 594, 546, 566, 540, 535); ctx.fill();
    ctx.fillStyle = '#fff3ba'; ctx.beginPath(); ctx.ellipse(540, 672, 17, 31, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#655044'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(540, 744); ctx.lineTo(540, 711); ctx.stroke();
  ctx.fillStyle = '#75503d18'; ctx.beginPath(); ctx.ellipse(540, 1020, 160, 24, 0, 0, Math.PI * 2); ctx.fill();
  const wax = ctx.createLinearGradient(435, 0, 645, 0);
  wax.addColorStop(0, colors[2]); wax.addColorStop(.45, colors[0]); wax.addColorStop(1, colors[2]);
  ctx.fillStyle = wax; ctx.beginPath(); ctx.roundRect(440, 744, 200, 270, [12, 12, 24, 24]); ctx.fill();
  ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.ellipse(540, 744, 100, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = colors[1]; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(475, 752); ctx.lineTo(475, 822); ctx.stroke();

  let size = 66;
  let title = lines(candle.title, `500 ${size}px Fraunces, Georgia, serif`, 820);
  while (title.length > 3 && size > 36) { size -= 2; title = lines(candle.title, `500 ${size}px Fraunces, Georgia, serif`, 820); }
  const lineHeight = size * 1.2;
  const titleTop = 1160 - ((title.length - 1) * lineHeight) / 2;
  title.forEach((line, i) => text(line, titleTop + i * lineHeight, `500 ${size}px Fraunces, Georgia, serif`));
  if (saint) text(`Sob a intercessão de ${saint}`, 1340, '400 28px "DM Sans", sans-serif', '#9d5b43');
  ctx.strokeStyle = '#b8755266'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(475, 1410); ctx.lineTo(605, 1410); ctx.stroke();
  const invitation = ended ? ['Continue em oração', 'por esta intenção'] : ['Reze comigo', 'por esta intenção'];
  invitation.forEach((line, i) => text(line, 1490 + i * 54, '500 42px Fraunces, Georgia, serif', '#8d4939'));
  // Display the site only; the candle URL is offered separately for the link sticker.
  let siteSize = 25;
  ctx.font = `400 ${siteSize}px "DM Sans", sans-serif`;
  while (ctx.measureText(site).width > 800 && siteSize > 12) { siteSize--; ctx.font = `400 ${siteSize}px "DM Sans", sans-serif`; }
  text(site, 1650, `400 ${siteSize}px "DM Sans", sans-serif`, '#786759');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.')), 'image/png'));
}
