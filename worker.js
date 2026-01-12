const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { chromium } = require("playwright");
const { sanitizeFilename, ensureDirs } = require("./utils");

const URLS_FILE = path.join(__dirname, "data/urls.csv");

/**
 * Read URLs from CSV
 */
async function readUrls() {
  return new Promise((resolve) => {
    const results = [];
    fs.createReadStream(URLS_FILE)
      .pipe(csv())
      .on("data", (data) => {
        if (data.url) results.push(data.url.trim());
      })
      .on("end", () => resolve(results));
  });
}

/**
 * Capture PSI performance section screenshot
 */
async function takeScreenshot(browser, url, mode) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const psiUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(
    url
  )}&form_factor=${mode}`;

  await page.goto(psiUrl, { waitUntil: "networkidle" });

  // Wait until Lighthouse UI finishes rendering
  await page.waitForSelector('div[role="tabpanel"]', {
    timeout: 90000
  });

  const performanceSection = await page.$('div[role="tabpanel"]');

  // Scroll into view for stable capture
  await performanceSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);

  const filename = sanitizeFilename(url);
  const savePath = path.join(
    __dirname,
    `screenshots/${mode}/${filename}.png`
  );

  await performanceSection.screenshot({ path: savePath });

  await page.close();

  console.log(`Saved ${mode} performance screenshot for ${url}`);
}

/**
 * Main runner
 * Launches a fresh browser per URL (memory-safe)
 */
async function start() {
  await ensureDirs();
  const urls = await readUrls();

  console.log(`Found ${urls.length} URLs`);

  for (const url of urls) {
    let browser = null;

    try {
      console.log(`Processing ${url}`);

      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      });

      await takeScreenshot(browser, url, "mobile");
      await takeScreenshot(browser, url, "desktop");

      await browser.close();
      browser = null;

      // Throttle to avoid Google blocking
      await new Promise((r) => setTimeout(r, 15000));
    } catch (err) {
      console.error(`Failed for ${url}`, err.message);

      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
    }
  }

  console.log("All done");
}

start();
