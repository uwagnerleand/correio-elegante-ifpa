import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { deleteMessage, loadMessages, updateMessageStatus } from '../services/supabase';
import { saveApprovedMessageToSheet } from '../services/googleSheets';
import type { MessageRecord } from '../types';

const ADMIN_PASSWORD = 'tadsledoc2026';

export default function AdminPage() {
  const [isLogged, setIsLogged] = useState(false);
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [filter, setFilter] = useState<'Todos' | 'Pendente' | 'Aprovada' | 'Rejeitada' | 'Lida'>('Todos');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isLogged) return;
    loadMessages().then(setMessages).catch(() => setMessages([]));
  }, [isLogged]);

  const filteredMessages = useMemo(() => {
    return messages.filter((item) => {
      const matchesFilter = filter === 'Todos' || item.status === filter;
      const haystack = `${item.destinatario} ${item.remetente ?? ''} ${item.mensagem}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [filter, messages, query]);

  const stats = useMemo(() => {
    return {
      total: messages.length,
      pendentes: messages.filter((item) => item.status === 'Pendente').length,
      aprovadas: messages.filter((item) => item.status === 'Aprovada').length,
      rejeitadas: messages.filter((item) => item.status === 'Rejeitada').length,
      lidas: messages.filter((item) => item.status === 'Lida').length,
    };
  }, [messages]);

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLogged(true);
      setPassword('');
    }
  }

  async function handleStatusChange(id: string, status: MessageRecord['status']) {
    const currentMessage = messages.find((item) => item.id === id);

    await updateMessageStatus(id, status);
    setMessages((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));

    if (status === 'Aprovada' && currentMessage && currentMessage.status !== 'Aprovada') {
      try {
        await saveApprovedMessageToSheet({ ...currentMessage, status });
      } catch (error) {
        console.error('Erro ao salvar copia na planilha:', error);
      }
    }
  }

  async function handleDelete(id: string) {
    await deleteMessage(id);
    setMessages((prev) => prev.filter((item) => item.id !== id));
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Correio Elegante Digital IFPA', 40, 40);
    doc.setFontSize(11);
    doc.text('Gincana Acadêmica • Organização: TADS e LEDOC', 40, 60);
    doc.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 76);

    let y = 110;
    filteredMessages.forEach((item, index) => {
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${item.destinatario}`, 40, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.text(`Remetente: ${item.remetente ?? 'Anônimo'}`, 50, y);
      y += 14;
      doc.text(`Status: ${item.status} • Data: ${new Date(item.data_envio).toLocaleString('pt-BR')}`, 50, y);
      y += 14;
      const lines = doc.splitTextToSize(item.mensagem, pageWidth - 90);
      doc.text(lines, 50, y);
      y += lines.length * 14 + 18;
    });

    doc.save('relatorio-correio-ifpa.pdf');
  }

  if (!isLogged) {
    return (
      <main className="page-shell">
        <section className="card form-card">
          <p className="eyebrow">Painel administrativo</p>
          <h1>Acesso restrito</h1>
          <p className="lead">Informe a senha da comissão organizadora para visualizar e moderar as mensagens.</p>
          <form onSubmit={handleLogin} className="form-grid">
            <label>
              Senha
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de acesso" />
            </label>
            <button className="primary-button" type="submit">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="card admin-card">
        <div className="admin-header">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1>Dashboard da comissão</h1>
          </div>
          <button className="ghost-button" onClick={() => setIsLogged(false)}>Sair</button>
        </div>

        <div className="stats-grid">
          <article className="stat-card"><strong>{stats.total}</strong><span>Total</span></article>
          <article className="stat-card"><strong>{stats.pendentes}</strong><span>Pendentes</span></article>
          <article className="stat-card"><strong>{stats.aprovadas}</strong><span>Aprovadas</span></article>
          <article className="stat-card"><strong>{stats.rejeitadas}</strong><span>Rejeitadas</span></article>
          <article className="stat-card"><strong>{stats.lidas}</strong><span>Lidas</span></article>
        </div>

        <div className="toolbar">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar destinatário ou remetente" />
          <div className="chip-row">
            {(['Todos', 'Pendente', 'Aprovada', 'Rejeitada', 'Lida'] as const).map((item) => (
              <button key={item} className={filter === item ? 'chip active' : 'chip'} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <button className="primary-button" onClick={exportPdf}>Exportar PDF</button>
        </div>

        <div className="message-list">
          {filteredMessages.map((item) => (
            <article key={item.id} className="message-card">
              <div>
                <p className="message-label">Destinatário</p>
                <h3>{item.destinatario}</h3>
                <p className="message-meta">Remetente: {item.remetente ?? 'Anônimo'} • {new Date(item.data_envio).toLocaleString('pt-BR')}</p>
                <p className="message-body">{item.mensagem}</p>
              </div>
              <div className="message-actions">
                <span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span>
                <button className="ghost-button" onClick={() => handleStatusChange(item.id, 'Aprovada')}>Aprovar</button>
                <button className="ghost-button" onClick={() => handleStatusChange(item.id, 'Rejeitada')}>Rejeitar</button>
                <button className="ghost-button" onClick={() => handleStatusChange(item.id, 'Lida')}>Marcar como lida</button>
                <button className="ghost-button danger" onClick={() => handleDelete(item.id)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
