require('dotenv').config();

const config = {
    chromaDbHost: 'http://localhost:8000',
    chromaCollectionName: 'chatbot-docs',
    geminiApiKey: process.env.GEMINI_API_KEY,
    port: process.env.PORT || 8080,
    models: {
        chat: "gemini-2.5-flash",
        embedding: "text-embedding-004"
    }
};

module.exports = config;