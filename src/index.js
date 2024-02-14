const express = require("express");
const mustacheExpress = require("mustache-express");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const { ethers } = require("ethers");

const app = express();
app.use(bodyParser.json());
app.use(cors());

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

// Close the browser when the process is terminated
process.on("SIGINT", async () => {
  console.log("Closing browser");
  if (browser) await browser.close();
  process.exit();
});

// If we receive a get request, we know that this is the initial request to the
// Frame
app.get("/", async (req, res) => {
  res.render("frame-image", {
    title: "Hello, Mustache!",
    message: "Mustache is working with Express!",
  });
});

app.get("/frame-image", async (req, res) => {
  try {
    const screenshotBuffer = await generateImage(baseUrl);
    res.setHeader("Content-Type", "image/png");
    res.send(screenshotBuffer);
  } catch (error) {
    console.error("Error generating screenshot:", error);
    res.status(500).send("Failed to generate screenshot");
  }
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
async function generateImage(url, width = 1910, aspectRatio = 1.91) {
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
