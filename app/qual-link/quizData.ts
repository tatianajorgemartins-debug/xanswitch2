// Conteúdo do quiz "Qual Link é você?" — só textos e pontuação, sem lógica
// (a lógica fica em quizLogic.ts). Dá pra editar qualquer texto aqui sem
// mexer em mais nada.
//
// Pontuação: cada opção dá 3 pontos ao Link "principal" e 1 ao "secundario".
// Imagens: public/quiz-zelda/link-<id>.webp (ver
// scripts/convert-qual-link-images.mjs).

import type { LinkId } from './links.ts';

export { LINK_ORDER, linkImage, cardImage, type LinkId } from './links.ts';

export type LinkResult = {
  nome: string;
  jogo: string;
  arquetipo: string;
  descricao: string;
  tracos: string[];
  forte: string;
  cuidado: string;
  frase: string;
};

export type QuizOption = { texto: string; principal: LinkId; secundario: LinkId };
export type QuizQuestion = { pergunta: string; opcoes: QuizOption[] };

export const LINKS: Record<LinkId, LinkResult> = {
  nes: {
    nome: 'O Herói Original',
    jogo: 'The Legend of Zelda · NES, 1986',
    arquetipo: 'O Pioneiro Solitário',
    descricao:
      'Você é o Link que começou tudo: um garoto jogado num mundo enorme, com um velho numa caverna dizendo “é perigoso ir sozinho, leve isto”. E só isso. Sem mapa, sem tutorial, sem ninguém explicando o caminho. Você é assim: não espera instrução, vai lá e descobre. Aprende errando, testa cada parede, queima cada arbusto. Sua coragem é crua e direta, sem discurso.',
    tracos: ['Autodidata', 'Corajoso sem frescura', 'Independente', 'Explorador raiz'],
    forte: 'você encara o desconhecido sem precisar de garantias. Enquanto os outros esperam o manual, você já está três telas à frente.',
    cuidado: 'nem tudo precisa ser resolvido sozinho. Às vezes o velho da caverna tem mais do que uma espada para te oferecer.',
    frase: '“Ninguém me deu o mapa. Então eu desenhei o meu.”'
  },
  alttp: {
    nome: 'Link de A Link to the Past',
    jogo: 'SNES, 1991',
    arquetipo: 'O Herdeiro do Dever',
    descricao:
      'Numa noite de tempestade, seu tio sai rumo ao castelo e você vai atrás. Ele cai e te entrega a espada e a missão. Você é descendente dos Cavaleiros de Hyrule e leva esse legado a sério. É o Link clássico: metódico, responsável, que honra quem veio antes e cumpre o que precisa ser cumprido. Transita entre o Mundo da Luz e o Mundo das Trevas sem perder a direção, porque o seu norte é o dever.',
    tracos: ['Responsável', 'Metódico', 'Leal às raízes', 'Firme sob pressão'],
    forte: 'disciplina. Você resolve as coisas etapa por etapa (mapa, bússola, chave grande, chefe) e chega lá.',
    cuidado: 'o peso do legado pode virar cobrança demais. Você também tem direito de escolher o próprio caminho.',
    frase: '“Eu sigo o caminho que me deixaram, e vou até o fim.”'
  },
  la: {
    nome: 'Link de Link’s Awakening',
    jogo: 'Game Boy, 1993 / Switch, 2019',
    arquetipo: 'O Sonhador Gentil',
    descricao:
      'Depois de um naufrágio, você acorda na Ilha Koholint, cuidado por Marin, cercado de gente adorável e meio esquisita. Aos poucos descobre que a ilha inteira pode ser o sonho do Peixe-Vento, e que acordá-lo significa deixar tudo para trás. Você é esse Link: doce e afetivo. Se apega aos lugares e às pessoas e vive cada momento como algo precioso, porque sabe, lá no fundo, que nada dura para sempre.',
    tracos: ['Afetuoso', 'Nostálgico', 'Gentil', 'Sensível'],
    forte: 'você transforma qualquer lugar em lar e faz qualquer pessoa se sentir querida.',
    cuidado: 'apegar-se ao sonho pode te impedir de acordar. Às vezes seguir em frente é o maior gesto de carinho.',
    frase: '“Às vezes acho que vivo num sonho bom demais pra ser verdade.”'
  },
  oot: {
    nome: 'Link Criança de Ocarina of Time',
    jogo: 'N64, 1998',
    arquetipo: 'O Deslocado em Busca do Seu Lugar',
    descricao:
      'Você cresceu na Floresta Kokiri como “o menino sem fada”, sempre um pouco diferente dos outros sem saber por quê. Quando Navi finalmente chega, o destino chega junto, e você descobre que nem Kokiri é. Você é esse Link: puro, curioso e de bom coração, mas com a sensação de não se encaixar totalmente em lugar nenhum. E aí a vida te faz crescer rápido demais: sete anos num piscar de olhos.',
    tracos: ['Puro de coração', 'Curioso', 'Determinado', 'Um pouco deslocado'],
    forte: 'você enfrenta coisas enormes mesmo se sentindo pequeno, e seu bom coração não se corrompe.',
    cuidado: 'não se encaixar não significa não pertencer. Seu lugar existe. Às vezes ele só não fica onde você nasceu.',
    frase: '“Eu tive que crescer rápido demais.”'
  },
  mm: {
    nome: 'Link de Majora’s Mask',
    jogo: 'N64, 2000',
    arquetipo: 'O Empático Melancólico',
    descricao:
      'Você saiu procurando um amigo e foi parar em Termina, um mundo que vai acabar em três dias. E fez o que poucos fariam: voltou no tempo de novo e de novo. Não só para salvar o mundo, mas para reunir Anju e Kafei, curar almas atormentadas com a Canção da Cura e ouvir histórias que ninguém mais ouviu. Você é esse Link: introspectivo, maduro além da idade, alguém que sente a dor dos outros e não vira as costas.',
    tracos: ['Empático', 'Introspectivo', 'Persistente', 'Melancólico'],
    forte: 'você enxerga as pessoas por trás das máscaras. Ninguém ajuda com tanta profundidade.',
    cuidado: 'carregar a dor de todo mundo cansa. Você também merece alguém que toque a Canção da Cura para você.',
    frase: '“Toda máscara esconde uma história. Eu quero ouvir a sua.”'
  },
  ww: {
    nome: 'Toon Link',
    jogo: 'The Wind Waker · GameCube, 2002',
    arquetipo: 'O Coração Aventureiro',
    descricao:
      'Você era só um garoto da Ilha Outset, de roupa verde no dia do aniversário, até sua irmã Aryll ser levada por um pássaro gigante. Sem hesitar, você embarcou num navio pirata e cruzou o Grande Mar. Você é esse Link: expressivo (sua cara entrega tudo), engraçado, impulsivo e corajoso por amor à família. Não nasceu herói. Virou herói porque alguém que você ama precisava.',
    tracos: ['Expressivo', 'Impulsivo', 'Leal à família', 'Bem-humorado'],
    forte: 'sua coragem vem do coração. Por quem você ama, você vai até o fim do mar.',
    cuidado: 'pular antes de pensar pode te fazer ser lançado por uma catapulta direto para uma fortaleza. Respira antes.',
    frase: '“Não preciso ser o herói lendário. Só preciso trazer minha irmã de volta.”'
  },
  fs: {
    nome: 'Link de Four Swords',
    jogo: 'GBA, 2002 / GameCube, 2004',
    arquetipo: 'O Espírito de Equipe',
    descricao:
      'Ao puxar a Four Sword, você se dividiu em quatro: verde, vermelho, azul e roxo. E descobriu que nada funciona se os quatro não andarem juntos, mesmo que cada um esteja de olho em pegar mais rupees que os outros. Você é esse Link: sociável e cheio de energia. Adora estar em grupo, divide tarefas e puxa todo mundo junto, sem deixar de amar uma competiçãozinha amigável.',
    tracos: ['Sociável', 'Colaborativo', 'Competitivo', 'Energético'],
    forte: 'você transforma um grupo em time. Com você por perto, ninguém fica para trás.',
    cuidado: 'nem toda disputa precisa ser vencida. Às vezes o rupee extra custa a amizade.',
    frase: '“Rolê bom é rolê com a galera (e se tiver placar, melhor).”'
  },
  mc: {
    nome: 'Link de Minish Cap',
    jogo: 'GBA, 2004',
    arquetipo: 'O Observador dos Detalhes',
    descricao:
      'Neto do ferreiro de Hyrule, você ganhou um chapéu falante e rabugento, o Ezlo, e a capacidade de encolher até o tamanho dos Minish. Passou a ver um mundo escondido em poças, rachaduras e embaixo de cogumelos. E ainda fazia fusão de Kinstones com cada morador da cidade, um por um. Você é esse Link: atento, paciente e humilde. Nota o que os outros ignoram e valoriza as pequenas conexões.',
    tracos: ['Observador', 'Paciente', 'Humilde', 'Detalhista'],
    forte: 'você enxerga soluções que estão literalmente embaixo do nariz de todo mundo.',
    cuidado: 'não se subestime. Você pode ser pequeno no tamanho, mas é enorme no que resolve.',
    frase: '“As maiores coisas cabem nos menores lugares.”'
  },
  tp: {
    nome: 'Link de Twilight Princess',
    jogo: 'GameCube/Wii, 2006',
    arquetipo: 'O Protetor da Comunidade',
    descricao:
      'Você era um rapaz simples de Ordon: cuidava das cabras, ajudava os vizinhos, era a referência das crianças da vila e o melhor amigo da Epona. Quando o Crepúsculo cobriu Hyrule e as crianças foram levadas, você virou lobo, aceitou a parceria nada fácil com a Midna e foi até o fim. Você é esse Link: maduro, trabalhador e confiável, de pé no chão, com uma força interior que aparece quando os seus estão em perigo.',
    tracos: ['Protetor', 'Trabalhador', 'Leal', 'Pé no chão'],
    forte: 'você é o porto seguro das pessoas ao redor. Todo mundo sabe que pode contar com você.',
    cuidado: 'você carrega a responsabilidade de todos. Pedir ajuda (até para uma criatura sarcástica do Crepúsculo) não é fraqueza.',
    frase: '“Eu volto. Prometo. E trago todo mundo junto.”'
  },
  ss: {
    nome: 'Link de Skyward Sword',
    jogo: 'Wii, 2011 / Switch, 2021',
    arquetipo: 'O Devoto Leal',
    descricao:
      'Em Skyloft, acima das nuvens, você era aluno da Academia de Cavaleiros. Meio dorminhoco, quase perdeu a própria Cerimônia das Asas. Mas quando Zelda caiu para a superfície, você saltou atrás dela sem pensar. Esta é a origem de toda a lenda: o primeiro Link, cuja jornada nasce de um laço profundo com alguém. Você é assim: leal até o osso, movido por afeto e capaz de atravessar o tempo por quem ama.',
    tracos: ['Leal', 'Romântico', 'Devotado', 'Determinado'],
    forte: 'quando você ama, ama com tudo. Sua lealdade é capaz de forjar lendas.',
    cuidado: 'viver em função de alguém pode te fazer esquecer de você. Sua história também importa por si só.',
    frase: '“Vou te encontrar, não importa onde (ou quando) você esteja.”'
  },
  albw: {
    nome: 'Link de A Link Between Worlds',
    jogo: '3DS, 2013',
    arquetipo: 'O Criativo de Outro Ângulo',
    descricao:
      'Aprendiz de ferreiro que vivia perdendo a hora, você ganhou o poder de virar pintura e andar pelas paredes, vendo cada problema de um ângulo que ninguém mais via. Alugava itens do Ravio, escolhia a ordem das masmorras e entendeu que Lorule, o reflexo sombrio de Hyrule, também tinha seu lado da história. Você é esse Link: flexível e de pensamento lateral. Enxerga os dois lados e faz as coisas do seu jeito, no seu tempo.',
    tracos: ['Pensamento lateral', 'Flexível', 'Empático com o “outro lado”', 'Tranquilão'],
    forte: 'você vê saídas onde os outros só veem parede. Literalmente.',
    cuidado: '“depois eu faço” funciona até o dia em que não funciona. Acorda, aprendiz!',
    frase: '“Toda escolha tem um lado de lá, e eu gosto de ver os dois.”'
  },
  botw: {
    nome: 'Link de Breath of the Wild',
    jogo: 'Switch, 2017',
    arquetipo: 'O Explorador Livre',
    descricao:
      'Você acordou no Santuário da Ressurreição depois de 100 anos, sem memória, com o mundo inteiro à frente e ninguém dizendo para onde ir. Viu uma montanha? Escalou. Pelo diário de Zelda, sabemos que você se calou pelo peso das expectativas e se expressa mais em atos do que em palavras. Você é esse Link: silencioso, livre e curioso. Precisa de espaço e se reconstrói explorando.',
    tracos: ['Livre', 'Silencioso', 'Resiliente', 'Curioso'],
    forte: 'você se adapta a qualquer situação e encontra o próprio caminho. Liberdade é o seu combustível.',
    cuidado: 'nem todo silêncio é paz. Às vezes vale deixar alguém entrar.',
    frase: '“Viu aquela montanha? Dá pra ir.”'
  },
  totk: {
    nome: 'Link de Tears of the Kingdom',
    jogo: 'Switch, 2023',
    arquetipo: 'O Construtor Engenhoso',
    descricao:
      'Você perdeu a Espada Mestra, teve o braço ferido e ganhou outro, o de Rauru, com Ultrahand e Fusão. E fez o que faz de melhor: construiu. Pontes, veículos, armas absurdas, soluções que nenhum designer previu. Agora com memória e experiência, você não é só o explorador: é quem ajuda a reconstruir Hyrule ao lado de todos, de Lookout Landing até as Profundezas. Você é esse Link: inventivo, maduro, colaborativo e prático.',
    tracos: ['Inventivo', 'Prático', 'Colaborativo', 'Resiliente'],
    forte: 'dê a você duas tábuas e um ventilador que você resolve. Sua criatividade transforma problema em projeto.',
    cuidado: 'nem tudo precisa de uma gambiarra de 14 peças. Às vezes a ponte simples é a melhor ponte.',
    frase: '“Não tem caminho? Então eu construo um.”'
  }
};

function o(texto: string, principal: LinkId, secundario: LinkId): QuizOption {
  return { texto, principal, secundario };
}

export const PERGUNTAS: QuizQuestion[] = [
  {
    pergunta: 'Você ganhou um sábado inteiro livre, sem compromisso. O que você faz?',
    opcoes: [
      o('Pego a mochila e saio sem rumo, sem mapa. Quero ver o que tem depois daquele morro.', 'botw', 'nes'),
      o('Chamo a galera. Rolê só vale em grupo (e se rolar uma competiçãozinha, melhor ainda).', 'fs', 'ww'),
      o('Fico em casa montando, consertando ou inventando alguma coisa.', 'totk', 'mc'),
      o('Ajudo alguém da família ou da vizinhança com o que estiver precisando.', 'tp', 'mm'),
      o('Durmo até tarde. Sem culpa nenhuma.', 'albw', 'ss')
    ]
  },
  {
    pergunta: 'Alguém próximo está passando por um problema. Como você reage?',
    opcoes: [
      o('Paro tudo e ajudo, mesmo que pareça pequeno e ninguém mais esteja ligando.', 'mm', 'mc'),
      o('Antes de agir, observo bem para entender o que realmente está acontecendo.', 'mc', 'alttp'),
      o('Vou na hora, sem pensar. O plano eu monto no caminho.', 'ww', 'nes'),
      o('Por quem eu amo, eu atravesso o que for. Minha lealdade é total.', 'ss', 'tp'),
      o('Junto as pessoas certas e a gente constrói uma solução juntos.', 'totk', 'fs')
    ]
  },
  {
    pergunta: 'Qual dessas frases mais parece com você?',
    opcoes: [
      o('"Ninguém me deu manual. Eu descobri sozinho."', 'nes', 'botw'),
      o('"Eu honro quem veio antes de mim e o que me foi confiado."', 'alttp', 'ss'),
      o('"Às vezes acho que vivo num sonho bom demais pra ser verdade."', 'la', 'oot'),
      o('"Toda história tem dois lados, e eu gosto de enxergar os dois."', 'albw', 'mc'),
      o('"Eu tive que crescer rápido demais."', 'oot', 'mm')
    ]
  },
  {
    pergunta: 'No seu grupo de amigos, você é...',
    opcoes: [
      o('O que fala pouco, mas está sempre lá quando importa.', 'botw', 'tp'),
      o('O mais expressivo: minha cara entrega tudo o que eu sinto.', 'ww', 'la'),
      o('O que organiza, divide as tarefas e puxa todo mundo junto.', 'fs', 'totk'),
      o('O que parece quieto e "pequeno", mas nota tudo e resolve.', 'mc', 'oot'),
      o('O braço direito confiável, que segura as pontas de todo mundo.', 'alttp', 'tp')
    ]
  },
  {
    pergunta: 'Qual destes é o seu maior medo?',
    opcoes: [
      o('Não conseguir salvar alguém que eu amo.', 'ss', 'ww'),
      o('Ver o tempo passar e as coisas se perderem sem eu poder fazer nada.', 'mm', 'oot'),
      o('Descobrir que o lugar onde sou feliz vai deixar de existir.', 'la', 'mm'),
      o('Nunca encontrar um lugar onde eu realmente pertença.', 'oot', 'albw'),
      o('Esquecer quem eu fui e não saber mais quem eu sou.', 'botw', 'totk')
    ]
  },
  {
    pergunta: 'A vida te jogou num problema difícil (uma verdadeira dungeon). Você...',
    opcoes: [
      o('Testa tudo, na tentativa e erro, até alguma coisa funcionar.', 'nes', 'botw'),
      o('Segue um método: entende o mapa, acha a chave, etapa por etapa.', 'alttp', 'mc'),
      o('Inventa uma gambiarra genial que ninguém tinha pensado.', 'totk', 'albw'),
      o('Muda completamente o ângulo e olha o problema por outro lado.', 'albw', 'la'),
      o('Chama um parceiro e divide o problema em partes.', 'fs', 'tp')
    ]
  },
  {
    pergunta: 'Que tipo de lugar te faz sentir em casa?',
    opcoes: [
      o('Uma ilha tranquila, com mar, vento e a família por perto.', 'ww', 'la'),
      o('Uma vila no campo, com cavalos, bichos e gente simples.', 'tp', 'alttp'),
      o('Um lugar acima das nuvens, onde todo mundo se conhece.', 'ss', 'totk'),
      o('Uma floresta mágica, cheia de segredos e criaturas.', 'oot', 'mc'),
      o('Uma cidadezinha com uma torre de relógio e muitas histórias pra ouvir.', 'mm', 'mc')
    ]
  },
  {
    pergunta: 'Qual qualidade seus amigos mais citam em você?',
    opcoes: [
      o('Coragem. Você encara o que vier.', 'nes', 'ww'),
      o('Senso de dever. Você cumpre o que promete.', 'alttp', 'tp'),
      o('Doçura. Você deixa todo mundo à vontade.', 'la', 'fs'),
      o('Criatividade. Você sempre inventa um jeito.', 'totk', 'albw'),
      o('Paciência e atenção aos detalhes.', 'mc', 'botw')
    ]
  },
  {
    pergunta: 'Como você lida com rotina?',
    opcoes: [
      o('Detesto. Quero liberdade total pra decidir aonde ir.', 'botw', 'nes'),
      o('Gosto de rotina, de trabalho com as mãos, de me sentir útil.', 'tp', 'totk'),
      o('Vivo deixando pra depois, mas na hora H eu dou conta.', 'albw', 'ss'),
      o('Repito, refaço, ajusto, até ficar do jeito certo.', 'mm', 'mc'),
      o('Rotina boa é rotina com os amigos por perto.', 'fs', 'ww')
    ]
  },
  {
    pergunta: 'No fim da sua jornada, o que você quer levar com você?',
    opcoes: [
      o('Uma história de amor que atravessou o tempo.', 'ss', 'la'),
      o('A lembrança de cada pessoa que conheci no caminho.', 'la', 'mm'),
      o('A certeza de que encontrei o meu lugar no mundo.', 'oot', 'tp'),
      o('A sensação de ter sido livre, sem ninguém me dizendo o que fazer.', 'nes', 'botw'),
      o('Ter voltado pra casa com a minha família inteira e em segurança.', 'ww', 'ss')
    ]
  }
];
