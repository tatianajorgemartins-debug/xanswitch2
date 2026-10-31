import type { Metadata } from 'next';
import Link from 'next/link';
import SiteShell from '@/app/SiteShell';
import CatalogClient from '@/app/CatalogClient';
import { loadCatalogData } from '@/lib/catalogData';
import { getValidPrivateOffer } from '@/lib/db';
import { formatPriceBR } from '@/lib/whatsapp';

// Link exclusivo (admin → 🔗 Links exclusivos): o catálogo de sempre, mas
// com o jogo da oferta no preço especial e a janela dele já aberta. O
// preço aqui é só o que a pessoa vê — quem decide o valor cobrado é o
// servidor, que confere o token de novo em cada pagamento (ver loadOffer
// em app/mercadoPagoActions.ts).
//
// Nunca é cacheada (cada link tem seu preço e pode vencer a qualquer hora)
// e fica fora do Google.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Oferta exclusiva — XAN Switch',
  robots: { index: false, follow: false }
};

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = /^[A-Za-z0-9_-]{8,64}$/.test(token) ? await getValidPrivateOffer(token).catch(() => null) : null;
  const data = await loadCatalogData();
  const base = offer ? data.items.find((item) => item.id === offer.game_id) : undefined;

  if (!offer || !base) {
    return (
      <SiteShell>
        <div className="offer-expired">
          <p className="offer-expired-emoji" aria-hidden="true">
            🔗
          </p>
          <h1>Esse link não vale mais</h1>
          <p>A oferta venceu, já foi usada ou foi desativada. Fale com a gente no WhatsApp que a gente ajuda.</p>
          <Link href="/" className="btn primary">
            Ver o catálogo
          </Link>
        </div>
      </SiteShell>
    );
  }

  const price = parseFloat(offer.price);
  const item = {
    ...base,
    price,
    priceLabel: formatPriceBR(price),
    originalPriceLabel: base.price > price ? base.priceLabel : null,
    isOnSale: base.price > price,
    salePercent: base.price > price ? Math.round((1 - price / base.price) * 100) : null,
    // Preço especial já é o desconto: sem fidelidade nem link de crédito
    // externo (que cobraria o preço normal).
    discountEligible: false,
    creditPaymentUrl: null,
    offerToken: offer.token
  };

  return (
    <SiteShell>
      <CatalogClient
        {...data}
        items={data.items.map((it) => (it.id === item.id ? item : it))}
        initialGameId={item.id}
      />
    </SiteShell>
  );
}
