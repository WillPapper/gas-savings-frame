// Found via
// https://community.render.com/t/error-could-not-found-chromium/9848/7 to get
// Puppeteer working on Render.

// Note that you'll want to also update the build command on Render to:
// yarn && yarn run install-chrome

const { join } = require("path");

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
