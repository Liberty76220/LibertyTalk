// models/Friendship.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/db');

const Friendship = sequelize.define('Friendship', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'accepted'),
        defaultValue: 'pending',
        allowNull: false
    },
    // Les IDs seront ajoutés par les relations (UserId1, UserId2)
}, {
    tableName: 'Friendships',
    timestamps: true
});

module.exports = Friendship;