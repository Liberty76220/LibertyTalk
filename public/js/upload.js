// public/js/upload.js

const Uploader = {
    async uploadFile(file, contextInfo) {
        const formData = new FormData();
        formData.append('file', file);
        
        // On ajoute les informations pour le nom du fichier
        formData.append('userName', localStorage.getItem('username'));
        formData.append('context', contextInfo.isMP ? 'MP' : 'Server');
        formData.append('chatName', contextInfo.chatName);

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            return data.url; 
        } else {
            throw new Error(data.message || "Erreur upload");
        }
    }
};