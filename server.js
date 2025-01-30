const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ws = require("ws"); // Import ws
const WebSocket = require("ws");
const cors = require('cors');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/message'); // Ajouter cette ligne
const broadcast = require('./utils/broadCast'); // Ajouter l'import en haut du fichier

dotenv.config();

const app = express();


const wss = new WebSocket.Server({ port: 8070 });
const users = [];

// Structure pour stocker les utilisateurs connectés
const connectedUsers = new Map();

wss.on("connection", function connection(ws) {
    let userId = null;

    ws.on("message", function incoming(data) {
        try {
            const messageData = JSON.parse(data);
            
            switch (messageData.type) {
                case 'auth':
                    // Authentification de l'utilisateur
                    userId = messageData.userId;
                    connectedUsers.set(userId, {
                        ws: ws,
                        username: messageData.username
                    });
                    broadcastUserList();
                    break;

                case 'private_message':
                    // Gestion des messages privés
                    const recipient = connectedUsers.get(messageData.recipientId);
                    if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
                        const messageToSend = {
                            type: 'private_message',
                            content: messageData.content,
                            senderId: userId,
                            senderName: connectedUsers.get(userId).username,
                            timestamp: new Date().toISOString()
                        };
                        recipient.ws.send(JSON.stringify(messageToSend));
                        ws.send(JSON.stringify({...messageToSend, delivered: true}));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            content: 'Utilisateur non connecté'
                        }));
                    }
                    break;

                case 'broadcast':
                    // Message pour tout le monde
                    const broadcastMessage = {
                        type: 'broadcast',
                        content: messageData.content,
                        senderId: userId,
                        senderName: connectedUsers.get(userId).username,
                        timestamp: new Date().toISOString()
                    };
                    broadcast(wss, broadcastMessage, 'broadcast');
                    break;
            }
        } catch (error) {
            console.error('Erreur WebSocket:', error);
            ws.send(JSON.stringify({
                type: 'error',
                content: 'Erreur de traitement du message'
            }));
        }
    });

    ws.on("close", () => {
        if (userId) {
            connectedUsers.delete(userId);
            broadcastUserList();
        }
    });

    ws.on("error", (error) => {
        console.error('WebSocket error:', error);
        if (userId) {
            connectedUsers.delete(userId);
            broadcastUserList();
        }
    });
});

function broadcastUserList() {
    const userList = Array.from(connectedUsers.entries()).map(([id, user]) => ({
        userId: id,
        username: user.username,
        online: true
    }));

    const message = {
        type: 'user_list',
        users: userList
    };

    broadcast(wss, message, 'system');
}

// Configuration CORS plus détaillée
app.use(cors());

app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true
}).then(() => console.log("MongoDB connecté"))
	.catch(err => console.log(err));

const forumRoutes = require('./routes/forum');
app.use('/api/forum', forumRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes); // Ajouter cette ligne

const PORT = 8000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
