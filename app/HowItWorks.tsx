// Faixa "Como funciona" logo abaixo do título da home (CatalogClient.tsx):
// 3 passos + selos de confiança, pra quem chega pela primeira vez entender
// em segundos como a compra acontece. Compacta de propósito — no celular os
// passos viram uma linha de arrastar, pra não empurrar o catálogo pra baixo.

const steps = (gameCount: number) => [
  {
    title: 'Escolha o jogo',
    text: `${gameCount} jogos de Switch e Switch 2 no catálogo.`,
    icon: <path d="M3 8a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8zM7.5 10v4M5.5 12h4M15.5 11h.01M18 13h.01" />
  },
  {
    title: 'Pague no Pix ou cartão',
    text: 'Pix com confirmação na hora ou cartão em até 12x.',
    icon: <path d="M2.5 7a2 2 0 012-2h15a2 2 0 012 2v10a2 2 0 01-2 2h-15a2 2 0 01-2-2V7zM2.5 10h19M6 15h4" />
  },
  {
    title: 'Receba o código no e-mail',
    // Mesmo prazo que a tela de pagamento já promete.
    text: 'Seu código chega por e-mail ainda hoje.',
    icon: <path d="M3 6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v11a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-11zM3.5 6.5l8.5 6 8.5-6" />
  }
];

const BADGES = ['Código oficial Nintendo', 'Tutorial de resgate incluso', 'Suporte pelo WhatsApp', 'Ganhe card + pontos'];

export default function HowItWorks({ gameCount }: { gameCount: number }) {
  return (
    <section className="how-it-works" aria-labelledby="how-it-works-title">
      <h2 id="how-it-works-title" className="how-it-works-title">
        Como funciona
      </h2>
      <ol className="how-it-works-steps">
        {steps(gameCount).map((step, i) => (
          <li key={step.title} className="how-it-works-step">
            <span className="how-it-works-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
                {step.icon}
              </svg>
            </span>
            <span className="how-it-works-text">
              <strong>
                <span className="how-it-works-number">{i + 1}.</span> {step.title}
              </strong>
              <span>{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <ul className="how-it-works-badges">
        {BADGES.map((badge) => (
          <li key={badge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" width={13} height={13} aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {badge}
          </li>
        ))}
      </ul>
    </section>
  );
}
