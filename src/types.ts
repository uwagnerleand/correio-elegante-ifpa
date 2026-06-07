export type MessageStatus = 'Pendente' | 'Aprovada' | 'Rejeitada' | 'Lida';

export type MessageRecord = {
  id: string;
  destinatario: string;
  remetente: string | null;
  anonimo: boolean;
  autoriza_revelacao: boolean;
  mensagem: string;
  status: MessageStatus;
  data_envio: string;
};

export type Recipient = {
  id: string;
  nome: string;
  curso: string;
};
