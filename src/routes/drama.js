const {
  getLatest,
  trending,
  search,
  play,
  getDrama,
  getById,
  getAllTags,
  follow,
  checkFollow,
} = require("../controller/drama.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const route = require("express").Router();

route.get("/api/latest", verifyToken, getLatest);
route.get("/api/trending", verifyToken, trending);
route.get("/api/search", verifyToken, search);
route.get("/api/:videoId/play", verifyToken, play);
route.get("/api/drama", verifyToken, getDrama);
route.get("/api/drama/:bookId", verifyToken, getById);
route.get("/api/tags", verifyToken, getAllTags);
route.post("/api/follow", verifyToken, follow);
route.get("/api/follow/:seriesId", verifyToken, checkFollow);

module.exports = route;
