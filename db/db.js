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
        port: process.env.DB_PORT,
        logging: false, 
        dialectOptions: {},
        timezone: '+01:00' 
    }
);

// db/db.js
async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion à MySQL réussie !');
        
        const syncOptions = {};
        
        if (process.env.DB_FORCE_SYNC === 'true') {
            syncOptions.force = true; 
            console.log('⚠️ MODE DANGER : Réinitialisation complète.');
        } else if (process.env.DB_ALTER_SYNC === 'true') { // On n'utilise ALTER que si précisé
            syncOptions.alter = true;
            console.log('🔧 Mode ALTER actif : Mise à jour des colonnes.');
        }

        await sequelize.sync(syncOptions); 
        console.log('✅ Synchronisation réussie.');
    } catch (error) {
        console.error('❌ Erreur :', error);
        process.exit(1);
    }
}

module.exports = { sequelize, connectDB };