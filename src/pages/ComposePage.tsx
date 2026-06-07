import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendMessage } from '../services/supabase';
import { containsForbiddenTerms } from '../utils/moderation';

export default function ComposePage() {
  const [recipientName, setRecipientName] = useState('');
  const [identification, setIdentification] = useState<'identified' | 'anonymous'>('identified');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const charsLeft = useMemo(() => 250 - message.length, [message.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFeedback('');

    if (!recipientName.trim()) {
      setError('Digite o nome do destinatário para continuar.');
      return;
    }

    if (!message.trim()) {
      setError('A mensagem é obrigatória.');
      return;
    }

    if (message.length > 250) {
      setError('A mensagem pode ter no máximo 250 caracteres.');
      return;
    }

    if (identification === 'identified' && !senderName.trim()) {
      setError('Informe seu nome para se identificar.');
      return;
    }

    if (containsForbiddenTerms(message)) {
      setError('Sua mensagem contém termos não permitidos.');
      return;
    }

    setSubmitting(true);

    try {
      await sendMessage({
        destinatario: recipientName.trim(),
        remetente: identification === 'identified' ? senderName.trim() : null,
        anonimo: identification === 'anonymous',
        autoriza_revelacao: consent,
        mensagem: message.trim(),
      });

      setFeedback('Mensagem enviada com sucesso! Ela será analisada pela organização da gincana.');
      setRecipientName('');
      setIdentification('identified');
      setSenderName('');
      setMessage('');
      setConsent(false);
    } catch (err) {
      setError('Não foi possível enviar a mensagem neste momento.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="card form-card">
        <p className="eyebrow">Envio de mensagem</p>
        <h1>Escreva para alguém especial</h1>
        <p className="lead">Escolha o destinatário, decida sobre a identificação e envie sua mensagem com segurança.</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Destinatário
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Digite o nome do estudante" required />
          </label>

          <fieldset>
            <legend>Identificação</legend>
            <label className="radio-row"><input type="radio" name="identification" checked={identification === 'identified'} onChange={() => setIdentification('identified')} /> Quero me identificar</label>
            <label className="radio-row"><input type="radio" name="identification" checked={identification === 'anonymous'} onChange={() => setIdentification('anonymous')} /> Enviar anonimamente</label>
          </fieldset>

          {identification === 'identified' && (
            <label>
              Nome do remetente
              <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Seu nome completo" />
            </label>
          )}

          <label>
            Mensagem
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={250} rows={6} placeholder="Escreva sua mensagem aqui..." />
            <span className={charsLeft < 0 ? 'counter negative' : 'counter'}>{message.length}/250 caracteres</span>
          </label>

          {identification === 'identified' && (
            <label className="checkbox-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Autorizo que meu nome seja revelado durante a leitura pública da mensagem.
            </label>
          )}

          {error && <p className="alert error">{error}</p>}
          {feedback && <p className="alert success">{feedback}</p>}

          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar Mensagem'}</button>
        </form>

        <Link className="ghost-button" to="/">Voltar para a Home</Link>
      </section>
    </main>
  );
}
