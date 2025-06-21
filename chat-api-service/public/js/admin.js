const uploadForm = document.getElementById('upload-form');
const pdfFilesInput = document.getElementById('pdf-files');
const fileList = document.getElementById('file-list');
const submitButton = document.getElementById('submit-button');
const statusContainer = document.getElementById('status-container');
const logs = document.getElementById('logs');

pdfFilesInput.addEventListener('change', () => {
    fileList.innerHTML = '';
    if (pdfFilesInput.files.length > 0) {
        for (const file of pdfFilesInput.files) {
            const listItem = document.createElement('p');
            listItem.textContent = `Arquivo selecionado: ${file.name}`;
            fileList.appendChild(listItem);
        }
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (pdfFilesInput.files.length === 0) {
        alert('Por favor, selecione pelo menos um arquivo PDF.');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const formData = new FormData();
    for (const file of pdfFilesInput.files) {
        formData.append('pdfs', file);
    }

    try {
        // 1. Envia os arquivos para o backend
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            throw new Error('Falha no upload dos arquivos.');
        }

        const uploadResult = await uploadResponse.json();
        console.log(uploadResult.message);
        
        // 2. Mostra o container de status e começa a ouvir os logs
        statusContainer.classList.remove('hidden');
        logs.textContent = 'Upload concluído. Aguardando início da ingestão...\n';
        listenForIngestStatus();

    } catch (error) {
        console.error('Erro no processo de upload:', error);
        logs.textContent = `Erro: ${error.message}`;
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar e Processar Arquivos';
    }
});

function listenForIngestStatus() {
    // 3. Conecta ao endpoint SSE para receber logs em tempo real
    const eventSource = new EventSource('/api/ingest-status');
    submitButton.textContent = 'Processando...';

    eventSource.onmessage = (event) => {
        // Remove as aspas extras do JSON.stringify
        const logData = JSON.parse(event.data);
        logs.textContent += logData;
        // Rola para o final dos logs
        logs.scrollTop = logs.scrollHeight;
    };

    eventSource.addEventListener('done', () => {
        logs.textContent += '\nProcesso finalizado!';
        eventSource.close();
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar e Processar Arquivos';
        fileList.innerHTML = ''; // Limpa a lista de arquivos
        uploadForm.reset();
    });

    eventSource.onerror = () => {
        logs.textContent += '\nErro na conexão de status. O processo pode ter terminado.';
        eventSource.close();
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar e Processar Arquivos';
    };
}