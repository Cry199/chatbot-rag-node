const express = require('express');
const cors = require('cors');
const chatRoutes = require('./src/routes/chat.routes');
const config = require('./src/config');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Rotas da API
app.use('/api', chatRoutes);

// Inicialização do Servidor
app.listen(config.port, () => {
    console.log(`Servidor refatorado rodando na porta ${config.port}`);
});