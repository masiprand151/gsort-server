const { profile } = require("../controller/user.controller");

const route = require("express").Router();

route.get("/api/user/profile", profile);

module.exports = route;
