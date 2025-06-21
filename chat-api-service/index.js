const express = require('express');
const cors = require('cors');
const path = require('path');

// Importa as rotas
const chatRoutes = require('./src/routes/chat.routes');
const uploadRoutes = require('./src/routes/upload.routes');

// Importa a configuração e o serviço de RAG
const config = require('./src/config');
const ragService = require('./src/services/rag.service'); 

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api', chatRoutes);
app.use('/api', uploadRoutes);

// Inicialização do Servidor
app.listen(config.port, () => {
    console.log(`Servidor rodando na porta ${config.port}`);
    console.log(`Acesse o chat em http://localhost:${config.port}`);
    console.log(`Acesse a página de admin em http://localhost:${config.port}/admin.html`);
    ragService.startHeartbeat();
});