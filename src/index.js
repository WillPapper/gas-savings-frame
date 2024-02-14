const express = require("express");
const mustacheExpress = require("mustache-express");
const cors = require("cors");
// Timestamp-based UUID to bust the Farcaster Frames cache
import { v1 as uuidv1 } from "uuid";
const puppeteer = require("puppeteer");
const { createPublicClient, http } = require("viem");
const { defineChain } = require("viem");

const app = express();
app.use(express.json());
app.use(cors());
// Surface files in the public/ directory
app.use(express.static(__dirname + "/public"));

// Register '.mustache' extension with The Mustache Express
app.engine("mustache", mustacheExpress());
app.set("view engine", "mustache");
app.set("views", __dirname + "/views");

require("dotenv").config();

// If a Render External URL is provided, use that as the base URL. Otherwise, use localhost:3000
let baseUrl = process.env.RENDER_EXTERNAL_URL
  ? process.env.RENDER_EXTERNAL_URL
  : "http://localhost:3000";

let contractAddress = process.env.CONTRACT_ADDRESS
  ? process.env.CONTRACT_ADDRESS
  : "0xa4d2e7e997A837e6CB6Cf0C1607D93955C31AF7a";

const syndicateFrameChain = defineChain({
  id: 5101,
  name: "Syndicate Frame Chain",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-frame.syndicate.io"],
    },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer-frame.syndicate.io" },
  },
});

const viemClient = createPublicClient({
  chain: syndicateFrameChain,
  transport: http(),
});

const erc721Address = contractAddress;
const erc721Abi = [
  {
    name: "currentTokenId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

getActionCount().then((actionCount) => {
  console.log("Get action count: ", actionCount);
});

// Puppeteer browser instance
let browser;

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

let gasPerMint = process.env.GAS_PER_MINT
  ? process.env.GAS_PER_MINT
  : 0.000000000015883006;

// Assumes 35 gwei gas price
// Calculated via: 0.000000000015883006 * (0.000000035/0.000000000000000251)
let gasPerMintMainnet = process.env.GAS_PER_MINT_MAINNET
  ? process.env.GAS_PER_MINT_MAINNET
  : 0.002214761792828685;

let gasPerStoreData = process.env.GAS_PER_STORE_DATA
  ? process.env.GAS_PER_STORE_DATA
  : 0.00000000003338648;

// Assumes 35 gwei gas price
// Calculated via: 0.00000000003338648 * (0.000000035/0.000000000000000251)
let gasPerStoreDataMainnet = process.env.GAS_PER_STORE_DATA_MAINNET
  ? process.env.GAS_PER_STORE_DATA_MAINNET
  : 0.004655485258964143;

let gasPerDeployContract = process.env.GAS_PER_DEPLOY_CONTRACT
  ? process.env.GAS_PER_DEPLOY_CONTRACT
  : 0.000000000039484454;

// Assumes 35 gwei gas price
// Calculated via: 0.000000000039484454 * (0.000000035/0.000000000000000251)
let gasPerDeployContractMainnet = process.env.GAS_PER_DEPLOY_CONTRACT
  ? process.env.GAS_PER_DEPLOY_CONTRACT
  : 0.00550580035856573;

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
  res.render("frame-metadata", {
    baseUrl: baseUrl,
    frameImage: "frame-initial-image/" + uuidv1(),
  });
});

// If we receive a post request, we know that this is a subsequent request to
// the Frame
app.post("/", async (req, res) => {
  // Get the button index
  const buttonIndex = req.body.untrustedData.buttonIndex;

  if (buttonIndex === 1 || buttonIndex === 2 || buttonIndex === 3) {
    sendSyndicateTransaction(buttonIndex, req.body.trustedData.messageBytes);
    // Return the clicked frame state
    // Mint button was clicked
    if (buttonIndex === 1) {
      res.render("frame-metadata", {
        baseUrl: baseUrl,
        frameImage: "frame-action-mint-image",
      });
    }
    // Store data button was clicked
    else if (buttonIndex === 2) {
      res.render("frame-metadata", {
        baseUrl: baseUrl,
        frameImage: "frame-action-store-data-image",
      });
    }
    // Deploy contract button was clicked
    else if (buttonIndex === 3) {
      res.render("frame-metadata", {
        baseUrl: baseUrl,
        frameImage: "frame-action-deploy-contract-image",
      });
    }
  }
  // Refresh button was clicked
  else {
    console.log("Refresh button was clicked!");
    // Refresh the current frame
    res.render("frame-metadata", {
      baseUrl: baseUrl,
      frameImage: "frame-initial-image/" + uuidv1(),
    });
  }
});

// The UUID is purely used to bust the cache of the image
app.get("/frame-initial", async (req, res) => {
  console.log("Getting gas savings");
  let actionCount = await getActionCount();

  console.log("Action count is ", actionCount);
  console.log(
    "Gas used in USD: ",
    await estimateGasUsedMainnetUSD(actionCount)
  );
  res.render("frame-initial", {
    title: "Syndicate Gas Savings!",
    estimateGasUsedMainnetUSD: await estimateGasUsedMainnetUSD(
      Number(actionCount)
    ),
    estimateGasUsedUSD: await estimateGasUsedUSD(Number(actionCount)),
    baseUrl: baseUrl,
    actionImage: await getActionImageUri(actionCount),
  });
});

app.get("/frame-initial-image/:uuid", async (req, res) => {
  console.log("Frame initial image");
  try {
    const screenshotBuffer = await generateImage(baseUrl + "/frame-initial");
    res.setHeader("Content-Type", "image/png");
    res.send(screenshotBuffer);
  } catch (error) {
    console.error("Error generating screenshot:", error);
    res.status(500).send("Failed to generate screenshot");
  }
});

app.get("/frame-action-mint", async (req, res) => {
  res.render("frame-action", {
    title: "Syndicate Gas Savings!",
    estimateGasUsedMainnetUSD: await estimateGasUsedPerActionMainnetUSD(1),
    estimateGasUsedUSD: await estimateGasUsedPerActionUSD(1),
    baseUrl: baseUrl,
    actionImage: "img/actions/mint.png",
  });
});

app.get("/frame-action-mint-image", async (req, res) => {
  try {
    const screenshotBuffer = await generateImage(
      baseUrl + "/frame-action-mint"
    );
    res.setHeader("Content-Type", "image/png");
    res.send(screenshotBuffer);
  } catch (error) {
    console.error("Error generating screenshot:", error);
    res.status(500).send("Failed to generate screenshot");
  }
});

app.get("/frame-action-store-data", async (req, res) => {
  res.render("frame-action", {
    title: "Syndicate Gas Savings!",
    estimateGasUsedMainnetUSD: await estimateGasUsedPerActionMainnetUSD(2),
    estimateGasUsedUSD: await estimateGasUsedPerActionUSD(2),
    baseUrl: baseUrl,
    actionImage: "img/actions/store.png",
  });
});

app.get("/frame-action-store-data-image", async (req, res) => {
  try {
    const screenshotBuffer = await generateImage(
      baseUrl + "/frame-action-store-data"
    );
    res.setHeader("Content-Type", "image/png");
    res.send(screenshotBuffer);
  } catch (error) {
    console.error("Error generating screenshot:", error);
    res.status(500).send("Failed to generate screenshot");
  }
});

app.get("/frame-action-deploy-contract", async (req, res) => {
  res.render("frame-action", {
    title: "Syndicate Gas Savings!",
    estimateGasUsedMainnetUSD: await estimateGasUsedPerActionMainnetUSD(3),
    estimateGasUsedUSD: await estimateGasUsedPerActionUSD(3),
    baseUrl: baseUrl,
    actionImage: "img/actions/deploy.png",
  });
});

app.get("/frame-action-deploy-contract-image", async (req, res) => {
  try {
    const screenshotBuffer = await generateImage(
      baseUrl + "/frame-action-deploy-contract"
    );
    res.setHeader("Content-Type", "image/png");
    res.send(screenshotBuffer);
  } catch (error) {
    console.error("Error generating screenshot:", error);
    res.status(500).send("Failed to generate screenshot");
  }
});

app.get("/metadata/:actionCount", async (req, res) => {
  const actionCount = parseInt(req.params.actionCount, 10); // Capture the dynamic part of the URL

  if (actionCount > 0 && actionCount < 15) {
    res.sendFile(__dirname + "/public/metadata/1.json");
  } else if (actionCount >= 15 && actionCount < 50) {
    res.sendFile(__dirname + "/public/metadata/2.json");
  } else if (actionCount >= 50 && actionCount < 100) {
    res.sendFile(__dirname + "/public/metadata/3.json");
  } else if (actionCount >= 100 && actionCount < 200) {
    res.sendFile(__dirname + "/public/metadata/4.json");
  } else if (actionCount >= 200 && actionCount < 400) {
    res.sendFile(__dirname + "/public/metadata/5.json");
  } else if (actionCount >= 400 && actionCount < 800) {
    res.sendFile(__dirname + "/public/metadata/6.json");
  } else if (actionCount >= 800 && actionCount < 2000) {
    res.sendFile(__dirname + "/public/metadata/7.json");
  } else if (actionCount >= 2000 && actionCount < 4000) {
    res.sendFile(__dirname + "/public/metadata/8.json");
  } else if (actionCount >= 4000 && actionCount < 8000) {
    res.sendFile(__dirname + "/public/metadata/9.json");
  } else if (actionCount >= 8000 && actionCount < 16000) {
    res.sendFile(__dirname + "/public/metadata/10.json");
  } else if (actionCount >= 16000 && actionCount < 32000) {
    res.sendFile(__dirname + "/public/metadata/11.json");
  } else if (actionCount >= 32000 && actionCount < 64000) {
    res.sendFile(__dirname + "/public/metadata/12.json");
  } else if (actionCount >= 64000 && actionCount < 128000) {
    res.sendFile(__dirname + "/public/metadata/13.json");
  }
  // Placeholder before adding more actions
  else {
    res.sendFile(__dirname + "/public/metadata/13.json");
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

async function estimateGasUsedUSD(actionCount) {
  return Number(gasPerAction * actionCount * ethPriceUsd).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    }
  );
}

async function estimateGasUsedMainnetUSD(actionCount) {
  return Number(gasPerActionMainnet * actionCount * ethPriceUsd).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

async function estimateGasUsedPerActionUSD(buttonIndex) {
  if (buttonIndex === 1) {
    return Number(gasPerMint * ethPriceUsd).toLocaleString("en-US", {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    });
  } else if (buttonIndex === 2) {
    return Number(gasPerStoreData * ethPriceUsd).toLocaleString("en-US", {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    });
  } else if (buttonIndex === 3) {
    return Number(gasPerDeployContract * ethPriceUsd).toLocaleString("en-US", {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
    });
  }
}

async function estimateGasUsedPerActionMainnetUSD(buttonIndex) {
  if (buttonIndex === 1) {
    return Number(gasPerMintMainnet * ethPriceUsd).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (buttonIndex === 2) {
    return Number(gasPerStoreDataMainnet * ethPriceUsd).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  } else if (buttonIndex === 3) {
    return Number(gasPerDeployContractMainnet * ethPriceUsd).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }
}

async function getActionCount() {
  let actionCount;
  try {
    actionCount = await viemClient.readContract({
      address: erc721Address,
      abi: erc721Abi,
      functionName: "currentTokenId",
    });
  } catch {
    console.log("ERROR: Could not get action count");
  }
  // Convert from bigint to a Number and then to a string to avoid "178n" with n
  // being appended to balances
  // This is safe given that the balance will not exceed the max size of a
  // Javascript number
  return Number(actionCount).toString();
}

async function getActionImageUri(actionCount) {
  if (actionCount > 0 && actionCount < 15) {
    return "img/1-Single.png";
  } else if (actionCount >= 15 && actionCount < 50) {
    return "img/2-Few.png";
  } else if (actionCount >= 50 && actionCount < 100) {
    return "img/3-Several.png";
  } else if (actionCount >= 100 && actionCount < 200) {
    return "img/4-More.png";
  } else if (actionCount >= 200 && actionCount < 400) {
    return "img/5-Ramping.png";
  } else if (actionCount >= 400 && actionCount < 800) {
    return "img/6-Many.png";
  } else if (actionCount >= 800 && actionCount < 2000) {
    return "img/7-Rich.png";
  } else if (actionCount >= 2000 && actionCount < 4000) {
    return "img/8-Lots.png";
  } else if (actionCount >= 4000 && actionCount < 8000) {
    return "img/9-Mountain.png";
  } else if (actionCount >= 8000 && actionCount < 16000) {
    return "img/10-City.png";
  } else if (actionCount >= 16000 && actionCount < 32000) {
    return "img/11-Country.png";
  } else if (actionCount >= 32000 && actionCount < 64000) {
    return "img/12-Globe.png";
  } else if (actionCount >= 64000 && actionCount < 128000) {
    return "img/13-Infinity.png";
  }
  // Placeholder before adding more actions
  else {
    return "img/13-Infinity.png";
  }
}

async function sendSyndicateTransaction(buttonIndex, frameTrustedData) {
  // Default value and also used for the mint button of buttonIndex 1
  console.log("sendSyndicateTransaction Button index: ", buttonIndex);
  console.log(
    "sendSyndicateTransaction Frame trusted data: ",
    frameTrustedData
  );
  let functionSignature = "mint(address to)";
  // Store data button was clicked
  if (buttonIndex === 2) {
    functionSignature = "storeData(address)";
  }
  // Deploy contract button was clicked
  else if (buttonIndex === 3) {
    functionSignature = "deployContract(address)";
  }
  const res = await fetch("https://frame.syndicate.io/api/v2/sendTransaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.SYNDICATE_FRAME_API_KEY,
    },
    body: JSON.stringify({
      frameTrustedData: frameTrustedData,
      contractAddress: contractAddress,
      functionSignature: functionSignature,
      args: { to: "{frame-user}" },
    }),
  });
  console.log(
    "sendSyndicateTransaction Syndicate transaction response: ",
    await res.json()
  );
}
