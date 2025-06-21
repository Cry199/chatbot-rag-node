const { GoogleGenerativeAI } = require('@google/generative-ai');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { ChromaClient } = require('chromadb');
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const path = require('path');

require('dotenv').config();

// --- CONFIGURAÇÕES ---
const GcpConfig = {
    pdfDirectory: path.resolve(__dirname, '../PDFs'),
    chromaDbHost: 'http://localhost:8000',
    chromaCollectionName: 'chatbot-docs',
};

// --- CLIENTE DA API ---
// Inicialize a biblioteca principal
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const chromaClient = new ChromaClient({ path: GcpConfig.chromaDbHost });

/**
 * ETAPA 1: Extrai o texto de UM ÚNICO documento PDF (usando uma biblioteca local gratuita).
 * @param {string} filePath O caminho completo para o arquivo PDF.
 * @returns {Promise<string>} O texto completo extraído do documento.
 */
async function extractTextFromPdf(filePath) { 
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        // console.log(`[ETAPA 1] Extração de texto de "${filePath}" concluída.`);
        return data.text;
    } catch (error) {
        console.error(`[ERRO - ETAPA 1] Falha ao processar o PDF localmente "${filePath}":`, error.message);
        return "";
    }
}

/**
 * ETAPA 2: Divide um longo texto em fragmentos (chunks).
 * @param {string} text O texto completo a ser dividido.
 * @returns {Promise<string[]>} Um array de strings, onde cada string é um chunk de texto.
 */
async function chunkText(text) {
    // console.log(`[ETAPA 2] Iniciando a fragmentação do texto para ${text.substring(0, 50)}...`);
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", " ", ""],
    });
    const documents = await textSplitter.createDocuments([text]);
    const textChunks = documents.map(doc => doc.pageContent);
    // console.log(`[ETAPA 2] Texto dividido em ${textChunks.length} chunks.`);
    return textChunks;
}

/**
 * ETAPA 3: Gera embeddings para uma lista de chunks de texto.
 * @param {string[]} textChunks O array de chunks de texto.
 * @returns {Promise<number[][]>} Um array de vetores de embedding.
 */
async function generateEmbeddings(textChunks) {
    // console.log(`[ETAPA 3] Iniciando a geração de ${textChunks.length} embeddings...`);
    try {
        const batchSize = 100;
        let allEmbeddings = [];
        for (let i = 0; i < textChunks.length; i += batchSize) {
            const batch = textChunks.slice(i, i + batchSize);
            const result = await embeddingModel.batchEmbedContents({
                requests: batch.map(text => ({
                    content: { parts: [{ text }] },
                    taskType: "RETRIEVAL_DOCUMENT",
                })),
            });
            allEmbeddings.push(...result.embeddings.map((e) => e.values));
            // console.log(` -> Lote ${Math.floor(i / batchSize) + 1} processado. Total de embeddings: ${allEmbeddings.length}`);
        }
        // console.log(`[ETAPA 3] Geração de ${allEmbeddings.length} embeddings concluída.`);
        return allEmbeddings;
    } catch (error) {
        console.error('[ERRO - ETAPA 3] Falha ao gerar embeddings:', error);
        throw error;
    }
}

const dummyEmbeddingFunction = { generate: (texts) => Promise.resolve([]) };

/**
 * ETAPA 4: Salva os chunks no ChromaDB.
 * A geração de embeddings será feita pela própria coleção.
 * @param {string[]} chunks Os pedaços de texto.
 */
async function saveToChromaDB(chunks, embeddings) {
    console.log(`[ETAPA 4] Salvando ${chunks.length} chunks no ChromaDB...`);
    const collection = await chromaClient.getOrCreateCollection({
        name: GcpConfig.chromaCollectionName,
        metadata: { "hnsw:space": "cosine" },
        embeddingFunction: dummyEmbeddingFunction // Adicionado para evitar o aviso
    });
    const ids = chunks.map((_, index) => `chunk_${Date.now()}_${index}`);
    const metadatas = chunks.map(chunk => ({ source_text: chunk }));
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
        await collection.add({ ids: ids.slice(i, i + batchSize), embeddings: embeddings.slice(i, i + batchSize), metadatas: metadatas.slice(i, i + batchSize) });
    }
}

/**
 * Função principal que orquestra todo o pipeline de ingestão.
 */
async function runIngestionPipeline() {
    console.log('--- INICIANDO PIPELINE DE INGESTÃO DE DOCUMENTOS ---');
    try {
        const filesToProcess = process.argv.slice(2);
        if (filesToProcess.length === 0) {
            console.log('Nenhum arquivo especificado para ingestão. Encerrando.');
            return;
        }
        console.log(`Arquivos para processar: ${filesToProcess.join(', ')}`);
        for (const pdfFile of filesToProcess) {
            const fullPath = path.join(GcpConfig.pdfDirectory, pdfFile);
            console.log(`\n--- Processando: ${pdfFile} ---`);
            const extractedText = await extractTextFromPdf(fullPath);
            if (extractedText) {
                const textChunks = await chunkText(extractedText);
                const allEmbeddings = await generateEmbeddings(textChunks);
                await saveToChromaDB(textChunks, allEmbeddings);
            }
        }
        console.log('\n--- PIPELINE DE INGESTÃO CONCLUÍDO COM SUCESSO ---');
    } catch (error) {
        console.error('\n--- O PIPELINE DE INGESTÃO FALHOU ---');
        console.error('Ocorreu um erro:', error.message);
        process.exit(1);
    }
}

// Executa a função principal do pipeline.
runIngestionPipeline();