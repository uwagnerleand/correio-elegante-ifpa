import { Link } from 'react-router-dom';

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
    </main>
  );
}
