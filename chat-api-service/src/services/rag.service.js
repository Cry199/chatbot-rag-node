const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const geminiChatModel = genAI.getGenerativeModel({ model: config.models.chat });
const geminiEmbeddingModel = genAI.getGenerativeModel({ model: config.models.embedding });

const pinecone = new Pinecone({ apiKey: config.pineconeApiKey });
const pineconeIndex = pinecone.index(config.pineconeIndexName, config.pineconeHost);

async function findRelevantChunks(queryEmbedding) {
    console.log("[Service] A procurar chunks relevantes no Pinecone...");
    try {
        const queryResponse = await pineconeIndex.query({
            vector: queryEmbedding,
            topK: 5,
            includeMetadata: true,
        });
        return queryResponse.matches.map(match => match.metadata?.source_text || '');
    } catch (error) {
        console.error("[Service] Erro ao consultar o Pinecone:", error);
        return [];
    }
}

async function transformQueryWithHistory(query, history) {
    if (!history || history.length === 0) { return query; }
    const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');
    const prompt = `Com base no histórico da conversa e na nova pergunta, reformule a nova pergunta para que seja uma **pergunta autônoma e específica**, ideal para uma busca semântica.\n\nHISTÓRICO:\n${historyText}\n\nNOVA PERGUNTA: ${query}\n\nPERGUNTA REFORMULADA:`;
    try {
        const result = await geminiChatModel.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("[Service] Erro ao transformar a consulta, usando a original.", error);
        return query;
    }
}

async function generateQueryEmbedding(query) {
    const result = await geminiEmbeddingModel.embedContent({ content: { parts: [{ text: query }] }, taskType: "RETRIEVAL_QUERY" });
    return result.embedding.values;
}

function buildAugmentedPrompt(originalQuery, relevantChunks, history) {
    const context = relevantChunks.join('\n\n---\n\n');
    const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');
    return `Você é um assistente especialista e preciso. Sua tarefa é responder à pergunta do usuário.\n\n**Regras Importantes:**\n1.  Baseie-se **exclusivamente** no **CONTEXTO** fornecido abaixo para responder à pergunta.\n2.  Considere o **HISTÓRICO DA CONVERSA** para entender perguntas subsequentes (ex: "e sobre ele?").\n3.  Não utilize nenhum conhecimento prévio que não esteja no contexto.\n\n**CONTEXTO DOS DOCUMENTOS:**\n---\n${context}\n---\n\n**HISTÓRICO DA CONVERSA:**\n${historyText}\n\n**PERGUNTA ATUAL:**\n${originalQuery}\n\nSe a resposta não estiver contida no contexto, diga claramente: "Com base nos documentos fornecidos, não consigo responder a essa pergunta."`;
}

async function processQuery(query, history) {
    const searchQuery = await transformQueryWithHistory(query, history);
    const queryEmbedding = await generateQueryEmbedding(searchQuery);
    const relevantChunks = await findRelevantChunks(queryEmbedding);
    const augmentedPrompt = buildAugmentedPrompt(query, relevantChunks, history);
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

module.exports = { processQuery };