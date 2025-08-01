const ragService = require('../services/rag.service');

async function handleChatRequest(req, res) {
    const { query, history } = req.body;
    if (!query) { return res.status(400).json({ error: 'A consulta (query) é obrigatória.' }); }
    try {
        const { stream, sources } = await ragService.processQuery(query, history || []);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        const sourcesJson = JSON.stringify({ sources });
        res.write(sourcesJson + '\n--STREAM_SEPARATOR--\n');
        for await (const chunk of stream) { res.write(chunk); }
        res.end();
    } catch (error) {
        console.error("[Controller] Erro no fluxo de chat:", error);
        if (!res.headersSent) { res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' }); }
    }
}

module.exports = { handleChatRequest };