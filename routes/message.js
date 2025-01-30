// backEnd/routes/message.js
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

// Obtenir les messages d'une conversation
router.get('/conversation/:receiverId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.userId, receiver: req.params.receiverId },
                { sender: req.params.receiverId, receiver: req.user.userId }
            ]
        })
        .populate('sender', 'username')
        .populate('receiver', 'username')
        .sort({ timestamp: -1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Créer un nouveau message
router.post('/', auth, async (req, res) => {
    try {
        const message = new Message({
            sender: req.user.userId,
            receiver: req.body.receiverId,
            content: req.body.content
        });
        
        const savedMessage = await message.save();
        const populatedMessage = await Message.findById(savedMessage._id)
            .populate('sender', 'username')
            .populate('receiver', 'username');
            
        res.status(201).json(populatedMessage);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
