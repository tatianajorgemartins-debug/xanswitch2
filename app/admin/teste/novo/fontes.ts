// Fontes do novo layout em teste: Bricolage Grotesque nos títulos e Inter
// no texto (ver o documento "Xan Switch — novo layout do site").
import { Bricolage_Grotesque, Inter } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '800'], display: 'swap', variable: '--nh-titulo' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--nh-texto-f' });

export const NH_FONTES = `${bricolage.variable} ${inter.variable}`;
