// models/Server.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/db');

const ServerModel = sequelize.define('Server', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    // NOUVEAU : Ajout d'une icône pour le serveur (Base64)
    icon: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        defaultValue: null // Si null, on affichera l'initiale du nom
    }
    // ownerId est ajouté automatiquement par la relation définie dans server.js
}, {
    tableName: 'Servers',
    timestamps: true
});

module.exports = ServerModel;