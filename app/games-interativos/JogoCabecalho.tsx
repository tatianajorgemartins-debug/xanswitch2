'use client';

// Cabeçalho do site pras páginas de jogo (Silhueta do Dia, Ocarina Hero…):
// o mesmo da página "Testes", com a foto de quem está logado no botão
// "Minha conta", e o botão do WhatsApp.
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import SiteHeader from '../SiteHeader';
import FloatingWhatsApp from '../FloatingWhatsApp';
import { getCurrentUser, getAvatarUrl, onAuthChange } from '@/lib/wishlist';
import { afterPageLoad } from '@/lib/afterPageLoad';

export default function JogoCabecalho({
  whatsappContactUrl,
  children
}: {
  whatsappContactUrl: string | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let stopListening = () => {};
    const cancel = afterPageLoad(() => {
      getCurrentUser()
        .then(setUser)
        .catch(() => {});
      stopListening = onAuthChange(setUser);
    });
    return () => {
      cancel();
      stopListening();
    };
  }, []);

  return (
    <>
      <header className="site-header-bar" style={{ viewTransitionName: 'site-header' }}>
        <div className="site-header-bar-inner">
          <SiteHeader
            whatsappContactUrl={whatsappContactUrl}
            activeCatalog="testes"
            accountLabel="Minha conta"
            accountHref="/?conta=1"
            accountAvatar={getAvatarUrl(user)}
          />
        </div>
      </header>
      {children}
      <FloatingWhatsApp baseUrl={whatsappContactUrl} modalOpen={false} />
    </>
  );
}
