const {
  getLatest,
  trending,
  search,
  play,
  getDrama,
  getById,
} = require("../controller/drama.controller");

const route = require("express").Router();

route.get("/api/latest", getLatest);
route.get("/api/trending", trending);
route.get("/api/search", search);
route.get("/api/:videoId/play", play);
route.get("/api/drama", getDrama);
route.get("/api/drama/:bookId", getById);

module.exports = route;
