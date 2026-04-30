import OpenAI from 'openai';
import { env } from '../config/env';
import { getCategoriesByType } from '../models/Category';
import { getToday } from '../utils/dateUtils';

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: env.openai.apiKey,
    });
  }
  return openai;
}

export interface ParsedTransaction {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  confidence: number;
}

export async function parseTransactionMessage(
  userId: number,
  message: string
): Promise<ParsedTransaction | null> {
  try {
    const expenseCategories = await getCategoriesByType(userId, 'expense');
    const incomeCategories = await getCategoriesByType(userId, 'income');

    const expenseNames = expenseCategories.map((c) => c.name).join(', ');
    const incomeNames = incomeCategories.map((c) => c.name).join(', ');

    const today = getToday();

    const systemPrompt = `Voce e a Elsy, assistente financeira brasileira que interpreta mensagens sobre transacoes financeiras
no WhatsApp. Tom: amigavel, direta, frases curtas, sem ser melosa.

Extraia as seguintes informacoes da mensagem do usuario:
- type: "income" (receita/entrada) ou "expense" (despesa/gasto)
- amount: valor numerico (apenas o numero, sem R$ ou virgula como separador decimal - use ponto)
- category: categoria mais apropriada da lista fornecida
- description: descricao curta da transacao
- date: data no formato YYYY-MM-DD (use ${today} se nao especificada)
- confidence: nivel de confianca de 0 a 1

Categorias de despesa disponiveis: ${expenseNames}
Categorias de receita disponiveis: ${incomeNames}

Regras importantes:
- Palavras como "gastei", "paguei", "comprei", "uber", "almoco", "mercado" indicam DESPESA
- Palavras como "recebi", "ganhei", "salario", "vendi", "freelance" indicam RECEITA
- "ontem" significa ${getYesterday()}
- "hoje" significa ${today}
- Valores podem vir como "150", "150,00", "R$ 150", "150 reais"

Responda APENAS com um JSON valido, sem markdown, sem explicacoes.

Exemplo de entrada: "gastei 150 no mercado"
Exemplo de saida: {"type":"expense","amount":150,"category":"Alimentacao","description":"Mercado","date":"${today}","confidence":0.95}`;

    const client = getOpenAI();

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      console.error('Resposta vazia da OpenAI');
      return null;
    }

    // Limpa possíveis caracteres extras
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(cleanContent) as ParsedTransaction;

      // Valida campos obrigatórios
      if (!parsed.type || !parsed.amount || !parsed.category) {
        console.error('Campos obrigatorios faltando:', parsed);
        return null;
      }

      // Normaliza o amount
      if (typeof parsed.amount === 'string') {
        parsed.amount = parseFloat(String(parsed.amount).replace(',', '.'));
      }

      // Garante que a data esta no formato correto
      if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
        parsed.date = today;
      }

      return parsed;
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', cleanContent);
      return null;
    }
  } catch (error) {
    console.error('Erro ao chamar OpenAI:', error);
    return null;
  }
}

function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

export async function isTransactionMessage(message: string): Promise<boolean> {
  // Verifica se a mensagem parece ser uma transação financeira
  const transactionKeywords = [
    'gastei', 'gasto', 'paguei', 'comprei', 'compra', 'despesa',
    'recebi', 'ganhei', 'salario', 'vendi', 'venda', 'receita',
    'uber', 'ifood', 'mercado', 'almoco', 'jantar', 'cafe',
    'conta', 'boleto', 'fatura', 'luz', 'agua', 'internet',
    'reais', 'r$', 'brl'
  ];

  const lowerMessage = message.toLowerCase();

  // Verifica se tem numero (provavelmente um valor)
  const hasNumber = /\d/.test(message);

  // Verifica se tem palavra-chave de transacao
  const hasKeyword = transactionKeywords.some((kw) => lowerMessage.includes(kw));

  return hasNumber && hasKeyword;
}

// =====================================================
// TRANSCRICAO DE AUDIO (Whisper)
// =====================================================

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string | null> {
  try {
    const client = getOpenAI();

    // Cria um File-like object para o Whisper
    const file = new File([audioBuffer], filename, { type: 'audio/ogg' });

    const response = await client.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'pt',
    });

    return response.text;
  } catch (error) {
    console.error('Erro ao transcrever audio:', error);
    return null;
  }
}

// =====================================================
// LEITURA DE IMAGENS/COMPROVANTES (Vision)
// =====================================================

export async function parseReceiptImage(
  userId: number,
  imageBase64: string
): Promise<ParsedTransaction | null> {
  try {
    const expenseCategories = await getCategoriesByType(userId, 'expense');
    const incomeCategories = await getCategoriesByType(userId, 'income');

    const expenseNames = expenseCategories.map((c) => c.name).join(', ');
    const incomeNames = incomeCategories.map((c) => c.name).join(', ');

    const today = getToday();

    const systemPrompt = `Voce e a Elsy, assistente financeira brasileira que analisa comprovantes, notas fiscais e recibos
recebidos no WhatsApp.

Analise a imagem e extraia as informacoes da transacao:
- type: "income" (receita/entrada) ou "expense" (despesa/gasto)
- amount: valor total da transacao (apenas numero, use ponto como separador decimal)
- category: categoria mais apropriada da lista fornecida
- description: descricao curta (nome do estabelecimento ou tipo de compra)
- date: data no formato YYYY-MM-DD (extraia da imagem ou use ${today})
- confidence: nivel de confianca de 0 a 1

Categorias de despesa: ${expenseNames}
Categorias de receita: ${incomeNames}

Tipos de comprovantes que voce pode encontrar:
- Comprovante PIX (extrai valor, destinatario/origem, data)
- Nota fiscal (extrai valor total, estabelecimento, data)
- Recibo de pagamento (extrai valor, descricao, data)
- Fatura de cartao (extrai valor total)
- Boleto (extrai valor, cedente)

Responda APENAS com um JSON valido, sem markdown, sem explicacoes.
Se nao conseguir identificar uma transacao na imagem, responda: {"error": "Nao foi possivel identificar uma transacao nesta imagem"}`;

    const client = getOpenAI();

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Analise este comprovante/recibo e extraia os dados da transacao.',
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      console.error('Resposta vazia da OpenAI Vision');
      return null;
    }

    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(cleanContent);

      if (parsed.error) {
        console.log('Vision nao identificou transacao:', parsed.error);
        return null;
      }

      // Valida campos obrigatórios
      if (!parsed.type || !parsed.amount || !parsed.category) {
        console.error('Campos obrigatorios faltando:', parsed);
        return null;
      }

      // Normaliza o amount
      if (typeof parsed.amount === 'string') {
        parsed.amount = parseFloat(String(parsed.amount).replace(',', '.'));
      }

      // Garante que a data esta no formato correto
      if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
        parsed.date = today;
      }

      return parsed as ParsedTransaction;
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON Vision:', cleanContent);
      return null;
    }
  } catch (error) {
    console.error('Erro ao analisar imagem:', error);
    return null;
  }
}
