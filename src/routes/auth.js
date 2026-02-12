const { anonymousLogin } = require("../controller/auth.controller");

const route = require("express").Router();

route.post("/api/auth/anonymous", anonymousLogin);

module.exports = route;
