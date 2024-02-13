const express = require("express");
const mustacheExpress = require("mustache-express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Register '.mustache' extension with The Mustache Express
app.engine("mustache", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", __dirname + "/views");

require("dotenv").config();

// If we receive a get request, we know that this is the initial request to the
// Frame
app.get("/", async (req, res) => {
  res.render("index", {
    title: "Hello, Mustache!",
    message: "Mustache is working with Express!",
  });
});

// If we receive a post request, we know that this is a subsequent request to
// the Frame
app.post("/", async (req, res) => {
  // Return the HTML file
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/healthz", async (req, res) => {
  res.send("ok");
});

const port = process.env.NODE_ENV === "production" ? 80 : 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
