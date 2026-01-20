// models/User.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/db');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    isAdmin: { 
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    isOnline: { 
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    // Stockage pour la photo de profil (chemin local ou Base64)
    profilePicture: {
        type: DataTypes.TEXT('long'), 
        allowNull: true,
        defaultValue: null
    },
    // NOUVEAU : Champ pour la bannière de profil
    bannerUrl: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        defaultValue: null
    },
    // NOUVEAU : Champ pour la biographie utilisateur
    bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "Cet utilisateur n'a pas encore de bio."
    }
}, {
    tableName: 'Users', 
    timestamps: true, 
    hooks: {
        // Hachage du mot de passe à la création
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        // Hachage du mot de passe à la mise à jour (seulement si modifié)
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Méthode pour vérifier le mot de passe lors du login
User.prototype.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;