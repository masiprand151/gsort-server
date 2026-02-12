const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

/**
 * 🔐 1️⃣ VERIFY TOKEN (WAJIB LOGIN)
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    // Optional: cek user masih ada di DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // inject full user object
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * 🟢 2️⃣ OPTIONAL AUTH (boleh login / tidak)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    req.user = user || null;
    next();
  } catch {
    req.user = null;
    next();
  }
};

/**
 * 🚫 3️⃣ REQUIRE REAL USER (bukan GUEST)
 */
const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role === "GUEST") {
    return res.status(403).json({
      message: "Guest cannot perform this action",
    });
  }

  next();
};

/**
 * 👑 4️⃣ REQUIRE ROLE (ADMIN, USER, dll)
 */
const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient role",
      });
    }

    next();
  };
};

module.exports = { requireRole, requireUser, verifyToken };
