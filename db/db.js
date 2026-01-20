// db/db.js

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql', 
        port: process.env.DB_PORT || 3306,
        logging: false, 
        dialectOptions: {
            // AJOUT : Configuration SSL pour les bases de données distantes
            ssl: {
                require: true,
                rejectUnauthorized: false // Permet d'accepter les certificats auto-signés fréquents chez les hébergeurs
            }
        },
        timezone: '+01:00' 
    }
);

async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion à MySQL réussie !');
        
        const syncOptions = {};
        
        if (process.env.DB_FORCE_SYNC === 'true') {
            syncOptions.force = true; 
            console.log('⚠️ MODE DANGER : Réinitialisation complète.');
        } else if (process.env.DB_ALTER_SYNC === 'true') { 
            syncOptions.alter = true;
            console.log('🔧 Mode ALTER actif : Mise à jour des colonnes.');
        }

        await sequelize.sync(syncOptions); 
        console.log('✅ Synchronisation réussie.');
    } catch (error) {
        console.error('❌ Erreur de connexion MySQL :', error);
        // On ne coupe pas forcément le processus immédiatement sur Render, 
        // mais c'est utile pour debugger les logs.
        process.exit(1);
    }
}

module.exports = { sequelize, connectDB };