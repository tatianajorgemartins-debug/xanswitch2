// O que as telas públicas recebem (página do participante e telão): sem
// e-mail completo, IP nem nada privado. Montado no servidor (lib/sorteioDb.ts
// e o painel) e lido no navegador (app/sorteio).
import { nomePublico, mascararEmail, type StatusSorteio } from './regras.ts';

export type PremioPublico = { id: number; nome: string; descricao: string; imagem: string | null; ganhadores: number; ordem: number };

export type SorteioPublico = {
  id: number;
  premioId: number;
  vaga: number;
  inicio: number; // ms (relógio do servidor)
  duracao: number;
  roleta: string[];
  ganhador: { codigo: string; nome: string; email: string };
  refeito: boolean;
};

export type EstadoPublico = {
  agora: number; // relógio do servidor, pra todas as telas andarem juntas
  sorteio: {
    slug: string;
    titulo: string;
    descricao: string;
    regulamento: string;
    banner: string | null;
    data: string | null;
    status: StatusSorteio;
    teste: boolean;
    mensagemGanhador: string;
  };
  premios: PremioPublico[];
  participantes: number;
  sorteios: SorteioPublico[]; // só os que valem (sem os anulados), do mais antigo pro mais novo
};

export function ganhadorPublico(e: { public_id: string; name: string | null; email: string }) {
  return { codigo: e.public_id, nome: nomePublico(e.name, e.email), email: mascararEmail(e.email) };
}
