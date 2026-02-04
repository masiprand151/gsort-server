const { refresh, anonymous, social } = require("../controller/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const route = require("express").Router();

route.post("/api/auth/refresh", authMiddleware(), refresh);
route.post("/api/auth/anonymous", anonymous);
route.post("/api/auth/social", social);

module.exports = route;
