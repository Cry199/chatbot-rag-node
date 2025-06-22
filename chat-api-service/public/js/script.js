const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const clearChatButton = document.getElementById('clear-chat-button');

const API_URL = window.location.origin + '/api/chat';
const STREAM_SEPARATOR = '\n--STREAM_SEPARATOR--\n';

// Estado da aplicação
let conversationHistory = [];

// Função para adicionar a mensagem de boas-vindas
function addWelcomeMessage() {
    chatWindow.innerHTML = `
        <div class="flex justify-start">
            <div class="flex flex-col items-start max-w-lg">
                <div class="bg-gray-200 text-gray-800 p-3 rounded-lg">
                    <p>Olá! Faça uma pergunta sobre os documentos que eu processei.</p>
                </div>
            </div>
        </div>
    `;
}

// Event listener para o botão de limpar
clearChatButton.addEventListener('click', () => {
    conversationHistory = [];
    addWelcomeMessage();
});

// Event listener para o formulário de chat
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = messageInput.value.trim();
    if (!query) return;
    
    conversationHistory.push({ role: 'user', text: query });

    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;

    addMessage(query, 'user');
    const botContentContainer = addMessage('', 'bot');
    const botTextElement = botContentContainer.querySelector('.message-text');
    botTextElement.innerHTML = '<span class="blinking-cursor"></span>';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, history: conversationHistory.slice(0, -1) })
        });

        if (!response.ok) throw new Error((await response.json()).error || 'Erro no servidor.');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sourcesProcessed = false;
        let fullResponse = '';
        
        botTextElement.innerHTML = ''; 

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            let streamPartToRender = buffer;

            if (!sourcesProcessed && buffer.includes(STREAM_SEPARATOR)) {
                const [sourcesJson, streamPart] = buffer.split(STREAM_SEPARATOR);
                const { sources } = JSON.parse(sourcesJson);
                if (sources && sources.length > 0) {
                    addSources(botContentContainer, sources);
                }
                streamPartToRender = streamPart;
                sourcesProcessed = true;
                buffer = streamPart;
            }
            
            if (sourcesProcessed) {
                fullResponse += streamPartToRender;
                botTextElement.textContent = fullResponse;
                buffer = (buffer === streamPartToRender) ? '' : buffer;
            }

            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        conversationHistory.push({ role: 'model', text: fullResponse });
        addCopyButton(botContentContainer.querySelector('.message-bubble'), fullResponse);

    } catch (error) {
        console.error('Erro:', error);
        botTextElement.innerHTML = `<span class="text-red-500">Erro: ${error.message}</span>`;
        conversationHistory.pop();
    } finally {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
});

// Função para adicionar mensagens na tela
function addMessage(text, sender) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `w-full mb-4 flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

    const contentContainer = document.createElement('div');
    contentContainer.className = 'flex flex-col max-w-lg';
    if (sender === 'bot') {
        contentContainer.classList.add('items-start');
    } else {
        contentContainer.classList.add('items-end');
    }

    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble p-3 rounded-lg ${sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}`;

    const textElement = document.createElement('p');
    textElement.className = 'message-text';
    textElement.textContent = text;
    
    messageBubble.appendChild(textElement);
    contentContainer.appendChild(messageBubble);
    messageWrapper.appendChild(contentContainer);
    chatWindow.appendChild(messageWrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    return contentContainer;
}

// Função para adicionar as fontes
function addSources(contentContainer, sources) {
    const sourcesButton = document.createElement('button');
    sourcesButton.className = 'flex items-center space-x-2 text-sm text-indigo-600 mt-2 hover:underline focus:outline-none font-semibold';
    
    const buttonIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`;
    const buttonTextSpan = document.createElement('span');
    buttonTextSpan.textContent = 'Mostrar Fontes';
    sourcesButton.innerHTML = buttonIcon;
    sourcesButton.appendChild(buttonTextSpan);
    
    const sourcesWrapper = document.createElement('div');
    sourcesWrapper.className = 'sources-wrapper w-full hidden';

    const sourcesContent = document.createElement('div');
    sourcesContent.className = 'p-3 mt-2 bg-gray-50 border border-gray-200 rounded-lg space-y-3';
    
    sources.forEach((source, index) => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'text-xs text-gray-700';
        const sourceTitle = document.createElement('strong');
        sourceTitle.className = 'text-gray-900 font-bold block mb-1';
        sourceTitle.textContent = `Fonte ${index + 1}`;
        const sourceText = document.createElement('p');
        sourceText.className = 'border-l-2 border-gray-300 pl-2 text-gray-600';
        sourceText.textContent = source;
        sourceItem.appendChild(sourceTitle);
        sourceItem.appendChild(sourceText);
        sourcesContent.appendChild(sourceItem);
    });
    
    sourcesWrapper.appendChild(sourcesContent);

    sourcesButton.onclick = () => {
        sourcesWrapper.classList.toggle('hidden');
        buttonTextSpan.textContent = sourcesWrapper.classList.contains('hidden') ? 'Mostrar Fontes' : 'Ocultar Fontes';
    };

    contentContainer.appendChild(sourcesButton);
    contentContainer.appendChild(sourcesWrapper);
}

// Função para adicionar o botão de copiar
function addCopyButton(messageBubble, textToCopy) {
    const copyButton = document.createElement('button');
    copyButton.title = 'Copiar resposta';
    copyButton.className = 'copy-button p-1.5 bg-gray-300/50 text-gray-600 rounded-full hover:bg-gray-400/50';
    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>`;
    
    copyButton.onclick = () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-600"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`;
            setTimeout(() => {
                copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>`;
            }, 2000);
        });
    };
    messageBubble.appendChild(copyButton);
}
// Chama a função de boas-vindas na inicialização
addWelcomeMessage();