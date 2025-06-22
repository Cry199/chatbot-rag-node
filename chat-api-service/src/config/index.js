require('dotenv').config();

const requiredEnvVars = ['GEMINI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_HOST'];
for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        throw new Error(`ERRO DE CONFIGURAÇÃO: A variável de ambiente obrigatória está em falta: ${varName}`);
    }
}

const config = {
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeEnvironment: process.env.PINECONE_ENVIRONMENT,
    pineconeIndexName: 'chatbot-rag-index',

    geminiApiKey: process.env.GEMINI_API_KEY,
    port: process.env.PORT || 8080,
    models: {
        chat: "gemini-2.5-flash",
        embedding: "text-embedding-004"
    },
};

module.exports = config;