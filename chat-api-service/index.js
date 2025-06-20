const express = require('express');
const cors = require('cors');
const path = require('path');
const chatRoutes = require('./src/routes/chat.routes');
const config = require('./src/config');
const ragService = require('./src/services/rag.service'); // Importa o serviço

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api', chatRoutes);

// Inicialização do Servidor
app.listen(config.port, () => {
    console.log(`Servidor rodando na porta ${config.port}`);
    console.log(`Acesse o chat em http://localhost:${config.port}`);
    
    ragService.startHeartbeat();
});