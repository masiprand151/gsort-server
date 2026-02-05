const {
  getLatest,
  trending,
  search,
  play,
} = require("../controller/drama.controller");

const route = require("express").Router();

route.get("/api/latest", getLatest);
route.get("/api/trending", trending);
route.get("/api/search", search);
route.get("/api/:videoId/play", play);

module.exports = route;
