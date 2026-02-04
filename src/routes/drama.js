const {
  getLatest,
  trending,
  search,
} = require("../controller/drama.controller");

const route = require("express").Router();

route.get("/api/latest", getLatest);
route.get("/api/trending", trending);
route.get("/api/search", search);

module.exports = route;
