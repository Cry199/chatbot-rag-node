const ingestionService = require('../services/ingestion.service');
const EventEmitter = require('events');

class IngestEmitter extends EventEmitter {}
const ingestEmitter = new IngestEmitter();

async function handleUpload(req, res) {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum ficheiro foi enviado.');
    }
    
    console.log(`[Upload] ${req.files.length} ficheiro(s) recebidos em memória. Disparando ingestão...`);
    
    // Passa a lista de ficheiros em memória para o pipeline.
    ingestionService.runIngestionPipeline(req.files, ingestEmitter);

    res.status(202).json({ message: 'Upload recebido. O processo de ingestão foi iniciado.' });
}

function getIngestStatus(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sendLog = (log) => { res.write(`data: ${JSON.stringify(log)}\n\n`); };
    const sendDone = () => {
        res.write('event: done\ndata: Processo finalizado.\n\n');
        res.end();
        ingestEmitter.removeListener('log', sendLog);
        ingestEmitter.removeListener('done', sendDone);
    };
    ingestEmitter.on('log', sendLog);
    ingestEmitter.on('done', sendDone);
    req.on('close', () => {
        ingestEmitter.removeListener('log', sendLog);
        ingestEmitter.removeListener('done', sendDone);
    });
}
module.exports = { handleUpload, getIngestStatus };