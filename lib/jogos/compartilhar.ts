// Botão "Compartilhar" dos jogos: no celular abre o menu de compartilhar do
// sistema (navigator.share); no computador copia o texto.

export type ComoCompartilhou = 'compartilhado' | 'copiado' | 'cancelado' | 'falhou';

export async function compartilharTexto(texto: string): Promise<ComoCompartilhou> {
  const toque = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (toque && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: texto });
      return 'compartilhado';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
      // segue pra cópia
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    return 'copiado';
  } catch {
    // navegador antigo ou sem permissão: cópia "à moda antiga"
    try {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok ? 'copiado' : 'falhou';
    } catch {
      return 'falhou';
    }
  }
}
