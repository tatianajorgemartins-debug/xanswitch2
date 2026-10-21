import type { Metadata } from 'next';
import Link from 'next/link';
import SiteShell from '@/app/SiteShell';
import { buildWhatsAppContactLink } from '@/lib/whatsapp';

export const metadata: Metadata = {
  title: 'Política de privacidade — XAN Switch',
  description: 'Quais dados a XAN Switch coleta, por que, com quem compartilha e como você exerce seus direitos pela LGPD.'
};

const UPDATED_AT = '21 de outubro de 2026';
const SECTIONS: [string, string][] = [["quem-somos","Quem somos"],["dados","Quais dados coletamos e para quê"],["bases-legais","Com base em quê tratamos seus dados"],["compartilhamento","Com quem compartilhamos"],["retencao","Por quanto tempo guardamos"],["direitos","Seus direitos"],["seguranca","Segurança"],["menores","Menores de idade"],["mudancas","Mudanças nesta política"]];
const INSTAGRAM_URL = 'https://instagram.com/xan.switch';

export default function PrivacyPage() {
  const whatsappUrl = buildWhatsAppContactLink();

  return (
    <SiteShell>
      <div className="legal-page">
        <header className="legal-topbar">
          <Link href="/" className="legal-brand" aria-label="Voltar ao catálogo da XAN Switch">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="XAN Switch" className="logo-for-dark" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-dark.png" alt="XAN Switch" className="logo-for-light" />
          </Link>
          <Link href="/" className="btn ghost">
            Voltar ao catálogo
          </Link>
        </header>

        <div className="legal-layout">
        <main className="legal-content">
          <h1>Política de privacidade</h1>
          <p className="legal-lead">
            Aqui explicamos, sem juridiquês, quais dados a XAN Switch coleta quando você usa o site, por que, com quem
            eles são compartilhados e como você pode pedir pra ver, corrigir ou apagar seus dados, conforme a Lei Geral
            de Proteção de Dados (Lei nº 13.709/2018, a LGPD).
          </p>
          <p className="legal-updated">Última atualização: {UPDATED_AT}</p>

          <section id="quem-somos">
            <h2>Quem somos</h2>
            <p>
              A XAN Switch é uma loja online de códigos digitais de jogos para Nintendo Switch, com pagamento por Pix ou
              por crédito parcelado. Somos a responsável (a &ldquo;controladora&rdquo;, nos termos da LGPD) pelos
              dados pessoais tratados neste site.
            </p>
            <p>
              Para qualquer assunto sobre privacidade, fale com a gente pelo Instagram{' '}
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                @xan.switch
              </a>
              {whatsappUrl && (
                <>
                  {' '}ou pelo{' '}
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </>
              )}
              .
            </p>
          </section>

          <section id="dados">
            <h2>Quais dados coletamos e para quê</h2>

            <h3>Quando você compra um jogo</h3>
            <ul>
              <li>
                <strong>Seu e-mail</strong>, pra enviar o código do jogo depois que o pagamento é confirmado e pra
                registrar o pedido.
              </li>
              <li>
                <strong>O pedido em si</strong>: jogo, valor, forma de pagamento (Pix ou crédito), data e desconto
                aplicado, se houver.
              </li>
              <li>
                <strong>Como você conheceu a loja</strong>, se você escolher responder (é opcional). Usamos só pra
                saber quais divulgações funcionam.
              </li>
            </ul>

            <h3>Quando você cria uma conta</h3>
            <ul>
              <li>
                <strong>E-mail e senha</strong>, pra você entrar e acompanhar seus cards colecionáveis e pontos. A senha
                é guardada de forma criptografada pelo nosso provedor de contas; nem nós conseguimos vê-la.
              </li>
              <li>
                <strong>Seu @ do Instagram</strong>, se você quiser informar (é opcional).
              </li>
              <li>
                <strong>Sua lista de desejos, seus cards, pontos e créditos de desconto</strong>, que são o
                funcionamento do programa de fidelidade.
              </li>
            </ul>

            <h3>Quando você deixa uma avaliação</h3>
            <ul>
              <li>
                <strong>Nome, nota, comentário e, se quiser, seu @ do Instagram.</strong> As avaliações passam por
                aprovação e, quando aprovadas, ficam públicas no site com esses dados.
              </li>
            </ul>

            <h3>Pagamento</h3>
            <ul>
              <li>
                <strong>Pix:</strong> o pagamento é feito no app do seu banco. O site não recebe seus dados bancários;
                vemos apenas o que o nosso banco mostra de qualquer Pix recebido, como o nome de quem pagou e o valor.
              </li>
              <li>
                <strong>Crédito parcelado:</strong> o pagamento acontece na página de um parceiro de pagamento, fora da
                XAN Switch. Não recebemos nem guardamos os dados do seu cartão; o tratamento deles segue a política de
                privacidade desse parceiro.
              </li>
            </ul>

            <h3>Enquanto você navega</h3>
            <ul>
              <li>
                Contamos quantas visitas o site recebe com um cookie que só marca que aquele navegador já foi contado.
                Ele não guarda quem você é.
              </li>
              <li>
                Seu navegador guarda sua preferência de tema (claro ou escuro) e, se você entrar na conta, a sua sessão
                de login.
              </li>
              <li>Não usamos ferramentas de anúncios nem de rastreamento de terceiros, como Google Analytics ou pixel do Facebook.</li>
            </ul>
          </section>

          <section id="bases-legais">
            <h2>Com base em quê tratamos seus dados</h2>
            <ul>
              <li>
                <strong>Pra cumprir a compra</strong> que você fez (registrar o pedido e enviar o código): execução de
                contrato.
              </li>
              <li>
                <strong>Conta, programa de fidelidade, avaliações e a pergunta &ldquo;como nos conheceu&rdquo;</strong>:
                seu consentimento, que você pode retirar a qualquer momento.
              </li>
              <li>
                <strong>Contagem de visitas e segurança do site</strong>: nosso legítimo interesse em manter o site
                funcionando bem, sem identificar você.
              </li>
              <li>
                <strong>Registros de vendas</strong>, quando exigidos por lei: cumprimento de obrigação legal.
              </li>
            </ul>
          </section>

          <section id="compartilhamento">
            <h2>Com quem compartilhamos</h2>
            <p>
              Não vendemos nem alugamos seus dados. Eles só passam por empresas que fazem o site funcionar, e apenas no
              necessário pra cada serviço:
            </p>
            <ul>
              <li>
                <strong>Vercel</strong>, que hospeda o site.
              </li>
              <li>
                <strong>Neon</strong>, banco de dados onde ficam pedidos, avaliações e pontos.
              </li>
              <li>
                <strong>Supabase</strong>, que cuida das contas (login e senha), da lista de desejos e do armazenamento
                de imagens.
              </li>
              <li>
                <strong>Resend e Telegram</strong>, usados pra avisar a loja quando chega um pedido novo. O aviso
                inclui o jogo, o valor e o seu e-mail.
              </li>
              <li>
                <strong>Parceiro de pagamento parcelado</strong>, quando você escolhe pagar no crédito.
              </li>
            </ul>
            <p>
              Alguns desses serviços guardam dados em servidores fora do Brasil. Nesses casos, a transferência segue
              as regras da LGPD pra transferência internacional de dados.
            </p>
            <p>
              <strong>Produtos físicos:</strong> os produtos físicos do site são da loja parceira Beedle Games, e a
              compra é feita diretamente com ela pelo Instagram{' '}
              <a href="https://www.instagram.com/beedle_games/" target="_blank" rel="noopener noreferrer">
                @beedle_games
              </a>
              . O que você conversar e comprar por lá segue as regras da Beedle Games e do Instagram.
            </p>
          </section>

          <section id="retencao">
            <h2>Por quanto tempo guardamos</h2>
            <ul>
              <li>
                <strong>Pedidos e o e-mail usado na compra:</strong> pelo tempo necessário pra atender o pedido,
                resolver qualquer problema com ele e cumprir obrigações legais.
              </li>
              <li>
                <strong>Conta, cards, pontos e lista de desejos:</strong> enquanto sua conta existir, ou até você pedir
                a exclusão.
              </li>
              <li>
                <strong>Avaliações:</strong> enquanto estiverem publicadas, ou até você pedir a remoção.
              </li>
            </ul>
          </section>

          <section id="direitos">
            <h2>Seus direitos</h2>
            <p>Pela LGPD, você pode pedir a qualquer momento:</p>
            <ul>
              <li>a confirmação de que tratamos dados seus e uma cópia deles;</li>
              <li>a correção de dados incompletos ou errados;</li>
              <li>a exclusão dos seus dados, da sua conta ou de uma avaliação;</li>
              <li>a portabilidade dos seus dados pra outro fornecedor;</li>
              <li>informações sobre com quem compartilhamos seus dados;</li>
              <li>a retirada do seu consentimento, quando ele for a base do tratamento.</li>
            </ul>
            <p>
              É só mandar uma mensagem pelo Instagram{' '}
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                @xan.switch
              </a>
              {whatsappUrl && (
                <>
                  {' '}ou pelo{' '}
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </>
              )}{' '}
              com o e-mail que você usou no site. Respondemos em até 15 dias. Se achar que seus direitos não foram
              respeitados, você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
          </section>

          <section id="seguranca">
            <h2>Segurança</h2>
            <p>
              Usamos conexão criptografada (HTTPS) em todo o site, senhas guardadas de forma criptografada e acesso
              restrito ao painel da loja. Nenhum sistema é 100% invulnerável, mas, se acontecer algum incidente que
              possa te prejudicar, avisaremos você e a ANPD, como manda a lei.
            </p>
          </section>

          <section id="menores">
            <h2>Menores de idade</h2>
            <p>
              Compras e criação de conta devem ser feitas por maiores de 18 anos ou com a autorização e o acompanhamento
              de um responsável.
            </p>
          </section>

          <section id="mudancas">
            <h2>Mudanças nesta política</h2>
            <p>
              Se mudarmos a forma como tratamos seus dados, atualizamos esta página e a data no topo. Mudanças
              importantes também serão avisadas no site.
            </p>
          </section>
        </main>

        <nav className="legal-toc" aria-label="Nesta página">
          <p className="legal-toc-title">Nesta página</p>
          <ol>
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
        </nav>
        </div>

        <footer className="legal-footer">
          <Link href="/">XAN SWITCH — Nintendo mais barato</Link>
        </footer>
      </div>
    </SiteShell>
  );
}
