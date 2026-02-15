const express = require("express");
const cors = require("cors");

const app = express();

// middleware
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

app.use(require("./routes/drama"));
app.use(require("./routes/auth"));
app.use(require("./routes/user"));
app.use(require("./routes/comment"));

module.exports = { app };
