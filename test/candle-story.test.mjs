import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCandleStory } from '../web/src/candle-story.ts';

test('Stories preserve full titles and adapt the invitation and flame to the candle state', async () => {
  const original = globalThis.document;
  const texts = [];
  let flames = 0;
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    font: '',
    measureText(text) { return { width: Array.from(text).length * Number(this.font.match(/(\d+)px/)?.[1] || 30) * .6 }; },
    fillText(text, x, y) { texts.push({ text, x, y }); },
    bezierCurveTo() { flames++; },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const canvas = { getContext: () => context, toBlob(callback, type) { callback(new Blob(['image'], { type })); } };
  globalThis.document = { fonts: { load: async () => [] }, createElement: () => canvas };
  try {
    for (const title of ['Pela saúde da nossa família e de todos aqueles que precisam de cuidado e esperança', 'W'.repeat(80)]) {
      texts.length = 0;
      const image = await createCandleStory({ title, status: 'active', theme: 'rose', intention: 'Texto privado que não entra na imagem' }, 'Nossa Senhora', 'exemplo.com');
      assert.equal(image.type, 'image/png');
      assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1920);
      const titleLines = texts.filter(({ y }) => y > 1020 && y < 1300);
      assert.ok(titleLines.length <= 3);
      assert.equal(titleLines.map(({ text }) => text).join('').replaceAll(' ', ''), title.replaceAll(' ', ''));
      assert.ok(texts.some(({ text }) => text === 'Sob a intercessão de Nossa Senhora'));
      assert.ok(texts.some(({ text }) => text === 'Reze comigo'));
      assert.ok(!texts.some(({ text }) => text.includes('Texto privado')));
    }
    assert.ok(flames > 0);
    flames = 0; texts.length = 0;
    await createCandleStory({ title: 'Em memória', status: 'ended', theme: 'blue' }, undefined, 'exemplo.com');
    assert.equal(flames, 0, 'An ended candle has no flame');
    assert.ok(texts.some(({ text }) => text === 'VELA ENCERRADA'));
    assert.ok(texts.some(({ text }) => text === 'Continue em oração'));
    assert.ok(!texts.some(({ text }) => text.includes('intercessão')));
  } finally { globalThis.document = original; }
});
