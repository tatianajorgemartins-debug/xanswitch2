// Do lado do navegador: registra cada partida terminada (pro admin) e guarda
// os resultados que a pessoa pode publicar no feed (/testes/feed).
import { getAccessToken } from '@/lib/wishlist';
import { registrarJogadaAction, type Jogada } from '@/app/testes/jogosActions';
import { ler, gravar } from './armazenamento';

// Código aleatório do aparelho, pra separar quem joga sem conta.
export function visitante(): string {
  let id = ler<string | null>('visitante', null);
  if (!id || !/^[a-z0-9-]{8,40}$/.test(id)) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    gravar('visitante', id);
  }
  return id;
}

// Manda a partida pro servidor sem esperar (se falhar, o jogo nem percebe).
export function registrarJogada(j: Jogada): void {
  getAccessToken()
    .catch(() => null)
    .then((token) => registrarJogadaAction(token, visitante(), j))
    .catch(() => {});
}

// ---------- Resultados publicáveis ----------

export type Publicavel = {
  // único por resultado (ex: "silhueta:dificil:2026-11-16")
  id: string;
  jogo: string;
  modo: string;
  titulo: string;
  // o placar, com emojis (o mesmo do compartilhar, sem a última linha)
  resultado: string;
  criadoEm: string;
  publicado?: boolean;
};

const CHAVE = 'publicaveis';
const MAX = 20;

export function guardarPublicavel(p: Omit<Publicavel, 'criadoEm'>): void {
  const lista = lerPublicaveis().filter((x) => x.id !== p.id);
  gravar(CHAVE, [{ ...p, criadoEm: new Date().toISOString() }, ...lista].slice(0, MAX));
}

export function lerPublicaveis(): Publicavel[] {
  const l = ler<Publicavel[]>(CHAVE, []);
  return Array.isArray(l) ? l.filter((x) => x && typeof x.id === 'string') : [];
}

export function marcarPublicado(id: string): void {
  gravar(
    CHAVE,
    lerPublicaveis().map((x) => (x.id === id ? { ...x, publicado: true } : x))
  );
}
