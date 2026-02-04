// const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken");

function authMiddleware(requiredRole) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
      const payload = jwt.verify(token, ACCESS_SECRET);
      req.user = payload;

      if (requiredRole && payload.role !== requiredRole)
        return res.status(403).json({ error: "Forbidden" });

      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

module.exports = { authMiddleware };
