const { GoogleGenerativeAI } = require('@google/generative-ai');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const path = require('path');

require('dotenv').config();

// --- CONFIGURAÇÕES ---
const GcpConfig = {
    pdfDirectory: './PDFs/'
};

// --- CLIENTE DA API ---
// Inicialize a biblioteca principal
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * ETAPA 1: Extrai o texto de UM ÚNICO documento PDF (usando uma biblioteca local gratuita).
 * @param {string} filePath O caminho completo para o arquivo PDF.
 * @returns {Promise<string>} O texto completo extraído do documento.
 */
async function extractTextFromPdf(filePath) {
    console.log(`[ETAPA 1] Iniciando a extração de texto (local) do PDF: ${filePath}`);
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        console.log(`[ETAPA 1] Extração de texto de "${filePath}" concluída.`);
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
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", " ", ""],
    });
    const documents = await textSplitter.createDocuments([text]);
    return documents.map(doc => doc.pageContent);
}

/**
 * ETAPA 3: Gera embeddings para uma lista de chunks de texto.
 * @param {string[]} textChunks O array de chunks de texto.
 * @returns {Promise<number[][]>} Um array de vetores de embedding.
 */
async function generateEmbeddings(textChunks) {
    console.log(`[ETAPA 3] Iniciando a geração de ${textChunks.length} embeddings...`);
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

            const embeddings = result.embeddings.map((e) => e.values);
            allEmbeddings.push(...embeddings);
            console.log(` -> Lote ${Math.floor(i / batchSize) + 1} processado. Total de embeddings: ${allEmbeddings.length}`);
        }
        
        console.log(`[ETAPA 3] Geração de ${allEmbeddings.length} embeddings concluída.`);
        return allEmbeddings;
    } catch (error) {
        console.error('[ERRO - ETAPA 3] Falha ao gerar embeddings com a API do Gemini:', error);
        throw error;
    }
}

/**
 * Função principal que orquestra todo o pipeline de ingestão.
 */
async function runIngestionPipeline() {
    console.log('--- INICIANDO PIPELINE DE INGESTÃO DE DOCUMENTOS ---');
    try {
        const files = await fs.readdir(GcpConfig.pdfDirectory);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length === 0) {
            console.log(`Nenhum arquivo PDF encontrado no diretório: ${GcpConfig.pdfDirectory}`);
            return;
        }

        console.log(`Encontrados ${pdfFiles.length} arquivos PDF para processar.`);

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

        console.log('\n--- PIPELINE DE INGESTÃO CONCLUÍDO COM SUCESSO ---');
        console.log('Dados de todos os PDFs prontos para serem enviados ao banco de dados vetorial.');
        console.log('Total de Chunks:', allChunks.length);
        console.log('Total de Embeddings:', allEmbeddings.length);

        // O próximo passo seria salvar 'allChunks' e 'allEmbeddings' em um banco de dados ou arquivo.

    } catch (error) {
        console.error('\n--- O PIPELINE DE INGESTÃO FALHOU ---');
        console.error('Ocorreu um erro:', error.message);
    }
}

// Executa a função principal do pipeline.
runIngestionPipeline();