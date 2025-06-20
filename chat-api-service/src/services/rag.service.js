const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ChromaClient } = require('chromadb');
const config = require('../config');

// --- CLIENTES DAS APIS ---
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const geminiChatModel = genAI.getGenerativeModel({ model: config.models.chat });
const geminiEmbeddingModel = genAI.getGenerativeModel({ model: config.models.embedding });

const chromaClient = new ChromaClient({
    path: config.chromaDbHost 
});


async function transformQueryWithHistory(query, history) {
    if (!history || history.length === 0) {
        return query; // Se não há histórico, usa a pergunta original.
    }

    const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');

    const prompt = `Com base no histórico da conversa e na nova pergunta, reformule a nova pergunta para que seja uma **pergunta autônoma e específica**, ideal para uma busca semântica.

HISTÓRICO:
${historyText}

NOVA PERGUNTA: ${query}

PERGUNTA REFORMULADA:`;

    console.log("[Service] Transformando a consulta com base no histórico...");
    try {
        const result = await geminiChatModel.generateContent(prompt);
        const transformedQuery = result.response.text();
        console.log(`[Service] Consulta transformada: "${transformedQuery}"`);
        return transformedQuery;
    } catch (error) {
        console.error("[Service] Erro ao transformar a consulta, usando a original.", error);
        return query; // Em caso de erro, recorre à pergunta original.
    }
}


async function generateQueryEmbedding(query) {
    console.log("[Service] Gerando embedding da consulta...");
    const result = await geminiEmbeddingModel.embedContent({
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY"
    });
    return result.embedding.values;
}

async function findRelevantChunks(queryEmbedding) {
    console.log("[Service] Buscando chunks relevantes no ChromaDB...");
    try {
        const collection = await chromaClient.getCollection({ name: config.chromaCollectionName });
        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: 5
        });
        return results.metadatas[0].map(item => item.source_text);
    } catch (error) {
        console.error("[Service] Erro ao consultar o ChromaDB:", error);
        return [];
    }
}

function buildAugmentedPrompt(originalQuery, relevantChunks, history) {
    console.log("[Service] Construindo prompt aumentado com histórico...");
    const context = relevantChunks.join('\n\n---\n\n');
    
    // Formata o histórico para ser incluído no prompt
    const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');

    return `
Você é um assistente especialista e preciso. Sua tarefa é responder à pergunta do usuário.

**Regras Importantes:**
1.  Baseie-se **exclusivamente** no **CONTEXTO** fornecido abaixo para responder à pergunta.
2.  Considere o **HISTÓRICO DA CONVERSA** para entender perguntas subsequentes (ex: "e sobre ele?").
3.  Não utilize nenhum conhecimento prévio que não esteja no contexto.

**CONTEXTO DOS DOCUMENTOS:**
---
${context}
---

**HISTÓRICO DA CONVERSA:**
${historyText}

**PERGUNTA ATUAL:**
${originalQuery}

Se a resposta não estiver contida no contexto, diga claramente: "Com base nos documentos fornecidos, não consigo responder a essa pergunta."
`;
}

async function processQuery(query, history) {
    const searchQuery = await transformQueryWithHistory(query, history);
    
    const queryEmbedding = await generateQueryEmbedding(searchQuery);

    const relevantChunks = await findRelevantChunks(queryEmbedding);
    const augmentedPrompt = buildAugmentedPrompt(query, relevantChunks, history);

    console.log("[Service] Enviando prompt para o Gemini e iniciando o streaming...");
    const result = await geminiChatModel.generateContentStream(augmentedPrompt);
    
    async function* getStream() {
        for await (const chunk of result.stream) {
            yield chunk.text();
        }
    }
    
    return {
        stream: getStream(),
        sources: relevantChunks
    };
}

async function startHeartbeat() {
    try {
        // Faz uma verificação inicial para garantir que a conexão funciona.
        const hb = await chromaClient.heartbeat();
        console.log('[Service] Conexão inicial com ChromaDB bem-sucedida. Heartbeat nanoseconds:', hb);

        // Define um intervalo para pingar o DB a cada 5 minutos
        setInterval(async () => {
            try {
                await chromaClient.heartbeat();
                console.log('[Heartbeat] Ping para ChromaDB OK.');
            } catch (e) {
                console.error("[Heartbeat] Ping para ChromaDB falhou:", e.message);
            }
        }, 300000); 

    } catch (e) {
        console.error("ERRO CRÍTICO: Não foi possível conectar ao ChromaDB na inicialização.", e.message);
        console.error("Certifique-se de que o contêiner do Docker do ChromaDB está rodando.");
        process.exit(1);
    }
}

module.exports = {
    processQuery,
    startHeartbeat
};