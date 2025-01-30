const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

module.exports = (req, res, next) => {
	const token = req.header('Authorization');
	if (!token) return res.status(401).json({ message: "Accès refusé, token manquant" });

	try {
		const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
		req.user = decoded;
		next();
	} catch (err) {
		res.status(401).json({ message: "Token invalide" });
	}
};
