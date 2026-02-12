const { generateToken } = require("../lib/helper");
const prisma = require("../lib/prisma");
const { v4 } = require("uuid");

const anonymousLogin = async (req, res, next) => {
  try {
    const { deviceId } = req.body;

    const id = v4();
    const username = "guest_" + id.slice(0, 6);
    if (!deviceId) {
      res.status(400).json({
        message: "deviceId required",
      });
      return;
    }

    let user = await prisma.user.findUnique({ where: { deviceId } });

    if (user) {
      const token = generateToken(user);
      res.status(200).json({
        token,
        user,
      });
      return;
    }

    user = await prisma.user.create({
      data: {
        uuid: id,
        username,
        role: "GUEST",
        deviceId,
      },
    });
    const token = generateToken(user);

    res.status(200).json({
      token,
      user,
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { anonymousLogin };
