// Web Worker do gerador de notas: roda a parte pesada da análise (extrair)
// fora da página, mandando o progresso de volta. Ver analise.ts.
import { extrair, type Caracteristicas, type Foco } from './analise';

export type PedidoAnalise = { id: number; L: Float32Array; R: Float32Array | null; taxa: number; foco: Foco; faixa: [number, number] | null };
export type RespostaAnalise =
  | { id: number; tipo: 'progresso'; p: number }
  | { id: number; tipo: 'pronto'; c: Caracteristicas }
  | { id: number; tipo: 'erro'; erro: string };

const escopo = self as unknown as { onmessage: ((e: MessageEvent<PedidoAnalise>) => void) | null; postMessage: (m: RespostaAnalise) => void };

escopo.onmessage = (e) => {
  const { id, L, R, taxa, foco, faixa } = e.data;
  try {
    let ultimo = 0;
    const c = extrair(L, R, taxa, foco, faixa, (p) => {
      if (p - ultimo >= 0.02 || p === 1) {
        ultimo = p;
        escopo.postMessage({ id, tipo: 'progresso', p });
      }
    });
    escopo.postMessage({ id, tipo: 'pronto', c });
  } catch (err) {
    escopo.postMessage({ id, tipo: 'erro', erro: err instanceof Error ? err.message : String(err) });
  }
};
