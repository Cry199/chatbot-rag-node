const express = require('express');
const cors = require('cors');
const path = require('path');

async function startServer() {
    try {
        console.log("[Arranque 1/4] A carregar configuração...");
        const config = require('./src/config');
        
        console.log("[Arranque 2/4] A carregar rotas e serviços...");
        const chatRoutes = require('./src/routes/chat.routes');
        const uploadRoutes = require('./src/routes/upload.routes');
        
        const app = express();
        app.use(express.json({ limit: '200mb' }));
        app.use(express.urlencoded({ limit: '200mb', extended: true }));
        app.use(cors());
        app.use(express.static(path.join(__dirname, 'public')));
        
        app.use('/api', chatRoutes);
        app.use('/api', uploadRoutes);

        console.log(`[Arranque 3/4] A configurar o servidor para escutar na porta ${config.port}...`);
        app.listen(config.port, () => {
            console.log(`[Arranque 4/4] SUCESSO! O servidor está online na porta ${config.port}`);
        });

    } catch (error) {
        console.error("### ERRO FATAL AO INICIAR O SERVIDOR ###");
        console.error(error);
        process.exit(1);
    }
}

startServer();