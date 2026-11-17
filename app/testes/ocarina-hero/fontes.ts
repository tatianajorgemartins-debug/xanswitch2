// Fontes da partida do Ocarina Hero: Cinzel (placar, combo, letras dos
// anéis) e Cormorant Garamond itálica (nome da música). Servidas pelo
// próprio site; só baixam quando a partida aparece (preload: false).
import { Cinzel, Cormorant_Garamond } from 'next/font/google';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['700', '900'], display: 'swap', preload: false, variable: '--oc-cinzel' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['italic'],
  display: 'swap',
  preload: false,
  variable: '--oc-cormorant'
});

export const OC_FONTES = `${cinzel.variable} ${cormorant.variable}`;
