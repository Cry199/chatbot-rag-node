# Chatbot RAG com Gemini e Node.js

Este projeto implementa um chatbot com a técnica de *Retrieval-Augmented Generation* (RAG), utilizando os modelos de linguagem da Google (Gemini), um banco de dados vetorial (ChromaDB) e um backend em Node.js com Express.

## Visão Geral

O objetivo deste projeto é criar um assistente de chat capaz de responder a perguntas com base em um conjunto de documentos PDF previamente processados. A solução é dividida em dois serviços principais:

1.  **Serviço de Ingestão (`ingestion-service`):** Responsável por ler os arquivos PDF de um diretório, extrair o texto, dividi-lo em pedaços (chunks), gerar embeddings para esses chunks usando o modelo `text-embedding-004` e, por fim, armazenar tudo no ChromaDB.
2.  **Serviço de Chat (`chat-api-service`):** Uma API REST construída com Express que recebe as perguntas do usuário, busca os chunks de texto mais relevantes no ChromaDB e usa o modelo `gemini-1.5-flash` para gerar uma resposta baseada nesses chunks, fazendo o streaming da resposta de volta para o cliente.

## Arquitetura e Fluxo de Dados

O fluxo de dados do sistema funciona da seguinte maneira:

### Fluxo de Ingestão

1.  Os arquivos PDF são colocados no diretório `PDFs/`.
2.  O `ingestion-service` é executado. Ele lê cada PDF, extrai o texto e o divide em chunks menores e sobrepostos.
3.  Para cada chunk de texto, o serviço chama a API do Gemini (`text-embedding-004`) para gerar um embedding vetorial.
4.  Os chunks e seus embeddings correspondentes são salvos em uma coleção no ChromaDB.

### Fluxo do Chat

1.  O usuário envia uma pergunta através da interface web.
2.  A interface envia a pergunta para a `/api/chat` no `chat-api-service`.
3.  O serviço de chat gera um embedding para a pergunta do usuário.
4.  Esse embedding é usado para consultar o ChromaDB e recuperar os 5 chunks de texto mais relevantes (baseado em similaridade de cosseno).
5.  Os chunks recuperados são inseridos em um prompt aumentado, que instrui o modelo `gemini-1.5-flash` a responder a pergunta do usuário *exclusivamente* com base no contexto fornecido.
6.  A resposta gerada pelo Gemini é enviada de volta para a interface do usuário em tempo real através de streaming.

## Tecnologias Utilizadas

* **Backend:** Node.js, Express
* **Frontend:** HTML, Tailwind CSS, JavaScript (Fetch API)
* **Modelos de IA (Google):**
    * `gemini-1.5-flash` para geração de texto (chat).
    * `text-embedding-004` para geração de embeddings.
* **Banco de Dados Vetorial:** ChromaDB
* **Processamento de PDF:** `pdf-parse`
* **Divisão de Texto:** `@langchain/textsplitters`
* **Variáveis de Ambiente:** `dotenv`

## Pré-requisitos

* Node.js (versão 20.x ou superior recomendada)
* Docker e Docker Compose (para rodar o ChromaDB)
* Uma chave de API do Google Gemini.

## Configuração do Projeto

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz de cada um dos serviços (`ingestion-service` e `chat-api-service`). O arquivo `.gitignore` já está configurado para ignorar esses arquivos.

**Arquivo `/ingestion-service/.env`:**

```env
GEMINI_API_KEY=SUA_CHAVE_API_DO_GEMINI_AQUI
```

**Arquivo `/chat-api-service/.env`:**

```env
GEMINI_API_KEY=SUA_CHAVE_API_DO_GEMINI_AQUI
PORT=8080
```

### 2. Iniciando o Banco de Dados

Você pode iniciar uma instância do ChromaDB facilmente usando Docker:

```bash
docker run -p 8000:8000 chromadb/chroma
```

Isso fará com que o banco de dados fique acessível em `http://localhost:8000`.

### 3. Instalando as Dependências

Execute o comando abaixo no diretório de cada serviço para instalar as dependências necessárias:

```bash
# No diretório /ingestion-service
npm install

# No diretório /chat-api-service
npm install
```

## Como Executar

### 1. Ingestão dos Documentos

1.  Crie uma pasta chamada `PDFs` na raiz do `ingestion-service`.
2.  Adicione todos os documentos PDF que você deseja que o chatbot processe dentro desta pasta.
3.  Execute o serviço de ingestão:

    ```bash
    # Navegue até o diretório /ingestion-service
    cd ingestion-service

    # Execute o script de ingestão
    node ingest.js
    ```

Aguarde a conclusão do processo. Você verá logs no console indicando o progresso da extração, geração de embeddings e salvamento no ChromaDB.

### 2. Iniciando a API de Chat

Após a conclusão da ingestão, inicie a API de chat:

```bash
# Navegue até o diretório /chat-api-service
cd ../chat-api-service

# Inicie o servidor
npm start
```

O servidor estará rodando na porta `8080` (ou na porta que você definiu no arquivo `.env`).

### 3. Utilizando o Chatbot

Abra o arquivo `chat-api-service/public/index.html` em seu navegador. Você pode simplesmente arrastar e soltar o arquivo na janela do navegador ou usar uma extensão como o "Live Server" no VS Code.

Agora você pode fazer perguntas sobre os documentos que você processou!
