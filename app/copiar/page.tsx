import type { Metadata } from 'next';
import CopyCode from './CopyCode';
import './copiar.css';

// Destino do botão "Copiar" do e-mail com a chave do jogo (ver
// lib/deliveryEmail.ts). E-mail não roda JavaScript, então o botão abre esta
// página, que copia o código. O código vem depois do # do link: essa parte
// nunca sai do navegador, então não passa pelo servidor nem fica em log.
export const metadata: Metadata = {
  title: 'Copiar código — XAN Switch',
  robots: { index: false, follow: false }
};

export default function CopyPage() {
  return <CopyCode />;
}
