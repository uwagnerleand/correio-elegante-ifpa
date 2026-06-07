import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const PIX_KEY = '93991574982';
const WHATSAPP_NUMBER = '93991574982';

export default function HomePage() {
  return (
    <main className="page-shell hero-layout">
      <section className="hero-card centered-hero">
        <p className="eyebrow">Gincana acadêmica • IFPA</p>
        <h1>Correio Elegante Digital IFPA</h1>
        <p className="lead">
          Envie mensagens especiais para colegas, com identificação ou anonimato, em uma experiência moderna, leve e fácil de usar.
        </p>
        <p className="small-note">Uma iniciativa da gincana acadêmica dos cursos de TADS e LEDOC do IFPA.</p>
        <Link className="primary-button" to="/enviar">Enviar Mensagem</Link>
      </section>

      <section className="info-grid">
        <article className="card payment-card">
          <p className="eyebrow">Pagamento</p>
          <h2>PIX ou espécie</h2>
          <p className="lead">Você pode contribuir via PIX ou, se preferir, em espécie diretamente com a comissão.</p>
          <div className="pix-box">
            <div className="qr-wrap">
              <QRCodeSVG value={`PIX:${PIX_KEY}`} size={160} includeMargin={true} />
            </div>
            <div className="pix-details">
              <strong>Chave PIX</strong>
              <p>(93) 99157-4982</p>
              <span className="small-note">Escaneie o QR Code ou use a chave acima para efetuar o pagamento.</span>
            </div>
          </div>
        </article>

        <article className="card contact-card">
          <p className="eyebrow">Fale com a comissão</p>
          <h2>WhatsApp</h2>
          <p className="lead">Para dúvidas, confirmação ou contato direto com a comissão, use o WhatsApp abaixo.</p>
          <a
            className="whatsapp-button"
            href={`https://wa.me/55${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
          >
            💬 Falar com a comissão: (93) 99157-4982
          </a>
          <p className="small-note">Os recados serão lidos no intervalo do dia 11/06.</p>
        </article>
      </section>
    </main>
  );
}
