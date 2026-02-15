const {
  createComment,
  getComments,
  deleteComment,
} = require("../controller/comment.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const route = require("express").Router();

route.post("/api/comments", verifyToken, createComment);
route.get("/api/comments", verifyToken, getComments);
route.delete("/api/comments/:id", verifyToken, deleteComment);

module.exports = route;
