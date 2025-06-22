const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const pdf = require('pdf-parse');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: config.models.embedding });
const pinecone = new Pinecone({ apiKey: config.pineconeApiKey });
const pineconeIndex = pinecone.index(config.pineconeIndexName, config.pineconeHost);

let log;

async function extractTextFromPdfBuffer(pdfBuffer) {
    return (await pdf(pdfBuffer)).text;
}


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


async function chunkText(text) {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    return (await splitter.createDocuments([text])).map(d => d.pageContent);
}


async function generateEmbeddings(textChunks) {
    const batchSize=100; const allEmbeddings=[];
    for(let i=0; i<textChunks.length; i+=batchSize){
        const result = await embeddingModel.batchEmbedContents({
            requests: textChunks.slice(i, i+batchSize).map(t=>({
                content:{parts:[{text:t}]}, taskType:"RETRIEVAL_DOCUMENT"
            }))
        });
        allEmbeddings.push(...result.embeddings.map(e=>e.values));
    }
    return allEmbeddings;
}


async function saveToPinecone(chunks, embeddings) {
    log(`[Pinecone] A guardar ${chunks.length} vetores...`);
    const vectors = chunks.map((chunk, index) => ({
        id: `chunk_${Date.now()}_${index}`,
        values: embeddings[index],
        metadata: { source_text: chunk }
    }));
    for (let i = 0; i < vectors.length; i += 100) {
        await pineconeIndex.upsert(vectors.slice(i, i + 100));
    }
}

async function runIngestionPipeline(files, emitter) {
    log = (message) => {
        console.log(message);
        if (emitter) emitter.emit('log', message + '\n');
    };
    log('--- INICIANDO PIPELINE DE INGESTÃO (EM MEMÓRIA) ---');
    try {
        if (!files || files.length === 0) {
            log('Nenhum ficheiro recebido para processar.');
            if (emitter) emitter.emit('done');
            return;
        }

        for (const file of files) {
            log(`\n--- Processando: ${file.originalname} ---`);
            const text = await extractTextFromPdfBuffer(file.buffer);
            const chunks = await chunkText(text);
            const embeddings = await generateEmbeddings(chunks);
            await saveToPinecone(chunks, embeddings);
            log(`--- Ficheiro ${file.originalname} processado com sucesso.`);
        }
    } catch (error) {
        log(`ERRO NO PIPELINE: ${error.message}`);
    } finally {
        log('--- PIPELINE DE INGESTÃO CONCLUÍDO ---');
        if (emitter) emitter.emit('done');
    }
}
module.exports = { runIngestionPipeline };
