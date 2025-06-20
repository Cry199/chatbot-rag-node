const { GoogleGenerativeAI } = require('@google/generative-ai');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { ChromaClient } = require('chromadb');
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const path = require('path');

require('dotenv').config();

// --- CONFIGURAÇÕES ---
const GcpConfig = {
    pdfDirectory: './PDFs/',
    chromaDbHost: 'http://localhost:8000',
    chromaCollectionName: 'chatbot-docs' 
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

/**
 * ETAPA 4: Salva os chunks no ChromaDB.
 * A geração de embeddings será feita pela própria coleção.
 * @param {string[]} chunks Os pedaços de texto.
 */
async function saveToChromaDB(chunks, embeddings) {
    try {
        const dummyEmbeddingFunction = { generate: (texts) => { 
            console.warn("A função de embedding dummy foi chamada. Isso não deveria acontecer.");
            return Promise.resolve([]);
        }};

        // Pega ou cria a coleção.
        const collection = await chromaClient.getOrCreateCollection({
            name: GcpConfig.chromaCollectionName,
            metadata: { "hnsw:space": "cosine" },
            embeddingFunction: dummyEmbeddingFunction
        });

        const ids = chunks.map((_, index) => `chunk_${index}_${Date.now()}`);
        const metadatas = chunks.map(chunk => ({ source_text: chunk }));
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchIds = ids.slice(i, i + batchSize);
            const batchEmbeddings = embeddings.slice(i, i + batchSize);
            const batchMetadatas = metadatas.slice(i, i + batchSize);
            
            await collection.add({
                ids: batchIds,
                embeddings: batchEmbeddings,
                metadatas: batchMetadatas,
            });
        }
        console.log('[ETAPA 4] Dados salvos no ChromaDB com sucesso.');

    } catch (error) {
        console.error('[ERRO - ETAPA 4] Falha ao salvar dados no ChromaDB:', error);
        throw error;
    }
}

/**
 * Função principal que orquestra todo o pipeline de ingestão.
 */
async function runIngestionPipeline() {
    try {
        const files = await fs.readdir(GcpConfig.pdfDirectory);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length === 0) {
            // console.log(`Nenhum arquivo PDF encontrado no diretório: ${GcpConfig.pdfDirectory}`);
            return;
        }
        
        let allChunks = [];
        for (const pdfFile of pdfFiles) {
            const fullPath = path.join(GcpConfig.pdfDirectory, pdfFile);
            const extractedText = await extractTextFromPdf(fullPath);
            // Pula a fragmentação se a extração de texto falhar e retornar uma string vazia
            if (extractedText) {
                const textChunks = await chunkText(extractedText);
                allChunks.push(...textChunks);
            }
        }

        console.log(`\n[TOTAL] Processamento de texto concluído. Total de ${allChunks.length} chunks de todos os documentos.`);

        let allEmbeddings = [];
        if (allChunks.length > 0) {
            allEmbeddings = await generateEmbeddings(allChunks);
        }

        if (allChunks.length > 0 && allEmbeddings.length > 0) {
            await saveToChromaDB(allChunks, allEmbeddings);
        }

        console.log('\n--- PIPELINE DE INGESTÃO CONCLUÍDO COM SUCESSO ---');
        console.log('Dados de todos os PDFs foram processados e salvos no banco de dados vetorial local.');

    } catch (error) {
        console.error('\n--- O PIPELINE DE INGESTÃO FALHOU ---');
        console.error('Ocorreu um erro:', error.message);
    }
}

// Executa a função principal do pipeline.
runIngestionPipeline();