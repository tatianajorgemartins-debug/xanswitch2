'use client';

// Aba "Sorteios" do admin: a lista dos sorteios ao vivo e o botão de criar.
// Cada um abre em /admin/sorteios/[id] (configurar, controle e telão).
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NOME_STATUS, type StatusSorteio } from '@/lib/sorteio/regras';
import { criarSorteioAction } from './sorteios/actions';

export type SorteioLista = {
  id: number;
  titulo: string;
  slug: string;
  status: StatusSorteio;
  teste: boolean;
  participantes: number;
  premios: number;
};

export default function SorteiosPanel({ sorteios }: { sorteios: SorteioLista[] | null }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    setErro(null);
    const r = await criarSorteioAction(titulo).catch(() => ({ ok: false as const, erro: 'A conexão falhou.' }));
    if (r.ok) router.push(`/admin/sorteios/${r.id}`);
    else {
      setErro(r.erro);
      setCriando(false);
    }
  }

  if (sorteios === null) {
    return (
      <div className="adm-card">
        <h3>Falta criar as tabelas dos sorteios</h3>
        <p className="adm-help">
          Rode o arquivo <code>db/migration-sorteios.sql</code> uma vez no editor SQL do Neon e atualize esta página.
        </p>
      </div>
    );
  }

  return (
    <>
      <form className="adm-card sorteios-novo" onSubmit={criar}>
        <label>
          Nome do novo sorteio
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex: Sorteio da live do TGA 2026" maxLength={120} />
        </label>
        <button type="submit" className="btn primary" disabled={criando}>
          {criando ? 'Criando…' : '＋ Criar sorteio'}
        </button>
        {erro && <p className="adm-danger">{erro}</p>}
      </form>

      {sorteios.length === 0 ? (
        <p className="adm-empty">Nenhum sorteio ainda.</p>
      ) : (
        <div className="adm-card">
          <table className="adm-jogos-tabela">
            <thead>
              <tr>
                <th>Sorteio</th>
                <th>Link</th>
                <th>Situação</th>
                <th>Prêmios</th>
                <th>Participantes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorteios.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.titulo}</strong>
                    {s.teste && <span className="adm-muted"> · modo de teste</span>}
                  </td>
                  <td>
                    <code>/sorteio/{s.slug}</code>
                  </td>
                  <td>{NOME_STATUS[s.status]}</td>
                  <td>{s.premios}</td>
                  <td>{s.participantes}</td>
                  <td>
                    <Link className="btn ghost" href={`/admin/sorteios/${s.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="adm-help">Como usar no dia da live: veja o arquivo SORTEIO-README.md.</p>
    </>
  );
}
