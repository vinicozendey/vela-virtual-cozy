'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candle } from './types';
import { createCandleStory } from './candle-story';

export function ShareCandle({ candle, saint, onClose, onShared }: {
  candle: Candle; saint?: string; onClose: () => void; onShared?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<{ url: string; file: File; canShare: boolean } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const link = typeof location === 'undefined' ? '' : `${location.origin}/v/${encodeURIComponent(candle.id)}`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  useEffect(() => {
    let cancelled = false; let url = '';
    setImage(null); setError('');
    createCandleStory(candle, saint, location.host).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      const file = new File([blob], 'vela-virtual-story.png', { type: 'image/png' });
      setImage({ url, file, canShare: typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) });
    }).catch(() => { if (!cancelled) setError('Não foi possível gerar a imagem. Tente novamente.'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [candle, saint, attempt]);

  async function share() {
    if (!image || busy) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      // The PNG is ready before the click, preserving mobile user activation.
      await navigator.share({ files: [image.file] });
      onShared?.();
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) setError('Não foi possível compartilhar. Salve a imagem e publique pelo Instagram.');
    } finally { setBusy(false); }
  }

  async function copyLink() {
    setError(''); setNotice('');
    try { await navigator.clipboard.writeText(link); setNotice('Link copiado. Cole no adesivo de link do seu Story.'); onShared?.(); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o link abaixo.'); }
  }

  return <dialog ref={dialog} className="story-dialog" aria-labelledby="story-heading" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="story-dialog-inner">
      <button className="modal-close" onClick={onClose} aria-label="Fechar prévia">×</button>
      <div className="story-preview" aria-busy={!image && !error}>
        {image ? <img src={image.url} alt={`Arte para Stories: ${candle.title}. ${candle.status === 'ended' ? 'Vela encerrada. Continue em oração por esta intenção.' : 'Reze comigo por esta intenção.'}`} /> : <p role="status">{error ? 'A prévia não está disponível.' : 'Preparando sua imagem…'}</p>}
      </div>
      <div className="story-controls">
        <span className="eyebrow">Juntos em oração</span>
        <h2 id="story-heading">Convide alguém a <em>rezar com você</em></h2>
        <p>Sua vela em uma imagem pronta para os Stories.</p>
        <div className="story-actions">
          <button className="button button--primary" disabled={!image?.canShare || busy} onClick={share}>{busy ? 'Compartilhando…' : 'Compartilhar imagem'} <span aria-hidden>↗</span></button>
          {image ? <a className="button button--secondary" href={image.url} download="vela-virtual-story.png" onClick={() => { setNotice('Se a imagem abrir em outra tela, toque e segure para salvá-la.'); onShared?.(); }}>Salvar imagem</a> : <button className="button button--secondary" disabled>Salvar imagem</button>}
          <button className="button button--secondary" onClick={copyLink}>Copiar link da vela</button>
        </div>
        {image && !image.canShare && <p className="micro-copy">Neste navegador, salve a imagem e abra o Instagram para publicá-la nos Stories.</p>}
        <div className="story-instructions"><strong>Para convidar pelo Instagram</strong><p>Publique a imagem nos Stories. Depois, adicione o adesivo de link e cole o link da vela para que outras pessoas possam rezar com você.</p><span>Os aplicativos disponíveis para compartilhar dependem do seu aparelho.</span></div>
        <label className="story-link">Link da vela<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
        {notice && <p className="notice" role="status">{notice}</p>}
        {error && <div className="error-note" role="alert">{error}{!image && <button className="button button--ghost" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}</div>}
      </div>
    </div>
  </dialog>;
}
