// middleware/auth.js (CORRECTION FINALE)

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
    // 1. Récupérer le token du header (Authorization: Bearer [token])
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé. Token manquant.' });
    }

    try {
        // 2. Vérifier et décoder le token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. CORRECTION CLÉ: Attacher l'objet décodé COMPLET
        // Le statut isAdmin est désormais lu directement ici, sans interroger la BDD.
        req.user = { 
            id: decoded.id, 
            username: decoded.username,
            isAdmin: decoded.isAdmin // L'information est lue directement du JWT
        };
        next(); 
    } catch (error) {
        res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
};

module.exports = auth;