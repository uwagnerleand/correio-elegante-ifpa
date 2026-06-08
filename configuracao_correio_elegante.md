# Manual de Configuração - Correio Elegante Digital 2026

Este guia ensina como integrar o sistema de **Correio Elegante** com o **Mercado Pago (PIX Online)**, enviando as mensagens automaticamente para a tela administrativa e salvando-as em uma planilha do Google como backup.

---

## 📊 Passo 1: Configurar a Planilha do Google (Backup das Mensagens)
As mensagens pagas e aprovadas serão salvas automaticamente em uma planilha para fácil leitura ou impressão.

### 1. Criar a Planilha
1. Crie uma nova planilha no Google Planilhas.
2. Defina os cabeçalhos das colunas de **A1 até H1**:
   - **A1**: `Data/Hora`
   - **B1**: `ID da Mensagem`
   - **C1**: `Destinatário`
   - **D1**: `Remetente`
   - **E1**: `Anônimo`
   - **F1**: `Autoriza Revelação`
   - **G1**: `Mensagem`
   - **H1**: `Status`

### 2. Configurar o Apps Script
1. Na planilha, clique em **Extensões** ➔ **Apps Script**.
2. Cole o código a seguir no editor:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  try {
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      new Date(),
      data.id || '',
      data.destinatario || '',
      data.remetente || 'Anônimo',
      data.anonimo ? 'Sim' : 'Não',
      data.autoriza_revelacao ? 'Sim' : 'Não',
      data.mensagem || '',
      data.status || 'Pendente'
    ]);
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  if (e.parameter.action === 'create_pix') {
    var price = parseFloat(e.parameter.price || "2.00");
    return createMercadoPagoPix(price);
  }
  if (e.parameter.action === 'check_payment') {
    return checkPaymentStatus(e.parameter.id);
  }
  return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Acao invalida" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createMercadoPagoPix(price) {
  var token = PropertiesService.getScriptProperties().getProperty("MP_ACCESS_TOKEN");
  var url = "https://api.mercadopago.com/v1/payments";
  var idempotency = Utilities.getUuid();
  var payload = {
    "transaction_amount": price,
    "description": "Correio Elegante IFPA 2026",
    "payment_method_id": "pix",
    "payer": { "email": "pagador@correio.com" }
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + token,
      "X-Idempotency-Key": idempotency
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  Logger.log("Criando PIX MP: " + JSON.stringify(payload));
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  Logger.log("Resposta MP: " + code + " - " + text);
  var json = JSON.parse(text);
  if (code === 201 || code === 200) {
    var txData = json.point_of_interaction.transaction_data;
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success",
      "payment_id": String(json.id),
      "qr_code": txData.qr_code,
      "qr_code_base64": txData.qr_code_base64
    })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({
    "result": "error",
    "details": json.message || text
  })).setMimeType(ContentService.MimeType.JSON);
}

function checkPaymentStatus(paymentId) {
  var token = PropertiesService.getScriptProperties().getProperty("MP_ACCESS_TOKEN");
  var url = "https://api.mercadopago.com/v1/payments/" + paymentId;
  var options = {
    "method": "get",
    "headers": { "Authorization": "Bearer " + token },
    "muteHttpExceptions": true
  };
  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  Logger.log("Status pagamento " + paymentId + ": " + json.status);
  return ContentService.createTextOutput(JSON.stringify({
    "result": "success",
    "status": json.status || "pending"
  })).setMimeType(ContentService.MimeType.JSON);
}
```

3. Clique em **Salvar 💾**.
4. No menu lateral esquerdo, clique na **Engrenagem ⚙️ (Configurações do Projeto)**.
5. Role até **Propriedades do script** e adicione:
   - Propriedade: `MP_ACCESS_TOKEN`
   - Valor: Seu Token de Produção do Mercado Pago (`APP_USR-...`)
6. Clique em **Implantar** ➔ **Nova implantação** ➔ Selecione **App da Web**:
   - **Executar como:** `Eu`
   - **Quem tem acesso:** `Qualquer pessoa`
7. Conceda as autorizações e copie a **URL do App da Web** gerada.

---

## ⚡ Passo 2: Configurar o Banco de Dados (Supabase)
O Supabase serve para alimentar a tela administrativa (`/admin`) do site de forma instantânea.

### 1. Criar a Tabela no Supabase
1. Entre no seu painel do [Supabase](https://supabase.com).
2. Vá em **SQL Editor** no painel lateral esquerdo.
3. Clique em **New Query** e cole o seguinte comando SQL para criar a tabela de mensagens:

```sql
create table mensagens (
  id text primary key,
  destinatario text not null,
  remetente text,
  anonimo boolean not null default false,
  autoriza_revelacao boolean not null default false,
  mensagem text not null,
  status text not null default 'Pendente',
  data_envio timestamp with time zone not null default now()
);

-- Habilitar leitura pública e escrita (ou configurar políticas RLS)
alter table mensagens enable row level security;
create policy "Acesso livre para inserção" on mensagens for insert with check (true);
create policy "Acesso livre para leitura" on mensagens for select using (true);
create policy "Acesso livre para atualização" on mensagens for update using (true);
create policy "Acesso livre para exclusão" on mensagens for delete using (true);
```
4. Clique em **Run** no canto inferior direito para rodar o script SQL.

---

## ⚙️ Passo 3: Configurar as Credenciais no Projeto (`.env`)
Abra o arquivo `.env` no seu projeto `correio-elegante-ifpa` e insira as credenciais do seu Supabase e a URL do Apps Script que você gerou:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-do-supabase
VITE_GOOGLE_SCRIPT_URL=SUA_URL_DO_APPS_SCRIPT_AQUI
VITE_MESSAGE_PRICE=2.00
```

*Dica:* O preço da mensagem (`VITE_MESSAGE_PRICE`) pode ser alterado para o valor que você desejar (ex: `2.00`, `3.00`, etc.).
