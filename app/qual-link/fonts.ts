// Fontes do "Qual Link é você?" (clima Hyrule): Cinzel nos títulos e selos,
// Cinzel Decorative nos números grandes vazados, Cormorant Garamond no
// texto corrido. Servidas pelo próprio site (next/font) e expostas como
// variáveis CSS na raiz do quiz. preload: false — a página inicial não
// baixa nenhuma delas de cara; o navegador só busca a fonte quando um
// texto com ela aparece (o banner usa só a Cinzel).
import { Cinzel, Cinzel_Decorative, Cormorant_Garamond } from 'next/font/google';

export const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['700', '900'],
  display: 'swap',
  preload: false,
  variable: '--ql-cinzel'
});
export const cinzelDecorative = Cinzel_Decorative({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  preload: false,
  variable: '--ql-cinzel-deco'
});
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  preload: false,
  variable: '--ql-cormorant'
});

export const QL_FONT_CLASSES = `${cinzel.variable} ${cinzelDecorative.variable} ${cormorant.variable}`;
