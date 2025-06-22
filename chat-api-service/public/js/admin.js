const uploadForm = document.getElementById('upload-form');
const pdfFilesInput = document.getElementById('pdf-files');
const fileList = document.getElementById('file-list');
const submitButton = document.getElementById('submit-button');
const statusContainer = document.getElementById('status-container');
const logs = document.getElementById('logs');

const API_URL = window.location.origin;

pdfFilesInput.addEventListener('change', () => {
    fileList.innerHTML = '';
    if (pdfFilesInput.files.length > 0) {
        for (const file of pdfFilesInput.files) {
            const listItem = document.createElement('p');
            listItem.textContent = `Ficheiro selecionado: ${file.name}`;
            fileList.appendChild(listItem);
        }
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (pdfFilesInput.files.length === 0) {
        alert('Por favor, selecione pelo menos um ficheiro PDF.');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'A enviar...';

    const formData = new FormData();
    for (const file of pdfFilesInput.files) {
        formData.append('pdfs', file);
    }

    try {
        // **MUDANÇA**: Usa a URL base completa para a chamada de upload.
        const uploadResponse = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            throw new Error('Falha no upload dos ficheiros.');
        }

        const uploadResult = await uploadResponse.json();
        console.log(uploadResult.message);
        
        statusContainer.classList.remove('hidden');
        logs.textContent = 'Upload concluído. A aguardar início da ingestão...\n';
        listenForIngestStatus();

    } catch (error) {
        console.error('Erro no processo de upload:', error);
        logs.textContent = `Erro: ${error.message}`;
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar e Processar Ficheiros';
    }
});

function listenForIngestStatus() {
    const eventSource = new EventSource(`${API_URL}/api/ingest-status`);
    submitButton.textContent = 'A processar...';

    eventSource.onmessage = (event) => {
        const logData = JSON.parse(event.data);
        logs.textContent += logData;
        logs.scrollTop = logs.scrollHeight;
    };

    eventSource.addEventListener('done', () => {
        logs.textContent += '\nProcesso finalizado!';
        eventSource.close();
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar e Processar Ficheiros';
        fileList.innerHTML = '';
        uploadForm.reset();
    });

    eventSource.onerror = () => {
        logs.textContent += '\nErro na conexão de estado. O processo pode ter terminado.';
        eventSource.close();
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar e Processar Ficheiros';
    };
}