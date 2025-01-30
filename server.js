const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ws = require("ws"); // Import ws
const WebSocket = require("ws");
const cors = require('cors');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/message'); // Ajouter cette ligne
const Message = require('./models/Message'); // Ajouter cet import
const User = require('./models/User'); // Ajouter l'import de User s'il n'existe pas déjà

dotenv.config();

const app = express();


const wss = new WebSocket.Server({ port: 8070 });
const users = [];

// Structure pour stocker les utilisateurs connectés
const connectedUsers = new Map();

wss.on("connection", function connection(ws) {
    let userId = null;
    let userInfo = null;

    ws.on("message", async function incoming(data) {
        try {
            const messageData = JSON.parse(data);
            // console.log('Message reçu:', messageData);

            switch (messageData.type) {
                case 'auth':
                    userId = messageData.userId;
                    userInfo = {
                        ws: ws,
                        username: messageData.username,
                        status: 'online'
                    };
                    connectedUsers.set(userId, userInfo);
                    broadcastUserList();
                    // Envoyer l'historique des messages à l'utilisateur qui vient de se connecter
                    sendMessageHistory(ws, userId);
                    break;

                case 'private_message':
                    if (!userId) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            content: 'Vous devez être authentifié'
                        }));
                        return;
                    }

                    const recipient = connectedUsers.get(messageData.recipientId);
                    const messageToStore = new Message({
                        sender: userId,
                        receiver: messageData.recipientId,
                        content: messageData.content
                    });

                    await messageToStore.save();

                    // Mise à jour du lastMessage pour l'expéditeur et le destinataire
                    await Promise.all([
                        User.findByIdAndUpdate(userId, { 
                            lastMessage: messageData.content,
                            lastMessageTimestamp: new Date()
                        }),
                        User.findByIdAndUpdate(messageData.recipientId, { 
                            lastMessage: messageData.content,
                            lastMessageTimestamp: new Date()
                        })
                    ]);

                    const messageToSend = {
                        type: 'private_message',
                        messageId: messageToStore._id,
                        content: messageData.content,
                        senderId: userId,
                        senderName: userInfo.username,
                        timestamp: new Date().toISOString()
                    };

                    // Envoyer au destinataire s'il est connecté
                    if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
                        recipient.ws.send(JSON.stringify(messageToSend));
                        ws.send(JSON.stringify({
                            ...messageToSend,
                            status: 'delivered'
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            ...messageToSend,
                            status: 'pending'
                        }));
                    }
                    break;

                case 'typing':
                    const typingRecipient = connectedUsers.get(messageData.recipientId);
                    if (typingRecipient && typingRecipient.ws.readyState === WebSocket.OPEN) {
                        typingRecipient.ws.send(JSON.stringify({
                            type: 'typing',
                            senderId: userId,
                            senderName: userInfo.username,
                            isTyping: messageData.isTyping
                        }));
                    }
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

async function sendMessageHistory(ws, userId) {
    try {
        const messages = await Message.find({
            $or: [
                { sender: userId },
                { recipient: userId }
            ]
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('sender', 'username');

        ws.send(JSON.stringify({
            type: 'message_history',
            messages: messages
        }));
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'historique:', error);
    }
}

function broadcastUserList() {
	console.log('Broadcasting user list', connectedUsers);
    const userList = Array.from(connectedUsers.entries()).map(([id, user]) => ({
        userId: id,
        username: user.username,
        status: user.status
    }));

    const message = JSON.stringify({
        type: 'user_list',
        users: userList
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
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
