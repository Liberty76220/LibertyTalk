// models/Channel.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/db');

const Channel = sequelize.define('Channel', {
    id: {
        type: DataTypes.STRING(100), 
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    // Le type accepte désormais 'voice' pour les salons vocaux
    type: {
        type: DataTypes.ENUM('text', 'voice', 'dm'),
        defaultValue: 'text',
        allowNull: false
    },
    // Configuration pour autoriser les salons sans serveur (DMs)
    serverId: {
        type: DataTypes.UUID, 
        allowNull: true,      
        references: {
            model: 'Servers', 
            key: 'id'
        }
    }
}, {
    tableName: 'Channels',
    timestamps: true
});

module.exports = Channel;