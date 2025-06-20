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
        process.exit(1); // Encerra o processo se a conexão inicial falhar.
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

function buildAugmentedPrompt(originalQuery, relevantChunks) {
    console.log("[Service] Construindo prompt aumentado...");
    const context = relevantChunks.join('\n\n---\n\n');
    return `
Você é um assistente especialista e preciso. Sua tarefa é responder à pergunta do usuário baseando-se *exclusivamente* no contexto fornecido abaixo. Não utilize nenhum conhecimento prévio.

**CONTEXTO:**
---
${context}
---

**PERGUNTA:**
${originalQuery}

Se a resposta não estiver contida no contexto, diga claramente: "Com base nos documentos fornecidos, não consigo responder a essa pergunta."
`;
}

async function processQuery(query) {
    const queryEmbedding = await generateQueryEmbedding(query);
    const relevantChunks = await findRelevantChunks(queryEmbedding);
    const augmentedPrompt = buildAugmentedPrompt(query, relevantChunks);

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

module.exports = {
    processQuery,
    startHeartbeat // Exporta a nova função
};