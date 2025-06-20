const ragService = require('../services/rag.service');

async function handleChatRequest(req, res) {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'A consulta (query) é obrigatória.' });
    }

    try {
        console.log(`[Controller] Recebida a consulta: "${query}"`);

        // Delega toda a lógica de negócio para o serviço RAG
        const stream = await ragService.processQuery(query);

        // Configura os cabeçalhos para streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Itera sobre o stream e envia cada pedaço para o cliente
        for await (const chunk of stream) {
            res.write(chunk);
        }

        console.log("[Controller] Streaming da resposta concluído.");
        res.end(); // Finaliza a resposta do stream

    } catch (error) {
        console.error("[Controller] Erro no fluxo de chat:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
        }
    }
}

module.exports = {
    handleChatRequest
};