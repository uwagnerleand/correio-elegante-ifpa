import { createClient } from '@supabase/supabase-js';
import type { MessageRecord, Recipient } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEY = 'correio-elegante-messages';
const RECIPIENTS_KEY = 'correio-elegante-recipients';

const fallbackRecipients: Recipient[] = [
  { id: '1', nome: 'João Silva', curso: 'ADS' },
  { id: '2', nome: 'Maria Souza', curso: 'Informática' },
  { id: '3', nome: 'Carlos Oliveira', curso: 'Meio Ambiente' },
  { id: '4', nome: 'Ana Costa', curso: 'Design' },
];

function readLocalMessages(): MessageRecord[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function writeLocalMessages(messages: MessageRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export async function loadRecipients(): Promise<Recipient[]> {
  if (!supabase) return fallbackRecipients;
  const { data, error } = await supabase.from('destinatarios').select('id, nome, curso');
  if (error || !data) return fallbackRecipients;
  return data as Recipient[];
}

export async function sendMessage(payload: {
  id?: string;
  destinatario: string;
  remetente: string | null;
  anonimo: boolean;
  autoriza_revelacao: boolean;
  mensagem: string;
}): Promise<MessageRecord> {
  const message: MessageRecord = {
    id: payload.id || crypto.randomUUID(),
    destinatario: payload.destinatario,
    remetente: payload.anonimo ? null : (payload.remetente ?? null),
    anonimo: payload.anonimo,
    autoriza_revelacao: payload.autoriza_revelacao,
    mensagem: payload.mensagem,
    status: 'Pendente',
    data_envio: new Date().toISOString(),
  };

  if (!supabase) {
    const current = readLocalMessages();
    writeLocalMessages([message, ...current]);
    return message;
  }

  const { data, error } = await supabase.from('mensagens').insert([message]).select().single();
  if (error) throw error;
  return data as MessageRecord;
}

export async function loadMessages(): Promise<MessageRecord[]> {
  if (!supabase) return readLocalMessages().sort((a, b) => Date.parse(b.data_envio) - Date.parse(a.data_envio));

  const { data, error } = await supabase.from('mensagens').select('*').order('data_envio', { ascending: false });
  if (error || !data) return readLocalMessages();
  return data as MessageRecord[];
}

export async function updateMessageStatus(id: string, status: MessageRecord['status']): Promise<void> {
  if (!supabase) {
    const current = readLocalMessages();
    const next = current.map((item) => item.id === id ? { ...item, status } : item);
    writeLocalMessages(next);
    return;
  }

  const { error } = await supabase.from('mensagens').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteMessage(id: string): Promise<void> {
  if (!supabase) {
    const current = readLocalMessages();
    writeLocalMessages(current.filter((item) => item.id !== id));
    return;
  }

  const { error } = await supabase.from('mensagens').delete().eq('id', id);
  if (error) throw error;
}
