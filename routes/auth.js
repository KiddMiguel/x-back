const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

router.post('/register', [
	body('*.username').notEmpty().withMessage("Le nom d'utilisateur est requis"),
	body('*.email').isEmail().withMessage("Email invalide"),
	body('*.password').isLength({ min: 6 }).withMessage("Le mot de passe doit avoir au moins 6 caractères")
], async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

	try {
		const data = Array.isArray(req.body) ? req.body : [req.body];
		const results = [];

		for (const userData of data) {
			const { username, email, password } = userData;

			let existingUser = await User.findOne({ email });
			if (existingUser) {
				results.push({ email, status: 'error', message: "Email déjà utilisé" });
				continue;
			}

			const hashedPassword = await bcrypt.hash(password, 10);
			const user = new User({ username, email, password: hashedPassword });
			await user.save();

			const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
			results.push({
				status: 'success',
				token,
				user: { id: user.id, username, email }
			});
		}

		const response = Array.isArray(req.body) ? results : results[0];
		res.status(201).json(response);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// Connexion
router.post('/login', [
	body('email').isEmail().withMessage("Email invalide"),
	body('password').notEmpty().withMessage("Mot de passe requis")
], async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

	const { email, password } = req.body;

	try {
		const user = await User.findOne({ email });
		if (!user) return res.status(400).json({ message: "Identifiants incorrects" });

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) return res.status(400).json({ message: "Identifiants incorrects" });

		const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
		res.json({ token, user: { id: user.id, username: user.username, email } });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// Recupérer les utilisateurs les user sous ce format  { id: 1, username: "John Doe", lastMessage: "Salut !" },
router.get('/users', async (req, res) => {
	try {
		const users = await User.find()
			.select('_id username lastMessage')
			.lean().limit(10);

		const formattedUsers = users.map(user => ({
			id: user._id,
			username: user.username,
			lastMessage: user.lastMessage || "Pas de message"
		}));

		res.json(formattedUsers);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;
