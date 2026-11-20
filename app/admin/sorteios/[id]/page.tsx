import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import SorteioAdmin from './SorteioAdmin';
import { dadosControleAction } from '../actions';
import '../../admin.css';
import '../../../sorteio/sorteio.css';
import '../sorteios-admin.css';

// Um sorteio no admin: Configurar (textos, regras e prêmios), Controle
// (privado: inscrições, participantes, sortear) e Telão (o que vai na live).
export const dynamic = 'force-dynamic';

export default async function SorteioAdminPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const dados = await dadosControleAction(id).catch(() => null);
  if (!dados) notFound();
  return <SorteioAdmin inicial={dados} />;
}
