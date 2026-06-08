import type { MessageRecord } from '../types';

const placeholderUrl = 'https://script.google.com/macros/s/SUA_URL_DO_WEB_APP/exec';

export function hasGoogleSheetsIntegration() {
  const googleSheetsUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
  return Boolean(googleSheetsUrl && googleSheetsUrl !== placeholderUrl);
}

export async function saveApprovedMessageToSheet(message: MessageRecord): Promise<void> {
  const googleSheetsUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

  if (!hasGoogleSheetsIntegration()) return;

  await fetch(googleSheetsUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: message.id,
      destinatario: message.destinatario,
      remetente: message.remetente || 'Anonimo',
      anonimo: message.anonimo,
      autoriza_revelacao: message.autoriza_revelacao,
      mensagem: message.mensagem,
      status: 'Aprovada',
    }),
  });
}
