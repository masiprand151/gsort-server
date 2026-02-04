const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const ACCESS_SECRET = process.env.ACCESS_SECRET || "access_secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "refresh_secret";
const anonymous = async (req, res, next) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID required" });
    }

    // cek apakah user anonymous sudah ada untuk device ini
    let user = await prisma.user.findUnique({ where: { deviceId } });

    if (!user) {
      // belum ada → buat baru
      user = await prisma.user.create({
        data: {
          isAnonymous: true,
          role: "ANONYMOUS",
          deviceId,
        },
      });
    }

    // generate token
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      ACCESS_SECRET,
      { expiresIn: "15m" },
    );
    const refreshToken = crypto.randomBytes(64).toString("hex");

    // simpan refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(user ? 200 : 201).json({
      accessToken,
      refreshToken,
      userId: user.id,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const social = async (req, res, next) => {
  const { facebookId, googleId, username } = req.body;

  // cek user berdasarkan socialId
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { facebookId: facebookId || undefined },
        { googleId: googleId || undefined },
      ],
    },
  });

  if (!user) {
    // buat baru & sambungkan username optional
    user = await prisma.user.create({
      data: {
        username,
        isAnonymous: false,
        role: "CREATOR", // misal social login otomatis creator
        facebookId,
        googleId,
      },
    });
  } else {
    // jika sebelumnya anonymous, upgrade role
    if (user.isAnonymous) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isAnonymous: false, role: "CREATOR" },
      });
    }
  }

  // generate token
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" },
  );
  const refreshToken = crypto.randomBytes(64).toString("hex");
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

  res.json({ accessToken, refreshToken, userId: user.id, role: user.role });
};

const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  const user = await prisma.user.findFirst({ where: { refreshToken } });
  if (!user) return res.status(401).json({ error: "Invalid refresh token" });

  const newAccessToken = jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" },
  );
  const newRefreshToken = crypto.randomBytes(64).toString("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
};

module.exports = { anonymous, refresh, social };
