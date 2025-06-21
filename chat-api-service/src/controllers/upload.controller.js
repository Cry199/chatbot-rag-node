const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

class IngestEmitter extends EventEmitter {}
const ingestEmitter = new IngestEmitter();

function handleUpload(req, res) {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo foi enviado.');
    }

    const uploadedFiles = req.files.map(file => file.filename);
    console.log(`[Upload] Arquivos recebidos: ${uploadedFiles.join(', ')}. Disparando ingestão...`);
    
    const ingestProcess = spawn('node', ['ingest.js', ...uploadedFiles], {
        cwd: path.join(__dirname, '../../../ingestion-service/')
    });

    ingestProcess.stdout.on('data', (data) => {
        const log = data.toString();
        console.log(`[Ingest Log]: ${log}`);
        ingestEmitter.emit('log', log);
    });

    ingestProcess.stderr.on('data', (data) => {
        const errorLog = data.toString();
        console.error(`[Ingest Error]: ${errorLog}`);
        ingestEmitter.emit('log', `ERRO: ${errorLog}`);
    });

    ingestProcess.on('close', (code) => {
        const finalMessage = `Processo de ingestão concluído com código ${code}.`;
        console.log(`[Ingest Status]: ${finalMessage}`);
        ingestEmitter.emit('log', `\n--- ${finalMessage} ---`);
        ingestEmitter.emit('done');
    });

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
        console.log('[SSE] Cliente desconectado.');
    });
}
module.exports = { handleUpload, getIngestStatus };