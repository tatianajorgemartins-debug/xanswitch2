'use client';

// Card colecionável — a versão que aparece NA TELA (HTML/CSS, com a
// animação de revelação). É um redesenho independente do que
// lib/cardCanvas.ts desenha num <canvas> pra gerar o PNG de download: os
// dois seguem o mesmo conceito visual (moldura dupla, faixa do título,
// gemas, selo de pontos), mas cada um é implementado do seu próprio jeito —
// CSS é bem mais fácil pra animar e estilizar na tela; Canvas é o que dá
// pra exportar como arquivo de imagem de verdade.
//
// A animação de revelação roda sozinha assim que o card aparece na tela
// (ver a keyframe "card-reveal" em globals.css) — não precisa de nenhum
// estado ou clique pra disparar.

import { useRef, useState } from 'react';
import { renderCollectibleCard, downloadCanvasAsPng } from '@/lib/cardCanvas';

const MAX_GEMS = 5;

export function CollectibleCard({
  gameName,
  imageUrl,
  points,
  compact,
  pending
}: {
  gameName: string;
  imageUrl: string | null;
  points: number;
  // Versão menor e sem a animação de revelação — usada na lista de "Minha
  // coleção" (AccountModal.tsx), onde vários cards aparecem juntos e a
  // revelação, que faz sentido na hora da compra, ficaria repetitiva.
  compact?: boolean;
  // Mostra uma fitinha "Pendente" por cima do card — pros pontos que ainda
  // não foram confirmados por você no admin (ver "Minha coleção").
  pending?: boolean;
}) {
  return (
    <div className={`collectible-card${compact ? ' is-compact' : ''}`}>
      {/* Fica FORA do frame de propósito: o frame usa overflow:hidden (pra
          cortar a imagem do jogo certinho nas bordas arredondadas), o que
          cortaria essa fitinha também se ela estivesse lá dentro. */}
      {pending && <span className="collectible-card-pending-ribbon">⏳ Pendente</span>}
      <div className="collectible-card-frame">
        <span className="collectible-card-corner tl" aria-hidden="true" />
        <span className="collectible-card-corner tr" aria-hidden="true" />
        <span className="collectible-card-corner bl" aria-hidden="true" />
        <span className="collectible-card-corner br" aria-hidden="true" />

        <div className="collectible-card-top">
          <span className="collectible-card-logo">
            XAN<span>SWITCH</span>
          </span>
          <span className="collectible-card-top-gem" aria-hidden="true" />
        </div>

        <div className="collectible-card-banner">
          <span>{gameName}</span>
        </div>

        <div className="collectible-card-image">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={gameName} />
          ) : (
            <span className="collectible-card-image-fallback">XAN SWITCH</span>
          )}
        </div>

        <div className="collectible-card-footer">
          <div className="collectible-card-footer-left">
            <p>
              CARD DE
              <br />
              COLEÇÃO
            </p>
            <div className="collectible-card-gems">
              {Array.from({ length: MAX_GEMS }).map((_, i) => (
                <span key={i} className={`collectible-gem${i < points ? ' is-filled' : ''}`} />
              ))}
            </div>
          </div>
          <div className="collectible-card-seal">
            <span className="collectible-card-seal-number">{points}</span>
            <span className="collectible-card-seal-label">PONTOS</span>
          </div>
        </div>

        <div className="collectible-card-base">
          <span>XAN SWITCH</span>
          <span>SÉRIE 01</span>
        </div>

        <span className="collectible-card-flash" aria-hidden="true" />
      </div>
    </div>
  );
}

// Botão "Salvar card (PNG)" — carrega junto um <canvas> escondido, só usado
// na hora do clique pra desenhar o card (ver lib/cardCanvas.ts) e baixar
// como arquivo de imagem. Fica num componente à parte porque tanto a compra
// de um jogo só (PurchaseModal.tsx) quanto a compra em lote
// (BulkPurchaseModal.tsx, um botão por card) precisam do mesmo botão.
export function DownloadCardButton({
  gameName,
  imageUrl,
  points
}: {
  gameName: string;
  imageUrl: string | null;
  points: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');

  async function handleDownload() {
    if (!canvasRef.current) return;
    setStatus('working');
    try {
      await renderCollectibleCard(canvasRef.current, { gameName, imageUrl, points });
      // Nome de arquivo só com letras minúsculas, números e hífen — evita
      // qualquer caractere que o sistema operacional do cliente não aceite
      // em nome de arquivo (acentos, barra, dois-pontos etc.).
      const safeName = gameName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await downloadCanvasAsPng(canvasRef.current, `card-xan-switch-${safeName || 'jogo'}.png`);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      {/* Nunca aparece na tela — existe só pra desenhar o card na hora do
          download, com a mesma técnica de <canvas> escondido usada em
          qualquer geração de imagem client-side. */}
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
      <button type="button" className="btn credit" onClick={handleDownload} disabled={status === 'working'}>
        {status === 'working' ? 'Gerando imagem...' : '⬇️ Salvar card (PNG)'}
      </button>
      {status === 'error' && (
        <p style={{ color: '#ff8a8a', fontSize: 12.5, fontWeight: 600, textAlign: 'center', margin: '8px 0 0' }}>
          Não foi possível gerar a imagem agora. Tenta de novo.
        </p>
      )}
    </>
  );
}
