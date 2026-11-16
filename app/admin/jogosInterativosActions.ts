'use server';

// Moderação do feed de resultados dos jogos (/testes/feed), pela aba
// "Jogos interativos" do admin.
import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { deletePost, setPostHidden } from '@/lib/jogosDb';

export async function setGamePostHiddenAction(id: number, hidden: boolean): Promise<{ ok: boolean }> {
  if (!(await isAuthenticated())) return { ok: false };
  try {
    await setPostHidden(id, hidden);
    revalidatePath('/testes/feed');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function deleteGamePostAction(id: number): Promise<{ ok: boolean }> {
  if (!(await isAuthenticated())) return { ok: false };
  try {
    await deletePost(id);
    revalidatePath('/testes/feed');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
