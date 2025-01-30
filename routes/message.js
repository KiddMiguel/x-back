const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// Obtenir tous les messages
router.get('/', auth, async (req, res) => {
    try {
        const messages = await Message.find()
            .populate('sender', 'username')
            .sort({ timestamp: -1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Créer un nouveau message
router.post('/', auth, async (req, res) => {
    try {
        let messages;
        if (Array.isArray(req.body)) {
            // Si c'est un tableau de messages
            messages = await Message.insertMany(req.body.map(msg => ({
                    sender: req.user.userId,
                    content: msg.content
            })));
        } else {
            // Si c'est un seul message
            const message = new Message({
                sender: req.user.userId,
                content: req.body.content
            });
            messages = [await message.save()];
        }

        const populatedMessages = await Message.populate(messages, { path: 'sender', select: 'username' });
        res.status(201).json(Array.isArray(req.body) ? populatedMessages : populatedMessages[0]);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
