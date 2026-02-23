import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY não encontrada no ambiente.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export const getGeminiModel = (modelName: string = "gemini-1.5-flash") => {
    return genAI.getGenerativeModel({ model: modelName });
};

export const generateFinancialInsight = async (financialData: string) => {
    if (!apiKey) return "Chave de API do Gemini não configurada. Adicione VITE_GEMINI_API_KEY no arquivo .env.local";

    try {
        const model = getGeminiModel();
        const prompt = `
      Você é um assistente financeiro sênior para o sistema FinTek.
      Analise os seguintes dados financeiros e forneça um insight curto, direto e motivador (máximo 3 frases).
      Foque em alertar sobre riscos ou sugerir melhorias baseadas nos números fornecidos.
      Trate o usuário com profissionalismo e proximidade.
      
      Dados:
      ${financialData}
      
      Responda em Português do Brasil.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Erro ao gerar insight do Gemini:", error);
        const errorMsg = error?.message || "Erro desconhecido";
        return `Não foi possível gerar insights agora. Erro: ${errorMsg}. Verifique sua conexão e chave de API.`;
    }
};

export const suggestTransactionDetails = async (description: string, suppliers: string[], companies: string[]) => {
    if (!apiKey || !description) return null;

    try {
        const model = getGeminiModel();
        const prompt = `
      Você é um assistente de entrada de dados para o sistema FinTek.
      Com base na descrição do lançamento abaixo, sugira qual Fornecedor e qual Empresa são os mais prováveis.
      
      Descrição: "${description}"
      
      Lista de Fornecedores disponíveis: [${suppliers.join(", ")}]
      Lista de Empresas disponíveis: [${companies.join(", ")}]
      
      Responda EXATAMENTE no formato JSON:
      {
        "supplier": "NOME_DO_FORNECEDOR_SUGERIDO_EXATAMENTE_COMO_NA_LISTA",
        "company": "NOME_DA_EMPRESA_SUGERIDA_EXATAMENTE_COMO_NA_LISTA",
        "reason": "UMA_FRASE_CURTA_EXPLICANDO_O_PORQUE"
      }
      Se não tiver certeza, sugira os que mais se aproximam ou deixe vazio se nenhum fizer sentido.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Erro ao sugerir detalhes com Gemini:", error);
        return null;
    }
};
