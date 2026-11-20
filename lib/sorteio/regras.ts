// Regras do sorteio ao vivo, sem banco e sem tela (dá pra testar sozinhas:
// tests/sorteio). Quem usa: app/sorteio (participante), app/admin/sorteios
// (painel) e lib/sorteio/sortear.ts (o sorteio em si).

// ---------- Situação do sorteio ----------

export type StatusSorteio = 'rascunho' | 'abertas' | 'encerradas' | 'sorteando' | 'finalizado';

export const ORDEM_STATUS: StatusSorteio[] = ['rascunho', 'abertas', 'encerradas', 'sorteando', 'finalizado'];

export const NOME_STATUS: Record<StatusSorteio, string> = {
  rascunho: 'Rascunho',
  abertas: 'Inscrições abertas',
  encerradas: 'Inscrições encerradas',
  sorteando: 'Sorteando',
  finalizado: 'Finalizado'
};

export const ehStatus = (v: unknown): v is StatusSorteio => typeof v === 'string' && (ORDEM_STATUS as string[]).includes(v);

// Só anda pra frente, um passo por vez.
export function proximoStatus(s: StatusSorteio): StatusSorteio | null {
  const i = ORDEM_STATUS.indexOf(s);
  return i >= 0 && i < ORDEM_STATUS.length - 1 ? ORDEM_STATUS[i + 1] : null;
}

// ---------- Confirmar presença ----------

export type ConfigAntifraude = {
  // participações por IP; null = sem limite
  limitePorIp: number | null;
  // o mesmo aparelho não confirma com duas contas
  bloquearDispositivo: boolean;
  // ISO; só contas criadas antes disso (null = qualquer conta)
  contasCriadasAntes: string | null;
};

// Pedidos de confirmação por minuto (contra robôs e cliques repetidos).
export const LIMITE_TENTATIVAS_IP = 12;
export const LIMITE_TENTATIVAS_CONTA = 6;

export type PedidoParticipacao = {
  status: StatusSorteio;
  aceitouRegulamento: boolean;
  instagram: string | null; // já normalizado (normalizarInstagram); null = inválido
  instagramDeOutraConta: boolean;
  jaParticipa: boolean;
  contaCriadaEm: string | null; // ISO
  participacoesNoIp: number; // de outras contas, neste sorteio
  dispositivoDeOutraConta: boolean;
  tentativasIp: number; // no último minuto, contando esta
  tentativasConta: number;
};

export type Avaliacao = { ok: true } | { ok: false; codigo: string; motivo: string };

export function avaliarParticipacao(config: ConfigAntifraude, p: PedidoParticipacao): Avaliacao {
  const nao = (codigo: string, motivo: string): Avaliacao => ({ ok: false, codigo, motivo });
  if (p.tentativasIp > LIMITE_TENTATIVAS_IP || p.tentativasConta > LIMITE_TENTATIVAS_CONTA) {
    return nao('muitas-tentativas', 'Muitas tentativas seguidas. Espere um minuto e tente de novo.');
  }
  if (p.status !== 'abertas') return nao('fechado', 'As inscrições deste sorteio não estão abertas.');
  if (p.jaParticipa) return nao('ja-participa', 'Você já está participando deste sorteio.');
  if (!p.instagram) return nao('instagram', 'Coloque o @ do seu Instagram pra participar.');
  if (p.instagramDeOutraConta) return nao('instagram-em-uso', 'Esse @ do Instagram já está participando com outra conta.');
  if (!p.aceitouRegulamento) return nao('regulamento', 'Marque que você aceita o regulamento pra confirmar.');
  if (config.contasCriadasAntes) {
    const limite = new Date(config.contasCriadasAntes).getTime();
    const criada = p.contaCriadaEm ? new Date(p.contaCriadaEm).getTime() : NaN;
    if (!Number.isFinite(criada) || criada >= limite) {
      return nao('conta-nova', 'Este sorteio é só para contas criadas antes do início da live.');
    }
  }
  if (config.bloquearDispositivo && p.dispositivoDeOutraConta) {
    return nao('dispositivo', 'Este aparelho já foi usado para participar com outra conta.');
  }
  if (config.limitePorIp !== null && p.participacoesNoIp >= config.limitePorIp) {
    return nao('limite-ip', 'O limite de participações desta conexão de internet já foi atingido.');
  }
  return { ok: true };
}

// "@Maria.Silva", "instagram.com/maria.silva/" → "maria.silva"; inválido → null.
// Regras do Instagram: até 30 letras, números, ponto e _; sem ponto no
// começo, no fim nem dois seguidos.
export function normalizarInstagram(bruto: string | null | undefined): string | null {
  let s = String(bruto ?? '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^(www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@+/, '');
  if (!/^[a-z0-9._]{1,30}$/.test(s) || s.startsWith('.') || s.endsWith('.') || s.includes('..')) return null;
  return s;
}

// "189.40.123.45" → "189.40.•••.•••" (IPv6: só o começo).
export function mascararIp(ip: string | null): string {
  if (!ip) return '—';
  const v4 = ip.split('.');
  if (v4.length === 4) return `${v4[0]}.${v4[1]}.•••.•••`;
  const v6 = ip.split(':').filter(Boolean);
  return v6.length > 2 ? `${v6[0]}:${v6[1]}:••••` : '•••';
}

// ---------- Como o participante aparece em público ----------

// "maria.silva@gmail.com" → "ma***@gmail.com"
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return '***';
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

// "Maria da Silva" → "Maria S."; sem nome, o começo do e-mail.
export function nomePublico(nome: string | null, email: string): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return mascararEmail(email).split('@')[0];
  const primeiro = partes[0].slice(0, 20);
  return partes.length > 1 ? `${primeiro} ${partes[partes.length - 1][0].toUpperCase()}.` : primeiro;
}

// IP de quem fez o pedido (a Vercel manda nesses cabeçalhos).
export function ipDaRequisicao(h: { get(nome: string): string | null }): string | null {
  const encaminhado = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return encaminhado || h.get('x-real-ip')?.trim() || null;
}

// ---------- Sorteio ----------

export type PremioBasico = { id: number; ganhadores: number; ordem: number };
export type SorteioBasico = { id: number; premioId: number; entradaId: number; vaga: number; anulado: boolean };
export type EntradaBasica = { id: number; desclassificado: boolean };

// O próximo prêmio com vaga livre (ou o escolhido) e o número da vaga.
export function proximaVaga<P extends PremioBasico>(premios: P[], sorteios: SorteioBasico[], premioId?: number): { premio: P; vaga: number } | null {
  const ordenados = [...premios].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  for (const premio of ordenados) {
    if (premioId !== undefined && premio.id !== premioId) continue;
    const ocupadas = new Set(sorteios.filter((s) => s.premioId === premio.id && !s.anulado).map((s) => s.vaga));
    for (let vaga = 1; vaga <= premio.ganhadores; vaga++) if (!ocupadas.has(vaga)) return { premio, vaga };
  }
  return null;
}

// Quem ainda pode ganhar: não desclassificado e sem nenhum sorteio neste
// sorteio (nem um anulado — quem foi re-sorteado não volta).
export function elegiveis<E extends EntradaBasica>(entradas: E[], sorteios: SorteioBasico[]): E[] {
  const jaSorteados = new Set(sorteios.map((s) => s.entradaId));
  return entradas.filter((e) => !e.desclassificado && !jaSorteados.has(e.id));
}

// Nomes que passam na roleta, terminando no ganhador. aleatorio(n) devolve
// um inteiro de 0 a n-1.
export const TAMANHO_ROLETA = 36;
export function montarRoleta(nomes: string[], ganhador: string, aleatorio: (n: number) => number, tamanho = TAMANHO_ROLETA): string[] {
  const outros = nomes.length ? nomes : [ganhador];
  const roleta: string[] = [];
  for (let i = 0; i < tamanho - 1; i++) roleta.push(outros[aleatorio(outros.length)]);
  roleta.push(ganhador);
  return roleta;
}

// ---------- Animação (a mesma conta em todas as telas) ----------

export const DURACAO_ANIMACAO_MS = 7000;
// O sorteio começa um pouco depois de disparado, pra dar tempo de todas as
// telas (que perguntam o estado a cada ~2 s) receberem antes de começar.
export const ESPERA_INICIO_MS = 2600;

// De 0 a 1: quanto da roleta já andou, desacelerando no fim.
export function progressoRoleta(agora: number, inicio: number, duracao: number): number {
  const t = Math.min(1, Math.max(0, (agora - inicio) / duracao));
  return 1 - Math.pow(1 - t, 4);
}
