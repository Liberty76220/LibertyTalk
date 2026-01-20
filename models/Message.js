// models/Message.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/db');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // On définit explicitement channelId ICI pour augmenter la limite de caractères
    channelId: {
        type: DataTypes.STRING(100), // On passe à 100 caractères pour supporter les longs IDs de DM
        allowNull: false
    }
    // authorId sera toujours ajouté automatiquement par la relation User.hasMany(Message)
}, {
    tableName: 'Messages',
    timestamps: true
});

module.exports = Message;