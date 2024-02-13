const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");

const app = express();
app.use(bodyParser.json());
app.use(cors());

require("dotenv").config();

// If we receive a get request, we know that this is the initial request to the
// Frame
app.get("/gas-savings-frame", async (req, res) => {});

// If we receive a post request, we know that this is a subsequent request to
// the Frame
app.post("/gas-savings-frame", async (req, res) => {});
