// public/js/chat.js

// --- CONFIGURATION ET VÉRIFICATION ---
const socket = io();
const authToken = localStorage.getItem('authToken');
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');
const currentEmail = localStorage.getItem('email') || 'email_non_disponible'; 

if (!authToken || !userId || !username) {
    window.location.href = '/'; 
}

// Variables d'état de l'application
let currentServerId = null;
let currentChannelId = null;
let currentChannelName = null;
let currentVoiceChannelId = null;
let localStream = null; 
let isMuted = false;
let isDeafened = false;

// --- VARIABLES WEBRTC & AUDIO ---
let peers = {}; 
let remoteAudios = {}; 
let audioContext = null; // Pour le halo vert
let audioAnalysers = {}; // Analyseurs de son

// Éléments du DOM
const serversList = document.getElementById('servers-list');
const channelsList = document.getElementById('channels-list');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const currentServerNameEl = document.getElementById('current-server-name');
const currentChannelNameEl = document.getElementById('current-channel-name');
const addServerBtn = document.getElementById('add-server-btn'); 
const dmHomeBtn = document.getElementById('dm-home-btn'); 

// Éléments du Panneau Vocal (Contrôles)
const activeVoicePanel = document.getElementById('active-voice-panel');
const activeVoiceName = document.getElementById('active-voice-name');
const btnMute = document.getElementById('btn-mute');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnDeafen = document.getElementById('btn-deafen');

// Éléments du Profil/Modal
const pfpInput = document.getElementById('upload-pfp-input');
const bannerInput = document.getElementById('upload-banner-input');
const profileInitialEl = document.getElementById('profile-initial');
const profileUsernameEl = document.getElementById('profile-username');
const settingsBtn = document.getElementById('profile-settings-btn');
const modal = document.getElementById('profile-modal');
const closeBtn = document.querySelector('.close-btn');
const logoutBtn = document.getElementById('logout-btn');
const editUsernameInput = document.getElementById('edit-username');
const editEmailInput = document.getElementById('edit-email');
const profileEditForm = document.getElementById('profile-edit-form');

// --- ÉLÉMENTS CARTE DE PROFIL (POPUP) ---
const userCardModal = document.getElementById('user-card-modal');
const userCardBanner = document.getElementById('user-card-banner');
const userCardPfp = document.getElementById('user-card-pfp');
const userCardUsername = document.getElementById('user-card-username');
const userCardBio = document.getElementById('user-card-bio');
const closeUserCardBtn = document.getElementById('close-user-card');

// Éléments d'Administration
const modalStatusMessage = document.createElement('p');
modalStatusMessage.style.cssText = 'margin-top: 15px; margin-bottom: 10px; font-weight: bold;';
const modalContent = document.querySelector('.modal-content'); 

const adminTabs = document.getElementById('admin-tabs');
const tabButtons = document.querySelectorAll('.tab-btn');
const userListSummary = document.getElementById('user-list-summary');
const serverAdminList = document.getElementById('server-admin-list');
const refreshUsersBtn = document.getElementById('refresh-users-btn');

// Éléments de la Sidebar Membres
const membersSidebar = document.getElementById('members-sidebar');
const membersListConnected = document.getElementById('members-list-connected');
const membersListDisconnected = document.getElementById('members-list-disconnected');

// Bouton Rejoindre le Serveur (DOM)
const joinServerBtn = document.getElementById('join-server-btn');

// Suivi du statut utilisateur
const userStatuses = {}; 
userStatuses[userId] = true; 

// ÉLÉMENTS DE LA MODAL D'ALERTE PERSONNALISÉE
const customAlertModal = document.getElementById('custom-alert-modal');
const customAlertTitle = document.getElementById('custom-alert-title');
const customAlertMessage = document.getElementById('custom-alert-message');
const customAlertInputContainer = document.getElementById('custom-alert-input-container');
const customAlertInput = document.getElementById('custom-alert-input');
const customAlertOkBtn = document.getElementById('custom-alert-ok');
const customAlertCancelBtn = document.getElementById('custom-alert-cancel');
const customAlertCloseBtn = document.getElementById('custom-alert-close');


// --- FONCTIONS UTILITAIRES ---

async function authenticatedFetch(url, options = {}) {
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${authToken}`
    };
    return fetch(url, options);
}

async function sendFriendRequest(receiverUsername) {
    try {
        const response = await authenticatedFetch('/api/friends/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverUsername: receiverUsername })
        });
        const result = await response.json();
        await showCustomAlert(response.ok ? 'Succès' : 'Échec', result.message, 'alert');
    } catch (error) {
        console.error("Erreur demande ami:", error);
    }
}

function displayMessage(msg) {
    const entry = document.createElement('div');
    entry.classList.add('message-entry');
    
    const authorId = msg.author?.id || msg.authorId;
    const authorUsername = msg.author?.username || msg.username;
    const authorPfp = msg.author?.profilePicture || msg.profilePicture;

    let contentHtml = msg.content;

    if (msg.content.includes('![img]')) {
        const url = msg.content.match(/\((.*?)\)/)[1];
        contentHtml = `<img src="${url}" class="chat-media-img" style="max-width: 300px; border-radius: 8px; cursor: pointer;">`;
    } else if (msg.content.includes('![video]')) {
        const url = msg.content.match(/\((.*?)\)/)[1];
        contentHtml = `<video src="${url}" controls style="max-width: 350px; border-radius: 8px;"></video>`;
    }

    const pfpContainer = document.createElement('div');
    if (authorPfp) {
        pfpContainer.innerHTML = `<img src="${authorPfp}" class="profile-icon clickable-pfp" style="cursor: pointer; width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`;
    } else {
        pfpContainer.innerHTML = `<div class="profile-icon clickable-pfp" style="cursor: pointer;">${authorUsername.charAt(0).toUpperCase()}</div>`;
    }

    entry.innerHTML = `
        <div class="message-content">
            <div class="message-header" style="display: flex; align-items: center; gap: 10px;">
                <span class="author-name clickable-name" style="font-weight: bold; cursor: pointer; color: white;">${authorUsername}</span>
                <span class="message-timestamp" style="font-size: 10px; color: #b9bbbe;">${msg.timestamp || new Date(msg.createdAt).toLocaleTimeString('fr-FR')}</span>
            </div>
            <div class="message-text" style="margin-top: 5px;">${contentHtml}</div>
        </div>
    `;

    entry.prepend(pfpContainer.firstChild);

    entry.querySelectorAll('.clickable-pfp, .clickable-name').forEach(el => {
        el.onclick = () => showUserProfile(authorId);
    });

    messagesContainer.appendChild(entry);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function showUserProfile(targetUserId) {
    try {
        const res = await authenticatedFetch(`/api/users/${targetUserId}`);
        if (!res.ok) return;
        
        const userData = await res.json();
        
        userCardUsername.textContent = userData.username;
        userCardBio.textContent = userData.bio || "Cet utilisateur n'a pas encore de bio.";
        
        if (userData.profilePicture) {
            userCardPfp.innerHTML = `<img src="${userData.profilePicture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            userCardPfp.innerHTML = userData.username.charAt(0).toUpperCase();
        }
        
        if (userData.bannerUrl) {
            userCardBanner.style.backgroundImage = `url(${userData.bannerUrl})`;
        } else {
            userCardBanner.style.backgroundColor = "#5865f2";
            userCardBanner.style.backgroundImage = "none";
        }

        const msgBtn = document.getElementById('card-msg-btn');
        const addFriendBtn = document.getElementById('card-add-friend-btn');

        if (targetUserId === userId) {
            msgBtn.style.display = 'none';
            addFriendBtn.style.display = 'none';
        } else {
            msgBtn.style.display = 'block';
            addFriendBtn.style.display = 'block';

            msgBtn.onclick = () => {
                userCardModal.style.display = 'none';
                startDirectMessage(targetUserId, userData.username);
            };

            addFriendBtn.onclick = async () => {
                await sendFriendRequest(userData.username);
            };
        }
        
        userCardModal.style.display = 'block';
    } catch (error) {
        console.error("Erreur profil:", error);
    }
}

if (closeUserCardBtn) closeUserCardBtn.onclick = () => userCardModal.style.display = 'none';

function showCustomAlert(title, message, type = 'alert', defaultValue = '') {
    return new Promise(resolve => {
        customAlertModal.style.display = 'block';
        customAlertTitle.textContent = title;
        customAlertMessage.textContent = message;
        
        customAlertInputContainer.style.display = type === 'prompt' ? 'block' : 'none';
        customAlertCancelBtn.style.display = (type === 'prompt' || type === 'confirm') ? 'inline-block' : 'none';

        if (type === 'prompt') customAlertInput.value = defaultValue;

        customAlertOkBtn.onclick = () => {
            customAlertModal.style.display = 'none';
            resolve(type === 'prompt' ? customAlertInput.value.trim() : true);
        };

        customAlertCancelBtn.onclick = () => {
            customAlertModal.style.display = 'none';
            resolve(false);
        };
        
        customAlertCloseBtn.onclick = () => {
            customAlertModal.style.display = 'none';
            resolve(null);
        };
    });
}

function renderMembersSidebar(members) {
    if (!membersListConnected || !membersListDisconnected) return; 

    const connected = members.filter(m => userStatuses[m.id]);
    const disconnected = members.filter(m => !userStatuses[m.id]);

    membersListConnected.innerHTML = `<div class="members-list-group">Connectés — ${connected.length}</div>`;
    connected.forEach(member => {
        const role = member.isAdmin ? ' (Admin)' : '';
        membersListConnected.innerHTML += `
            <div class="member-item" data-user-id="${member.id}" data-username="${member.username}">
                <span class="status-indicator online"></span>
                <span class="member-username">${member.username}${role}</span>
            </div>
        `;
    });

    membersListDisconnected.innerHTML = `<div class="members-list-group">Déconnectés — ${disconnected.length}</div>`;
    disconnected.forEach(member => {
        const role = member.isAdmin ? ' (Admin)' : '';
        membersListDisconnected.innerHTML += `
            <div class="member-item" data-user-id="${member.id}" data-username="${member.username}">
                <span class="status-indicator offline"></span>
                <span class="member-username">${member.username}${role}</span>
            </div>
        `;
    });
    
    setupMemberClickListeners();
}

function setupMemberClickListeners() {
    document.querySelectorAll('.member-item').forEach(item => {
        item.addEventListener('click', () => {
            showUserProfile(item.dataset.userId);
        });
    });
}

async function startDirectMessage(targetUserId, targetUsername) {
    const dmChannelId = (targetUserId > userId) ? `dm-${userId}-${targetUserId}` : `dm-${targetUserId}-${userId}`;
    currentServerId = null;
    
    document.querySelectorAll('.server-icon, .dm-icon').forEach(el => el.classList.remove('active'));
    if (dmHomeBtn) dmHomeBtn.classList.add('active');
    
    currentServerNameEl.textContent = 'Messages Privés';
    membersSidebar.style.display = 'none';
    
    let friendItem = document.getElementById(`friend-${targetUserId}`);
    if (!friendItem) {
        friendItem = document.createElement('div');
        friendItem.className = 'channel-item';
        friendItem.id = `friend-${targetUserId}`;
        friendItem.innerHTML = `<span class="channel-icon">👤</span><span>${targetUsername}</span>`;
        friendItem.onclick = () => startDirectMessage(targetUserId, targetUsername);
        channelsList.appendChild(friendItem);
    }
    
    selectChannel(dmChannelId, targetUsername);
}

async function selectChannel(channelId, channelName) {
    currentChannelId = channelId;
    currentChannelName = channelName;
    currentChannelNameEl.textContent = channelId.startsWith('dm-') ? `@ ${channelName}` : `# ${channelName}`;
    messageForm.style.display = 'flex';
    messagesContainer.innerHTML = ''; 

    socket.emit('joinChannel', channelId);

    try {
        const response = await authenticatedFetch(`/api/channels/${channelId}/messages`);
        if (response.ok) {
            const messages = await response.json();
            messages.forEach(msg => displayMessage(msg));
        }
    } catch (error) {
        console.error("Erreur messages:", error);
    }
    
    if (currentServerId) {
        membersSidebar.style.display = 'block';
        const res = await authenticatedFetch(`/api/servers/${currentServerId}/members`);
        if (res.ok) renderMembersSidebar(await res.json());
    }
}

async function selectServer(serverId, serverName) {
    currentServerId = serverId;
    currentServerNameEl.textContent = serverName;
    channelsList.innerHTML = ''; 
    membersSidebar.style.display = 'block';
    
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    document.querySelectorAll('.dm-icon, .server-icon').forEach(el => el.classList.remove('active'));

    try {
        const response = await authenticatedFetch(`/api/servers/${serverId}/channels`);
        if (response.ok) {
            const channels = await response.json();
            
            if (isAdmin) {
                const adminActions = document.createElement('div');
                adminActions.style.padding = '5px 8px';
                adminActions.style.display = 'flex';
                adminActions.style.flexDirection = 'column';
                adminActions.style.gap = '5px';

                const addTextBtn = document.createElement('div');
                addTextBtn.innerHTML = '<span style="color: #5865f2; cursor: pointer; font-size: 12px; font-weight: bold;">+ Salon Texte</span>';
                addTextBtn.onclick = async () => {
                    const name = await showCustomAlert('Nouveau Salon Texte', "Nom du salon :", 'prompt');
                    if (name) createChannel(serverId, name, 'text');
                };

                const addVoiceBtn = document.createElement('div');
                addVoiceBtn.innerHTML = '<span style="color: #23a55a; cursor: pointer; font-size: 12px; font-weight: bold;">+ Salon Vocal</span>';
                addVoiceBtn.onclick = async () => {
                    const name = await showCustomAlert('Nouveau Salon Vocal', "Nom du salon :", 'prompt');
                    if (name) createChannel(serverId, name, 'voice');
                };

                adminActions.appendChild(addTextBtn);
                adminActions.appendChild(addVoiceBtn);
                channelsList.appendChild(adminActions);
                
                const sep = document.createElement('hr');
                sep.style.border = '0.5px solid #333';
                sep.style.margin = '10px 0';
                channelsList.appendChild(sep);
            }
            
            channels.forEach(channel => {
                const itemContainer = document.createElement('div');
                itemContainer.style.marginBottom = "2px";

                const item = document.createElement('div');
                item.className = 'channel-item';
                item.id = `channel-${channel.id}`; 
                const icon = channel.type === 'voice' ? '🔊' : '#';
                item.innerHTML = `<span class="channel-icon" style="margin-right:8px;">${icon}</span><span>${channel.name}</span>`;
                
                // Conteneur pour les utilisateurs vocaux
                const voiceUsersList = document.createElement('div');
                voiceUsersList.id = `voice-users-${channel.id}`;
                voiceUsersList.style.paddingLeft = "20px";
                voiceUsersList.style.display = "none"; 

                item.onclick = () => {
                    if (channel.type === 'voice') {
                        joinVoiceChannel(channel.id, channel.name);
                    } else {
                        selectChannel(channel.id, channel.name);
                    }
                };
                
                itemContainer.appendChild(item);
                itemContainer.appendChild(voiceUsersList); 
                channelsList.appendChild(itemContainer);
            });

            if (channels.length > 0 && channels[0].type === 'text') {
                selectChannel(channels[0].id, channels[0].name);
            }
        }
    } catch (error) { console.error("Erreur chargement salons:", error); }
    
    const selectedIcon = document.getElementById(`server-${serverId}`);
    if (selectedIcon) selectedIcon.classList.add('active');
}

async function createChannel(serverId, channelName, type) {
    try {
        const response = await authenticatedFetch(`/api/servers/${serverId}/channels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: channelName, type: type })
        });
        if (response.ok) {
            selectServer(serverId, currentServerNameEl.textContent);
        }
    } catch (error) { console.error(error); }
}

async function loadServers() {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    serversList.querySelectorAll('.server-icon:not(#add-server-btn):not(#join-server-btn):not(#dm-home-btn)').forEach(icon => icon.remove());

    if (addServerBtn) addServerBtn.style.display = isAdmin ? 'flex' : 'none';

    try {
        const response = await authenticatedFetch('/api/servers');
        if (response.ok) {
            const servers = await response.json();
            servers.forEach(server => {
                const icon = document.createElement('div');
                icon.className = 'server-icon';
                icon.id = `server-${server.id}`; 
                icon.textContent = server.name.charAt(0).toUpperCase();
                icon.onclick = () => selectServer(server.id, server.name);
                serversList.appendChild(icon);
            });
        }
    } catch (error) { console.error(error); }
}

async function loadFriendsList() {
    channelsList.innerHTML = `<div style="padding: 10px 15px; color: #949ba4; font-size: 11px; font-weight: 700;">MESSAGES DIRECTS</div>`;
    try {
        const response = await authenticatedFetch('/api/friends');
        if (response.ok) {
            const friends = await response.json();
            friends.forEach(friend => {
                const item = document.createElement('div');
                item.className = 'channel-item';
                item.id = `friend-${friend.id}`;
                item.innerHTML = `👤<span>${friend.username}</span>`;
                item.onclick = () => startDirectMessage(friend.id, friend.username);
                channelsList.appendChild(item);
            });
        }
    } catch (error) { console.error(error); }
}

// --- INITIALISATION ÉCOUTEURS ---

dmHomeBtn?.addEventListener('click', () => {
    currentServerId = null;
    document.querySelectorAll('.server-icon, .dm-icon').forEach(el => el.classList.remove('active'));
    dmHomeBtn.classList.add('active');
    currentServerNameEl.textContent = 'Messages Privés';
    membersSidebar.style.display = 'none';
    loadFriendsList();
    messageForm.style.display = 'none';
});

pfpInput?.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('edit-pfp-preview').innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        };
        reader.readAsDataURL(file);
    }
});

bannerInput?.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('edit-banner-preview');
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.style.backgroundSize = 'cover';
        };
        reader.readAsDataURL(file);
    }
});

profileEditForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
        let pfpUrl = localStorage.getItem('profilePicture');
        let bannerUrl = localStorage.getItem('bannerUrl');
        const context = { isMP: false, chatName: 'Profile_Update' };

        if (pfpInput.files[0]) pfpUrl = await Uploader.uploadFile(pfpInput.files[0], context);
        if (bannerInput.files[0]) bannerUrl = await Uploader.uploadFile(bannerInput.files[0], context);

        const res = await authenticatedFetch('/api/users/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: editUsernameInput.value.trim(), 
                newPassword: document.getElementById('new-password').value.trim(),
                profilePicture: pfpUrl,
                bannerUrl: bannerUrl,
                bio: document.getElementById('edit-bio').value.trim()
            })
        });

        if (res.ok) window.location.reload();
    } catch (error) { alert(error.message); }
};

socket.on('newMessage', (message) => displayMessage(message));

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content && currentChannelId) {
        socket.emit('sendMessage', {
            channelId: currentChannelId,
            senderId: userId,
            senderUsername: username,
            content: content
        });
        messageInput.value = ''; 
    }
});

settingsBtn.onclick = () => { modal.style.display = 'block'; };
closeBtn.onclick = () => modal.style.display = 'none';
logoutBtn.onclick = () => { localStorage.clear(); window.location.href = '/'; };

document.addEventListener('DOMContentLoaded', () => {
    loadServers();
    profileUsernameEl.textContent = username;
    profileInitialEl.textContent = username.charAt(0).toUpperCase();
    editUsernameInput.value = username;
    editEmailInput.value = currentEmail;
});

// --- LOGIQUE POUR REJOINDRE UN SERVEUR (Boussole) ---
if (joinServerBtn) {
    joinServerBtn.onclick = async () => {
        const serverCode = await showCustomAlert(
            "Rejoindre un serveur", 
            "Entrez le NOM exact du serveur (ex: SSBU) :", 
            "prompt"
        );

        if (serverCode) {
            try {
                const response = await authenticatedFetch('/api/servers/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: serverCode }) 
                });

                const result = await response.json();

                if (response.ok) {
                    await showCustomAlert("Succès", "Serveur rejoint !", "alert");
                    loadServers(); 
                } else {
                    await showCustomAlert("Erreur", result.message || "Serveur introuvable", "alert");
                }
            } catch (error) {
                console.error("Erreur joinServer:", error);
                await showCustomAlert("Erreur", "Problème de connexion au serveur.", "alert");
            }
        }
    };
}

// --- BOUTONS DU PANNEAU VOCAL ---

if (btnDeafen) {
    btnDeafen.onclick = () => {
        isDeafened = !isDeafened;
        
        Object.keys(remoteAudios).forEach(id => {
            if (remoteAudios[id]) remoteAudios[id].muted = isDeafened;
        });

        if (isDeafened) {
            btnDeafen.style.color = '#ed4245';
            btnDeafen.innerHTML = '<i class="fas fa-headphones-alt"></i>';
            showCustomAlert("Casque", "Son coupé.", "alert");
        } else {
            btnDeafen.style.color = '#b9bbbe';
            btnDeafen.innerHTML = '<i class="fas fa-headphones"></i>';
            showCustomAlert("Casque", "Son activé.", "alert");
        }
    };
}

if (btnMute) {
    btnMute.onclick = () => {
        if (localStream) {
            const track = localStream.getAudioTracks()[0];
            track.enabled = !track.enabled;
            isMuted = !track.enabled;
            
            if (isMuted) {
                btnMute.style.color = '#ed4245';
                btnMute.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } else {
                btnMute.style.color = '#b9bbbe';
                btnMute.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
    };
}

if (btnDisconnect) {
    btnDisconnect.onclick = () => {
        leaveVoiceChannel();
    };
}

// --- LOGIQUE VOCALE ---

async function joinVoiceChannel(channelId, channelName) {
    if (currentVoiceChannelId === channelId) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("Micro activé !");

        if (currentVoiceChannelId) {
            leaveVoiceChannel();
        }

        currentVoiceChannelId = channelId;
        
        if (activeVoicePanel) {
            activeVoicePanel.style.display = 'flex';
            if (activeVoiceName) activeVoiceName.textContent = channelName;
            
            isMuted = false;
            if (btnMute) {
                btnMute.style.color = '#b9bbbe';
                btnMute.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }

        monitorAudio(localStream, socket.id);
        
        socket.emit('joinVoiceChannel', {
            channelId: channelId,
            userId: userId,
            username: username
        });

        console.log(`Connecté au vocal : ${channelName}`);
    } catch (err) {
        console.error("Erreur accès micro:", err);
        showCustomAlert("Erreur Audio", "Impossible d'accéder au micro. Vérifiez les permissions.", "alert");
    }
}

function leaveVoiceChannel() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    Object.keys(peers).forEach(id => {
        if (peers[id]) peers[id].destroy();
        if (remoteAudios[id]) remoteAudios[id].remove();
    });

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    Object.keys(audioAnalysers).forEach(id => {
        clearInterval(audioAnalysers[id]);
        delete audioAnalysers[id];
    });

    peers = {};
    remoteAudios = {};

    if (currentVoiceChannelId) {
        socket.emit('leaveVoiceChannel', currentVoiceChannelId);
        currentVoiceChannelId = null;
    }
    
    if (activeVoicePanel) activeVoicePanel.style.display = 'none';
    
    currentChannelNameEl.textContent = currentChannelName ? `# ${currentChannelName}` : "Bienvenue !";
    console.log("Vocal quitté et micro coupé.");
}

function updateVoiceUsersUI(channelId, users) {
    document.querySelectorAll('[id^="voice-users-"]').forEach(el => {
        el.innerHTML = '';
        el.style.display = 'none';
    });

    if (users && users.length > 0) {
        const listContainer = document.getElementById(`voice-users-${channelId}`);
        if (listContainer) {
            listContainer.style.display = 'block';
            
            users.forEach(user => {
                const userDiv = document.createElement('div');
                userDiv.style.display = 'flex';
                userDiv.style.alignItems = 'center';
                userDiv.style.padding = '4px 0';
                userDiv.style.color = '#b9bbbe';
                userDiv.style.fontSize = '13px';
                
                const avatarId = `voice-avatar-${user.socketId}`;

                let avatarHtml = '';
                if (user.profilePicture) {
                    avatarHtml = `<img id="${avatarId}" src="${user.profilePicture}" style="width:24px; height:24px; border-radius:50%; margin-right:8px; object-fit:cover;">`;
                } else {
                    avatarHtml = `<div id="${avatarId}" style="width:24px; height:24px; border-radius:50%; background:#555; margin-right:8px; display:flex; align-items:center; justify-content:center; font-size:10px; color:white;">${user.username.charAt(0).toUpperCase()}</div>`;
                }

                userDiv.innerHTML = `${avatarHtml}<span>${user.username}</span>`;
                listContainer.appendChild(userDiv);
            });
        }
    }
}

function monitorAudio(stream, socketId) {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const intervalId = setInterval(() => {
            const avatar = document.getElementById(`voice-avatar-${socketId}`);
            if (!avatar) return; 

            analyser.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            if (average > 10) {
                avatar.classList.add('speaking');
            } else {
                avatar.classList.remove('speaking');
            }
        }, 100);

        audioAnalysers[socketId] = intervalId;
    } catch (e) {
        console.error("Erreur monitorAudio:", e);
    }
}

// --- LOGIQUE WEBRTC FINALE ---

socket.on('updateVoiceUI', (data) => {
    updateVoiceUsersUI(data.channelId, data.users);
});

socket.on("allVoiceUsers", users => {
    users.forEach(userID => {
        const peer = createPeer(userID, socket.id, localStream);
        peers[userID] = peer;
    });
});

socket.on("userJoinedVoice", payload => {
    const peer = addPeer(payload.signal, payload.callerID, localStream);
    peers[payload.callerID] = peer;
});

socket.on("receivingReturnedSignal", payload => {
    const item = peers[payload.id];
    item.signal(payload.signal);
});

socket.on("userLeftVoice", userID => {
    if (peers[userID]) {
        peers[userID].destroy();
        delete peers[userID];
    }
    if (remoteAudios[userID]) {
        remoteAudios[userID].remove();
        delete remoteAudios[userID];
    }
    if (audioAnalysers[userID]) {
        clearInterval(audioAnalysers[userID]);
        delete audioAnalysers[userID];
    }
});

function createPeer(userToSignal, callerID, stream) {
    const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream,
    });

    peer.on("signal", signal => {
        socket.emit("sendingSignal", { userToSignal, callerID, signal });
    });

    peer.on("stream", stream => {
        playRemoteStream(stream, userToSignal);
        monitorAudio(stream, userToSignal);
    });

    return peer;
}

function addPeer(incomingSignal, callerID, stream) {
    const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream,
    });

    peer.on("signal", signal => {
        socket.emit("returningSignal", { signal, callerID });
    });

    peer.on("stream", stream => {
        playRemoteStream(stream, callerID);
        monitorAudio(stream, callerID);
    });

    peer.signal(incomingSignal);
    return peer;
}

function playRemoteStream(stream, userID) {
    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.id = `audio-${userID}`;
    audio.autoplay = true;
    
    if (isDeafened) {
        audio.muted = true;
    }

    document.body.appendChild(audio);
    remoteAudios[userID] = audio;
}