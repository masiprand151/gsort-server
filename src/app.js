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

app.use(require("./routes/external"));

module.exports = { app };
