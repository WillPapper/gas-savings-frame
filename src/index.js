const express = require("express");
const mustacheExpress = require("mustache-express");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const { ethers } = require("ethers");

const app = express();
app.use(bodyParser.json());
app.use(cors());
// Surface files in the public/ directory
app.use(express.static(__dirname + "/public"));

// Register '.mustache' extension with The Mustache Express
app.engine("mustache", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", __dirname + "/views");

require("dotenv").config();

// Puppeteer browser instance
let browser;
// If a Render External URL is provided, use that as the base URL. Otherwise, use localhost:3000
let baseUrl = process.env.RENDER_EXTERNAL_URL
  ? process.env.RENDER_EXTERNAL_URL
  : "http://localhost:3000";

// Gas calculation info
// Average gas for all three of the actions
// Calculated via (0.000000000015883006 + 0.00000000003338648 + 0.000000000039484454)/3
// See mint: https://explorer-frame.syndicate.io/tx/0xd65b922e05ea3292c8b1c1b52399fae80138504c4f331059b23a70ed125673e9
// Store data: https://explorer-frame.syndicate.io/tx/0x977f0fc87ef1a100b1826eb7960404ab52421fdf62ccbeeaa69bca685b8f5328
// Deploy contract: https://explorer-frame.syndicate.io/tx/0x402d9cc948f2fffd3bdbfa05ed84edb20b777c9cacb9493af576fb4b59b5b33d
// All values are in ETH
let gasPerAction = process.env.GAS_PER_ACTION
  ? process.env.GAS_PER_ACTION
  : 0.000000000029584646;

// Assumes 35 gwei gas price
// Calculated via:
// ((0.000000000015883006 + 0.00000000003338648 + 0.000000000039484454)/3) * (0.000000035/0.000000000000000251)
// All values are in ETH
let gasPerActionMainnet = process.env.GAS_PER_ACTION_MAINNET
  ? process.env.GAS_PER_ACTION_MAINNET
  : 0.004125349136786188;

let ethPriceUsd = process.env.GAS_PRICE_USD
  ? process.env.GAS_PRICE_USD
  : 2744.22;

// Close the browser when the process is terminated
process.on("SIGINT", async () => {
  console.log("Closing browser");
  if (browser) await browser.close();
  process.exit();
});

// If we receive a get request, we know that this is the initial request to the
// Frame
app.get("/", async (req, res) => {
  // Return the initial frame state
  res.render("frame-initial-metadata", {
    baseUrl: baseUrl,
  });
});

// If we receive a post request, we know that this is a subsequent request to
// the Frame
app.post("/", async (req, res) => {
  // Return the updated frame state
});

app.get("/frame-initial", async (req, res) => {
  res.render("frame-initial", {
    title: "Hello, Mustache!",
    message: "Mustache is working with Express!",
  });
});

app.get("/frame-initial-image", async (req, res) => {
  try {
    const screenshotBuffer = await generateImage(baseUrl + "/frame-initial");
    res.setHeader("Content-Type", "image/png");
    res.send(screenshotBuffer);
  } catch (error) {
    console.error("Error generating screenshot:", error);
    res.status(500).send("Failed to generate screenshot");
  }
});

app.get("/healthz", async (req, res) => {
  res.send("ok");
});

// Start the Express server
const port = process.env.NODE_ENV === "production" ? 80 : 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  startBrowser(); // Launch the browser when the server starts
});

// Start the browser for Puppeteer
async function startBrowser() {
  browser = await puppeteer.launch();
}

// Function to generate a screenshot of a given URL and return as a buffer
// Aspect ratio of 1.91 is the aspect ratio of the Frame: https://docs.farcaster.xyz/reference/frames/spec
// Use 800 x 418 pixels as the default size for the 1.91 aspect ratio
async function generateImage(url, width = 800, aspectRatio = 1.91) {
  const height = Math.round(width / aspectRatio);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // Set viewport to match the Frame aspect ratio
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: "networkidle2" });

  // Take screenshot and return it to the Express server
  const screenshotBuffer = await page.screenshot({ encoding: "binary" });
  await browser.close();
  return screenshotBuffer;
}

async function estimateGasUsed() {}
