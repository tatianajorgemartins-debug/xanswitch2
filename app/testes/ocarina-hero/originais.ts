// As 6 músicas originais da XAN (sem áudio: o jogo toca a ocarina em cada
// acerto). Ficam em data/jogos/ocarina/. As músicas novas são feitas no
// admin (aba "Ocarina Hero") e vêm do banco.
import brisa from '@/data/jogos/ocarina/brisa-da-vila.json';
import trilha from '@/data/jogos/ocarina/trilha-do-bosque.json';
import floresta from '@/data/jogos/ocarina/melodia-da-floresta.json';
import ruinas from '@/data/jogos/ocarina/ruinas-do-templo.json';
import ceu from '@/data/jogos/ocarina/ceu-de-cristal.json';
import vulcao from '@/data/jogos/ocarina/furia-do-vulcao.json';
import { validarChart, type Chart } from './ocarina';

export const ORIGINAIS: Chart[] = [brisa, trilha, floresta, ruinas, ceu, vulcao]
  .map((c) => validarChart(c))
  .filter((c): c is Chart => c !== null);
