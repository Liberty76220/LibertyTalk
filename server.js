// server.js - Version Fusionnée et Finalisée pour le Vocal Visuel
const express = require('express');
const path = require('path');
const http = require('http'); 
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const { connectDB } = require('./db/db'); 
const User = require('./models/User');
const Message = require('./models/Message');
const ServerModel = require('./models/Server'); 
const Channel = require('./models/Channel');
const Friendship = require('./models/Friendship');
const auth = require('./middleware/auth'); 

// --- Configuration ---
const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // 10Mo pour les médias
});

connectDB();

// --- Configuration Stockage Local (Multer) ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const userName = req.body.userName || 'Unknown';
        const context = req.body.context || 'Global';
        const chatName = req.body.chatName || 'Chat';
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
        const timeStr = `${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`;
        const ext = path.extname(file.originalname);

        const finalName = `${userName}-${context}-${chatName}-${dateStr}-${timeStr}${ext}`;
        cb(null, finalName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// --- Relations Sequelize ---
User.hasMany(ServerModel, { foreignKey: 'ownerId', as: 'OwnedServers' });
ServerModel.belongsTo(User, { foreignKey: 'ownerId', as: 'Owner' });
ServerModel.hasMany(Channel, { foreignKey: 'serverId', as: 'Channels' });
Channel.belongsTo(ServerModel, { foreignKey: 'serverId', as: 'Server' });
Channel.hasMany(Message, { foreignKey: 'channelId', as: 'Messages' });
Message.belongsTo(Channel, { foreignKey: 'channelId', as: 'Channel' });
User.hasMany(Message, { foreignKey: 'authorId', as: 'SentMessages' });
Message.belongsTo(User, { foreignKey: 'authorId', as: 'Author' });
User.belongsToMany(ServerModel, { through: 'ServerMembers', foreignKey: 'userId', as: 'Servers' });
ServerModel.belongsToMany(User, { through: 'ServerMembers', foreignKey: 'serverId', as: 'Users' });
User.belongsToMany(User, { as: 'Friends', through: Friendship, foreignKey: 'userId', otherKey: 'friendId' });

// --- Middlewares ---
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); 

const asyncHandler = (fn) => (req, res, next) => 
    Promise.resolve(fn(req, res, next)).catch(next);

// --- Route d'Upload ---
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu." });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// --- Routes Authentification ---

app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Champs requis.' });
    
    try {
        await User.create({ username, email, password });
        res.status(201).json({ message: 'Inscription réussie !' });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') 
            return res.status(400).json({ message: 'Utilisateur ou e-mail déjà utilisé.' });
        throw error;
    }
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    
    if (!user || !(await user.comparePassword(password))) {
        return res.status(400).json({ message: 'Identifiants incorrects.' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, isAdmin: user.isAdmin }, 
        process.env.JWT_SECRET, { expiresIn: '1d' }
    );

    res.json({ 
        token, userId: user.id, username: user.username, 
        email: user.email, isAdmin: user.isAdmin, profilePicture: user.profilePicture 
    });
}));

// --- Routes Profil & Amis ---

app.get('/api/users/:id', auth, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id, {
        attributes: ['id', 'username', 'profilePicture', 'bannerUrl', 'bio']
    });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    
    const pfpPath = user.profilePicture ? path.join(__dirname, 'public', user.profilePicture) : null;
    if (user.profilePicture && !fs.existsSync(pfpPath)) {
        user.profilePicture = null;
    }

    res.json(user);
}));

app.put('/api/users/profile', auth, asyncHandler(async (req, res) => {
    const { username, newPassword, profilePicture, bannerUrl, bio } = req.body;
    const user = await User.findByPk(req.user.id);

    if (username) user.username = username;
    if (newPassword) user.password = newPassword; 
    if (profilePicture) user.profilePicture = profilePicture;
    if (bannerUrl) user.bannerUrl = bannerUrl;
    if (bio !== undefined) user.bio = bio;

    await user.save();
    res.json({ 
        message: "Profil mis à jour !", 
        username: user.username, 
        profilePicture: user.profilePicture,
        bannerUrl: user.bannerUrl,
        bio: user.bio
    });
}));

app.post('/api/friends/add', auth, asyncHandler(async (req, res) => {
    const receiver = await User.findOne({ where: { username: req.body.receiverUsername } });
    if (!receiver) return res.status(404).json({ message: "Utilisateur introuvable." });
    
    const pair1 = { userId: req.user.id, friendId: receiver.id };
    const pair2 = { userId: receiver.id, friendId: req.user.id };
    
    await Promise.all([
        Friendship.findOrCreate({ where: pair1, defaults: { status: 'accepted' } }),
        Friendship.findOrCreate({ where: pair2, defaults: { status: 'accepted' } })
    ]);
    
    res.json({ message: "Ami ajouté !" });
}));

app.get('/api/friends', auth, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
        include: [{
            model: User, as: 'Friends',
            through: { attributes: [] },
            attributes: ['id', 'username', 'profilePicture']
        }]
    });
    res.json(user.Friends || []);
}));

// --- Routes Serveurs ---

app.post('/api/servers', auth, asyncHandler(async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Admin uniquement." });
    
    const newServer = await ServerModel.create({ name: req.body.name, ownerId: req.user.id });
    await newServer.addUser(req.user.id);
    await Channel.create({ id: `chan-${Date.now()}`, serverId: newServer.id, name: 'général', type: 'text' });

    res.status(201).json({ message: 'Serveur créé !', server: newServer });
}));

app.get('/api/servers', auth, asyncHandler(async (req, res) => {
    const servers = await ServerModel.findAll({
        attributes: ['id', 'name'],
        include: [{
            model: User, as: 'Users', 
            where: { id: req.user.id },
            through: { attributes: [] } 
        }]
    });
    res.json(servers || []);
}));

app.delete('/api/servers/:serverId', auth, asyncHandler(async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Admin uniquement." });
    
    const server = await ServerModel.findByPk(req.params.serverId);
    if (!server) return res.status(404).json({ message: 'Serveur non trouvé.' });
    
    await server.removeUsers(); 
    await Channel.destroy({ where: { serverId: server.id } }); 
    await server.destroy();
    
    res.json({ message: "Serveur supprimé." });
}));

app.post('/api/servers/join', auth, asyncHandler(async (req, res) => {
    const server = await ServerModel.findOne({ where: { name: req.body.code } }); 
    if (!server) return res.status(404).json({ message: "Code invalide." });

    const isMember = await server.hasUser(req.user.id);
    if (isMember) return res.status(400).json({ message: "Déjà membre." });
    
    await server.addUser(req.user.id);
    res.json({ message: "Serveur rejoint.", serverId: server.id });
}));

app.get('/api/servers/:serverId/members', auth, asyncHandler(async (req, res) => {
    const server = await ServerModel.findByPk(req.params.serverId);
    if (!server || !(await server.hasUser(req.user.id))) 
        return res.status(403).json({ message: 'Accès refusé.' });

    const members = await server.getUsers({ attributes: ['id', 'username', 'isAdmin', 'profilePicture'] });
    res.json(members);
}));

app.get('/api/servers/:serverId/channels', auth, asyncHandler(async (req, res) => {
    const server = await ServerModel.findByPk(req.params.serverId);
    if (!server || !(await server.hasUser(req.user.id))) 
        return res.status(403).json({ message: 'Accès refusé.' });
    
    const channels = await Channel.findAll({ 
        where: { serverId: req.params.serverId },
        attributes: ['id', 'name', 'type']
    });
    res.json(channels);
}));

// --- Routes Salons & Messages ---

app.post('/api/servers/:serverId/channels', auth, asyncHandler(async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Admin uniquement." });
    const { name, type } = req.body;
    const newChannel = await Channel.create({ 
        id: `chan-${Date.now()}`,
        serverId: req.params.serverId, 
        name: name, 
        type: type || 'text' 
    });
    res.status(201).json(newChannel);
}));

app.delete('/api/channels/:channelId', auth, asyncHandler(async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Admin uniquement." });
    await Message.destroy({ where: { channelId: req.params.channelId } });
    await Channel.destroy({ where: { id: req.params.channelId } });
    res.json({ message: "Salon supprimé." });
}));

app.get('/api/channels/:channelId/messages', auth, asyncHandler(async (req, res) => {
    const messages = await Message.findAll({
        where: { channelId: req.params.channelId },
        include: [{ model: User, as: 'Author', attributes: ['id', 'username', 'profilePicture'] }],
        order: [['createdAt', 'ASC']],
        limit: 50
    });
    res.json(messages.map(msg => ({
        author: { id: msg.Author.id, username: msg.Author.username, profilePicture: msg.Author.profilePicture },
        content: msg.content,
        createdAt: msg.createdAt
    })));
}));

app.get('/api/admin/users', auth, asyncHandler(async (req, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Accès refusé.' });
    const users = await User.findAll({ attributes: ['id', 'username', 'email', 'isAdmin', 'createdAt'] });
    res.json(users);
}));

// --- Socket.io ---

// Objet pour suivre qui est dans quel salon vocal
const voiceRooms = {};

io.on('connection', (socket) => {
    socket.on('registerUser', (data) => {
        socket.userId = data.userId;
        io.emit('userStatusUpdate', { userId: data.userId, isConnected: true });
    });

    socket.on('joinChannel', (channelId) => {
        socket.rooms.forEach(room => {
            if (room !== socket.id && !room.startsWith('voice-')) socket.leave(room);
        });
        socket.join(channelId);
    });

    socket.on('sendMessage', async (data) => {
        try {
            if (data.channelId?.startsWith('dm-')) {
                await Channel.findOrCreate({
                    where: { id: data.channelId },
                    defaults: { name: 'Conversation Privée', type: 'dm', serverId: null }
                });
            }

            const newMessage = await Message.create({
                channelId: data.channelId,
                authorId: data.senderId,
                content: data.content
            });

            const author = await User.findByPk(data.senderId, { attributes: ['profilePicture'] });

            io.to(data.channelId).emit('newMessage', {
                author: { id: data.senderId, username: data.senderUsername, profilePicture: author?.profilePicture || null },
                content: data.content,
                timestamp: newMessage.createdAt.toLocaleTimeString('fr-FR'),
            });
        } catch (error) {
            console.error('Socket Error:', error);
        }
    });

    // --- LOGIQUE VOCALE (WEBRTC) ---

    socket.on('joinVoiceChannel', async (data) => {
        const { channelId, userId, username } = data;
        
        // On récupère la photo de profil pour l'affichage visuel
        const user = await User.findByPk(userId);
        const pfp = user ? user.profilePicture : null;

        if (!voiceRooms[channelId]) {
            voiceRooms[channelId] = [];
        }
        
        // On ajoute l'utilisateur complet à la liste du salon
        voiceRooms[channelId].push({ socketId: socket.id, userId, username, profilePicture: pfp });
        socket.voiceChannelId = channelId;

        // 1. Mise à jour de l'interface (liste des participants) pour tout le monde
        io.emit('updateVoiceUI', { channelId, users: voiceRooms[channelId] });

        // 2. Logique WebRTC : on récupère juste les sockets des autres pour la connexion audio
        const peersInRoom = voiceRooms[channelId]
            .filter(u => u.socketId !== socket.id)
            .map(u => u.socketId);
            
        socket.emit("allVoiceUsers", peersInRoom);
    });

    socket.on("sendingSignal", payload => {
        io.to(payload.userToSignal).emit('userJoinedVoice', { 
            signal: payload.signal, 
            callerID: payload.callerID 
        });
    });

    socket.on("returningSignal", payload => {
        io.to(payload.callerID).emit('receivingReturnedSignal', { 
            signal: payload.signal, 
            id: socket.id 
        });
    });

    socket.on('leaveVoiceChannel', (channelId) => {
        if (voiceRooms[channelId]) {
            // Retirer l'utilisateur de la liste
            voiceRooms[channelId] = voiceRooms[channelId].filter(u => u.socketId !== socket.id);
            
            // Prévenir tout le monde de la mise à jour visuelle
            io.emit('updateVoiceUI', { channelId, users: voiceRooms[channelId] });
            
            // Prévenir les pairs WebRTC pour couper le son
            socket.to(`voice-${channelId}`).emit('userLeftVoice', socket.id);
        }
        socket.voiceChannelId = null;
    });

    socket.on('disconnect', () => {
        if (socket.userId) io.emit('userStatusUpdate', { userId: socket.userId, isConnected: false });
        
        // Nettoyage si déconnexion brutale du vocal
        if (socket.voiceChannelId && voiceRooms[socket.voiceChannelId]) {
            voiceRooms[socket.voiceChannelId] = voiceRooms[socket.voiceChannelId].filter(u => u.socketId !== socket.id);
            io.emit('updateVoiceUI', { channelId: socket.voiceChannelId, users: voiceRooms[socket.voiceChannelId] });
            // Pour WebRTC, la déconnexion socket coupe souvent le stream, mais on peut ajouter un emit si besoin
        }
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
});

server.listen(PORT, () => console.log(`Serveur actif sur http://localhost:${PORT}`));