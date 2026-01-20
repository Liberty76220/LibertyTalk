// main.js

const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    // 1. Démarrer le serveur Node.js/Express
    // NOTE: Ceci garantit que l'API est accessible avant que la fenêtre ne se charge.
    // Vous devez lancer 'npm run electron-start' au lieu de 'npm start'.
    
    // 2. Créer la fenêtre de bureau
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            // Permettre l'intégration des scripts Node.js dans la fenêtre (sécurité moderne)
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // 3. Charger l'interface Frontend.
    // Electron se connecte à notre serveur Web local.
    // L'application sera accessible via notre port 3000.
    mainWindow.loadURL('http://localhost:3000/app.html'); 

    // Outils de développement (à commenter pour la version finale)
    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Quand l'application est prête, créer la fenêtre
app.on('ready', createWindow);

// Quitter l'application quand toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') { // 'darwin' = macOS
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});