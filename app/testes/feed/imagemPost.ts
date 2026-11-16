// A imagem que aparece em cada post do feed, deduzida do próprio post (não
// precisa guardar nada a mais no banco):
//  - Silhueta do Dia: o personagem daquele dia/nível (o sorteio é o mesmo
//    pra todo mundo, então dá pra refazer a partir do "#N" e do nível). A
//    tela só mostra a imagem colorida pra quem já jogou — ver FeedClient.tsx;
//  - Qual Link é você?: a arte do card do Link que saiu;
//  - Próximo jogo: a capa do jogo indicado (procurada no catálogo pelo nome).
// Só roda no servidor (jogosActions.ts).
import personagensJson from '@/data/jogos/personagens.json';
import { addDias } from '@/lib/jogos/dia';
import { normalizar } from '@/lib/jogos/respostas';
import { INICIO, NIVEIS, imagemUrl, personagemDoDia, personagensDoJson, type NivelId } from '../silhueta/silhueta';
import { LINKS } from '../../qual-link/quizData';
import { LINK_ORDER, cardImage } from '../../qual-link/links';

export type ImagemPost =
  | { tipo: 'silhueta'; silhueta: string; cor: string; nome: string; dia: string; nivel: string }
  | { tipo: 'foto'; url: string; alt: string; formato: 'card' | 'capa' }
  | null;

const personagens = personagensDoJson(personagensJson as Record<string, unknown>[]);

export function imagemDoPost(
  p: { game: string; mode: string; title: string; result_text: string },
  capas: Map<string, string>
): ImagemPost {
  if (p.game === 'silhueta') {
    const n = Number(/#(\d+)/.exec(p.title)?.[1]);
    const nivel = NIVEIS.find((x) => x.id === p.mode)?.id as NivelId | undefined;
    if (!n || !nivel) return null; // treino: não dá pra saber o personagem
    const dia = addDias(INICIO, n - 1);
    const quem = personagemDoDia(personagens, nivel, dia);
    if (!quem) return null;
    return { tipo: 'silhueta', silhueta: imagemUrl(quem, 'silhueta'), cor: imagemUrl(quem, 'cor'), nome: quem.nome, dia, nivel };
  }
  if (p.game === 'qual-link') {
    const id = LINK_ORDER.find((l) => p.result_text.includes(LINKS[l].nome));
    return id ? { tipo: 'foto', url: cardImage(id), alt: LINKS[id].nome, formato: 'card' } : null;
  }
  if (p.game === 'proximo-jogo') {
    const nome = p.result_text.split('\n')[0].replace(/^🎲\s*/, '').trim();
    const url = capas.get(normalizar(nome));
    return url ? { tipo: 'foto', url, alt: nome, formato: 'capa' } : null;
  }
  return null;
}
