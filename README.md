# Chatbot RAG com Gemini e Node.js

Este projeto implementa um chatbot avançado utilizando a arquitetura RAG (Retrieval-Augmented Generation). Ele permite que os usuários "conversem" com uma coleção de documentos PDF, obtendo respostas precisas e contextuais baseadas exclusivamente no conteúdo dos arquivos fornecidos. A aplicação é construída com Node.js para o backend e HTML/CSS/JS puro para o frontend, utilizando os modelos de IA da Google (Gemini) e o banco de dados vetorial Pinecone.

## ✨ Funcionalidades

- **Interface de Chat Intuitiva**: Uma interface de chat limpa e responsiva para interagir com o assistente.
- **Upload de Documentos**: Uma página de administração (`/admin.html`) para fazer o upload de um ou mais arquivos PDF, que servirão como base de conhecimento.
- **Processamento Automatizado (Ingestão)**: Os PDFs enviados são automaticamente processados: o texto é extraído, dividido em blocos (chunks), vetorizado com a API Gemini e armazenado no Pinecone.
- **Monitoramento em Tempo Real**: A página de administração exibe logs em tempo real do processo de ingestão dos documentos.
- **Respostas por Streaming**: As respostas do chatbot são transmitidas palavra por palavra, melhorando a experiência do usuário.
- **Histórico de Conversa**: O chatbot considera o histórico da conversa para responder a perguntas de acompanhamento de forma mais eficaz.
- **Exibição de Fontes**: Para cada resposta, o chatbot pode mostrar os trechos exatos dos documentos originais que foram usados para formulá-la.

## 🚀 Arquitetura e Funcionamento

O projeto é dividido em dois processos principais: **Ingestão** e **Chat (RAG)**.

### 1. Processo de Ingestão de Documentos

1.  **Upload**: O administrador acessa a página `/admin.html` e faz o upload dos arquivos PDF.
2.  **Recebimento**: O servidor Express (usando `multer`) recebe os arquivos em memória.
3.  **Extração de Texto**: O texto de cada PDF é extraído usando a biblioteca `pdf-parse`.
4.  **Fragmentação (Chunking)**: O texto extraído é dividido em fragmentos menores e sobrepostos (`chunks`) usando `@langchain/textsplitters` para garantir a coesão semântica.
5.  **Geração de Embeddings**: Cada `chunk` de texto é enviado para o modelo de embedding da Google (`text-embedding-004`) para ser convertido em um vetor numérico que representa seu significado.
6.  **Armazenamento Vetorial**: Os `chunks` de texto e seus respectivos vetores (embeddings) são armazenados (upsert) em um índice no **Pinecone**.

### 2. Processo de Chat (Retrieval-Augmented Generation)

1.  **Pergunta do Usuário**: O usuário envia uma pergunta através da interface de chat.
2.  **Transformação da Pergunta**: A pergunta é combinada com o histórico da conversa para criar uma "pergunta autônoma", que é mais clara para a busca semântica.
3.  **Vetorização da Pergunta**: A pergunta (transformada) é convertida em um vetor usando o mesmo modelo de embedding da Google.
4.  **Busca por Similaridade (Retrieval)**: O vetor da pergunta é usado para consultar o índice **Pinecone**, que retorna os `chunks` de texto mais relevantes (semanticamente similares).
5.  **Aumento do Prompt (Augmentation)**: Um prompt detalhado é montado, contendo:
    - O contexto (os `chunks` relevantes recuperados do Pinecone).
    - O histórico da conversa.
    - A pergunta original do usuário.
    - Instruções para o modelo se basear *exclusivamente* no contexto fornecido.
6.  **Geração da Resposta (Generation)**: O prompt aumentado é enviado para o modelo de chat da Google (`gemini-2.5-flash`), que gera uma resposta coerente e baseada nos fatos apresentados.
7.  **Streaming**: A resposta é enviada de volta para o frontend em tempo real.

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, Tailwind CSS, JavaScript (Vanilla)
- **Inteligência Artificial**:
    - **Google Gemini**:
        - `gemini-2.5-flash`: Para geração de respostas no chat.
        - `text-embedding-004`: Para criação de embeddings de texto.
- **Banco de Dados Vetorial**: Pinecone
- **Processamento de Arquivos**:
    - `multer`: Para upload de arquivos.
    - `pdf-parse`: Para extração de texto de PDFs.
    - `@langchain/textsplitters`: Para fragmentação de texto.

## 📂 Estrutura do Projeto

```
/
├── chat-api-service/
│   ├── public/             # Arquivos do frontend (HTML, CSS, JS)
│   │   ├── admin.html
│   │   ├── index.html
│   │   └── js/
│   │       ├── admin.js
│   │       └── script.js
│   ├── src/
│   │   ├── config/         # Configurações e variáveis de ambiente
│   │   ├── controllers/    # Controladores (chat, upload)
│   │   ├── routes/         # Definição das rotas da API
│   │   └── services/       # Lógica de negócio (ingestão, RAG)
│   ├── .env.example        # Exemplo de arquivo de ambiente
│   ├── index.js            # Ponto de entrada do servidor
│   └── package.json
│
└── .gitignore
```

## ⚙️ Instalação e Execução

### Pré-requisitos
- Node.js (v18 ou superior)
- Acesso às APIs do Google Gemini e Pinecone.

### Passos

1.  **Clone o repositório:**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd chatbot-rag-node
    ```

2.  **Navegue até o serviço da API:**
    ```bash
    cd chat-api-service
    ```

3.  **Instale as dependências:**
    ```bash
    npm install
    ```

4.  **Configure as variáveis de ambiente:**
    - Renomeie o arquivo `.env.example` (se houver) para `.env` ou crie um novo.
    - Preencha as seguintes variáveis no arquivo `.env`:
    ```env
    # Chave de API do Google Gemini
    GEMINI_API_KEY="SUA_CHAVE_AQUI"

    # Chave de API do Pinecone
    PINECONE_API_KEY="SUA_CHAVE_AQUI"

    # Host do seu índice Pinecone (encontrado no dashboard do Pinecone)
    PINECONE_HOST="URL_DO_SEU_INDICE.pinecone.io"
    ```

5.  **Inicie o servidor:**
    ```bash
    node index.js
    ```

6.  **Acesse a aplicação:**
    - **Chat**: Abra o navegador e acesse `http://localhost:8080`
    - **Admin (Upload)**: Acesse `http://localhost:8080/admin.html`

## 🚀 Como Usar

1.  Primeiro, vá para a **página de administração** para carregar os documentos que servirão de base de conhecimento.
2.  Selecione um ou mais arquivos PDF e clique em "Enviar e Processar Arquivos".
3.  Aguarde o processo de ingestão terminar (você pode acompanhar os logs na tela).
4.  Após a conclusão, vá para a **página de chat** e comece a fazer perguntas!
