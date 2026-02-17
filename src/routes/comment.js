const {
  createComment,
  getComments,
  deleteComment,
  getCommentCount,
} = require("../controller/comment.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const route = require("express").Router();

route.post("/api/comments", verifyToken, createComment);
route.get("/api/comments", verifyToken, getComments);
route.delete("/api/comments/:id", verifyToken, deleteComment);
route.get("/api/comments/:videoId", verifyToken, getCommentCount);

module.exports = route;
