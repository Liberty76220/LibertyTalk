// public/js/auth.js

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const cardTitle = document.querySelector('.card-title');
const cardSubtitle = document.querySelector('.card-subtitle');

// --- Logique de Basculement (UI) ---
const toggleForms = (isRegister) => {
    loginForm.style.display = isRegister ? 'none' : 'flex';
    registerForm.style.display = isRegister ? 'flex' : 'none';
    showRegisterLink.style.display = isRegister ? 'none' : 'inline';
    showLoginLink.style.display = isRegister ? 'inline' : 'none';
    cardTitle.textContent = isRegister ? 'Créer un Compte' : 'Bienvenue';
    cardSubtitle.textContent = isRegister ? 'Entrez vos informations pour vous inscrire.' : 'Nous sommes ravis de vous revoir !';
};

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleForms(true);
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleForms(false);
});


// --- Logique d'Inscription ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(registerForm);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
            toggleForms(false); // Basculer vers la connexion
            registerForm.reset();
        } else {
            alert('Erreur d\'inscription: ' + result.message);
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'inscription:', error);
        alert('Une erreur s\'est produite. Le serveur est-il bien démarré ?');
    }
});


// --- Logique de Connexion (MISE À JOUR CRITIQUE) ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(loginForm);
    const data = Object.fromEntries(formData);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            // Sauvegarder les informations essentielles
            localStorage.setItem('authToken', result.token);
            localStorage.setItem('userId', result.userId);
            localStorage.setItem('username', result.username);
            
            // [AJOUTS CLÉS] : Stocker l'email et le statut isAdmin
            localStorage.setItem('email', result.email);
            localStorage.setItem('isAdmin', result.isAdmin); // Stocke 'true' ou 'false'

            alert(`Bienvenue, ${result.username} ! Connexion réussie.`);
            
            // REDIRECTION vers l'application principale
            window.location.href = '/app.html'; 
            
        } else {
            alert('Erreur de connexion: ' + result.message);
        }
    } catch (error) {
        console.error('Erreur réseau lors de la connexion:', error);
        alert('Une erreur s\'est produite. Vérifiez votre connexion internet ou le serveur.');
    }
});