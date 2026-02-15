const axios = require("axios");

const MELOLO_URL = process.env.MELOLO_URL;

const api = axios.create({
  baseURL: MELOLO_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "*/*",
  },
});

module.exports = api;
