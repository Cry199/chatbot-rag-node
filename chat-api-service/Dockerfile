# Estágio 1: Builder - Instala dependências e compila se necessário
# Usamos uma imagem 'slim' para manter o tamanho pequeno
FROM node:18-slim AS builder

# Define o diretório de trabalho dentro do contentor
WORKDIR /app

# Copia os ficheiros de definição de pacotes
COPY package*.json ./

# Instala apenas as dependências de produção para um build mais limpo e seguro
RUN npm install --omit=dev

# Estágio 2: Runner - Executa a aplicação
# Começa a partir de uma imagem base limpa e pequena
FROM node:18-slim

WORKDIR /app

# Copia as dependências já instaladas do estágio 'builder'
COPY --from=builder /app/node_modules ./node_modules

# Copia o resto do código da aplicação
COPY . .

# Expõe a porta que a nossa aplicação usa
EXPOSE 8080

# O comando para iniciar a aplicação quando o contentor arrancar
CMD [ "node", "index.js" ]