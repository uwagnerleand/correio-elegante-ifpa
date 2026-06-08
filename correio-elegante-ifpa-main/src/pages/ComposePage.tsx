import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { sendMessage, updateMessageStatus } from '../services/supabase';
import { hasGoogleSheetsIntegration, saveApprovedMessageToSheet } from '../services/googleSheets';
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
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'simple' | 'chocolate' | 'flor'>('simple');

  const productOptions = [
    { id: 'simple', label: 'Mensagem simples', description: 'R$ 2,00', price: 2 },
    { id: 'chocolate', label: 'Mensagem com chocolate', description: 'R$ 5,00', price: 5 },
    { id: 'flor', label: 'Mensagem com flor', description: 'R$ 7,00', price: 7 },
  ] as const;

  const selectedProduct = productOptions.find((item) => item.id === selectedOption) ?? productOptions[0];
  const selectedPrice = selectedProduct.price;

  // Mercado Pago Payment States
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState('');
  const [pixStatus, setPixStatus] = useState<'idle' | 'generating' | 'waiting' | 'approved' | 'failed'>('idle');
  const [activeMessage, setActiveMessage] = useState<any>(null);
  const [pollingId, setPollingId] = useState<any>(null);

  const charsLeft = useMemo(() => 250 - message.length, [message.length]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingId) clearInterval(pollingId);
    };
  }, [pollingId]);

  async function startPaymentPolling(paymentId: string, messageRecord: any) {
    if (pollingId) clearInterval(pollingId);

    const googleSheetsUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    if (!googleSheetsUrl) return;

    const interval = setInterval(async () => {
      try {
        const url = `${googleSheetsUrl}?action=check_payment&id=${paymentId}`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.result === 'success' && (json.status === 'approved' || json.status === 'paid')) {
          clearInterval(interval);
          setPollingId(null);
          setPixStatus('approved');
          setFeedback('✓ Pagamento confirmado automaticamente! Sua mensagem foi enviada e autorizada.');

          // 1. Update Supabase
          try {
            await updateMessageStatus(messageRecord.id, 'Aprovada');
          } catch (e) {
            console.error('Erro ao atualizar status no Supabase:', e);
          }

          // 2. Post to Google Sheets
          try {
            await saveApprovedMessageToSheet({ ...messageRecord, status: 'Aprovada' });
          } catch (e) {
            console.error('Erro ao salvar cópia na planilha:', e);
          }
        }
      } catch (e) {
        console.error('Erro ao consultar status do Pix:', e);
      }
    }, 3000);

    setPollingId(interval);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFeedback('');
    setShowPaymentInfo(false);
    setPixStatus('idle');
    setPixQrCode('');
    setPixQrCodeUrl('');
    setPixPaymentId('');
    if (pollingId) {
      clearInterval(pollingId);
      setPollingId(null);
    }

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
      // 1. Save to Supabase (Pending state)
      const createdMessage = await sendMessage({
        destinatario: recipientName.trim(),
        remetente: identification === 'identified' ? senderName.trim() : null,
        anonimo: identification === 'anonymous',
        autoriza_revelacao: consent,
        mensagem: message.trim(),
      });

      setActiveMessage(createdMessage);
      setShowPaymentInfo(true);

      const googleSheetsUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
      const messagePrice = selectedPrice.toFixed(2);

      if (hasGoogleSheetsIntegration()) {
        setPixStatus('generating');
        
        try {
          const response = await fetch(`${googleSheetsUrl}?action=create_pix&price=${messagePrice}`);
          const json = await response.json();

          if (json.result === 'success') {
            setPixQrCode(json.qr_code);
            setPixQrCodeUrl(json.qr_code_base64 ? `data:image/png;base64,${json.qr_code_base64}` : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(json.qr_code)}`);
            setPixPaymentId(json.payment_id);
            setPixStatus('waiting');
            setFeedback('Mensagem criada! Pague o PIX abaixo para autorizar o envio automático.');
            
            // Start listening for payments
            startPaymentPolling(json.payment_id, createdMessage);
          } else {
            setPixStatus('failed');
            setError('Ocorreu um erro na API do Mercado Pago. Efetue o Pix manual com os organizadores.');
          }
        } catch (apiErr) {
          console.error('Erro na chamada da API Apps Script:', apiErr);
          setPixStatus('failed');
          setError('Conexão falhou ao gerar o Pix Online. Efetue o Pix manual com os organizadores.');
        }
      } else {
        // Fallback to manual static Pix (original flow)
        setPixStatus('idle');
        setFeedback(`Mensagem enviada! Pague R$ ${messagePrice} via PIX com a comissão para liberar a leitura.`);
      }

      setRecipientName('');
      setIdentification('identified');
      setSenderName('');
      setSelectedOption('simple');
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

          <fieldset>
            <legend>Escolha o produto</legend>
            {productOptions.map((option) => (
              <label key={option.id} className="radio-row">
                <input
                  type="radio"
                  name="product"
                  value={option.id}
                  checked={selectedOption === option.id}
                  onChange={() => setSelectedOption(option.id)}
                />
                <span>{option.label} — <strong>{option.description}</strong></span>
              </label>
            ))}
          </fieldset>

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

          {showPaymentInfo && (
            <article className="payment-card compact-card" style={{ width: '100%' }}>
              <p className="eyebrow">Autorização via PIX</p>
              
              {pixStatus === 'generating' && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  <div className="spinner" style={{ border: '3px solid rgba(233, 30, 99, 0.1)', borderTop: '3px solid #E91E63', borderRadius: '50%', width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 10px' }}></div>
                  <p className="lead" style={{ fontSize: '14px' }}>Gerando o seu QR Code PIX Online...</p>
                </div>
              )}

              {pixStatus === 'waiting' && (
                <div>
                  <h2 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Escaneie para enviar a mensagem</h2>
                  <p className="lead" style={{ fontSize: '13.5px', marginBottom: '1.2rem', color: '#555' }}>
                    {selectedProduct.label} — <strong>R$ {selectedPrice.toFixed(2)}</strong>. O pagamento é identificado na hora e, assim que aprovado, a mensagem será liberada.
                  </p>
                  <div className="pix-box compact-pix-box" style={{ padding: '1rem', background: '#fff7fa', border: '1px solid #f3c3d7', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div className="qr-wrap" style={{ background: '#fff', padding: '10px', borderRadius: '12px', border: '1px solid #f1dbe6' }}>
                      <img src={pixQrCodeUrl} style={{ width: 160, height: 160, display: 'block' }} alt="QR Code PIX" />
                    </div>
                    <div className="pix-details" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#E91E63', fontSize: '14px' }}>PIX Copia e Cola</strong>
                      <div style={{ display: 'flex', width: '100%', gap: '8px', maxWidth: '320px' }}>
                        <input 
                          type="text" 
                          value={pixQrCode} 
                          readOnly 
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          style={{ fontSize: '12px', background: 'rgba(255,255,255,0.7)', padding: '8px', borderRadius: '8px', border: '1px solid #f3c3d7', flex: 1, textOverflow: 'ellipsis' }} 
                        />
                        <button 
                          type="button" 
                          onClick={() => { navigator.clipboard.writeText(pixQrCode); alert('Código PIX Copiado!'); }} 
                          className="primary-button" 
                          style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap', borderRadius: '8px' }}
                        >
                          Copiar
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', color: '#E91E63', fontWeight: 'bold', fontSize: '13px' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, background: '#E91E63', borderRadius: '50%', animation: 'pulse 1.5s infinite', alignSelf: 'center' }}></span>
                        Aguardando pagamento no banco...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {pixStatus === 'approved' && (
                <div style={{ padding: '1.5rem', background: '#e8f5e9', border: '1.5px solid #2e7d32', borderRadius: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                  <h3 style={{ color: '#1b5e20', margin: '0 0 6px 0', fontSize: '16px' }}>Pagamento Aprovado!</h3>
                  <p style={{ color: '#2e7d32', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                    O sistema confirmou o PIX. A mensagem foi enviada à comissão de TADS/LEDOC e está liberada para leitura!
                  </p>
                </div>
              )}

              {(pixStatus === 'idle' || pixStatus === 'failed') && (
                <div>
                  <h2 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Finalize o pagamento com a comissão</h2>
                  <p className="lead" style={{ fontSize: '13.5px', marginBottom: '1.2rem', color: '#555' }}>
                    {selectedProduct.label} — <strong>R$ {selectedPrice.toFixed(2)}</strong>. A mensagem ficará pendente até você fazer o PIX manual para a comissão e confirmarem o pagamento.
                  </p>
                  <div className="pix-box compact-pix-box">
                    <div className="qr-wrap">
                      <QRCodeSVG value={`PIX:93991574982?amount=${selectedPrice.toFixed(2)}`} size={150} includeMargin />
                    </div>
                    <div className="pix-details">
                      <strong>Chave PIX</strong>
                      <p>(93) 99157-4982</p>
                      <span className="small-note">Após realizar o pagamento, avise a comissão organizadora.</span>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )}

          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar Mensagem'}</button>
        </form>

        <Link className="ghost-button" to="/">Voltar para a Home</Link>
      </section>
    </main>
  );
}
