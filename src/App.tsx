import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ComposePage from './pages/ComposePage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">Correio Elegante Digital IFPA</Link>
        <nav className="nav-links">
          <Link to="/">Início</Link>
          <Link to="/enviar">Enviar</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/enviar" element={<ComposePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>

      <footer className="footer-card">
        <p>IFPA • Correio Elegante Digital</p>
        <p>Organização: TADS e LEDOC • Ano do evento: 2026</p>
      </footer>
    </div>
  );
}
