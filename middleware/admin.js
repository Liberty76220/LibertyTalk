// middleware/admin.js

const User = require('../models/User'); // Nécessaire pour vérifier le rôle

const adminMiddleware = async (req, res, next) => {
    // L'ID utilisateur a été injecté par le middleware 'auth'
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Non authentifié.' });
    }

    try {
        const user = await User.findByPk(req.user.id);

        if (!user || !user.isAdmin) {
            // Statut 403 Forbidden
            return res.status(403).json({ message: 'Accès refusé. Nécessite des privilèges d\'administrateur.' });
        }
        
        // Si l'utilisateur est admin, on continue
        next();
        
    } catch (error) {
        console.error('Erreur de vérification admin:', error);
        res.status(500).json({ message: 'Erreur de vérification des permissions.' });
    }
};

module.exports = adminMiddleware;