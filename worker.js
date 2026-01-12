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
 * Capture PageSpeed Insights performance screenshot
 * Uses desktop viewport for both mobile & desktop scores
 */
async function takeScreenshot(browser, url, mode) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const psiUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(
    url
  )}&form_factor=${mode}`;

  await page.goto(psiUrl, { waitUntil: "networkidle" });

  // 1. Wait for active Lighthouse tab
  await page.waitForSelector(
    'div[role="tabpanel"][data-tab-panel-active="true"]',
    { timeout: 120000 }
  );

  // 2. Wait for Performance metrics section inside the active tab
  const performanceSection = await page.waitForSelector(
    'section[aria-labelledby="performance"]',
    { timeout: 120000 }
  );

  // 3. Scroll metrics into view (this is the key fix)
  await performanceSection.scrollIntoViewIfNeeded();

  // 4. Allow PSI animations & numbers to settle
  await page.waitForTimeout(2000);

  const filename = sanitizeFilename(url);
  const savePath = path.join(
    __dirname,
    `screenshots/${mode}/${filename}.png`
  );

  // 5. Screenshot ONLY the metrics section
  await performanceSection.screenshot({ path: savePath });

  await page.close();

  console.log(`Saved ${mode} performance screenshot for ${url}`);
}


/**
 * Main runner
 * One browser per URL (memory-safe for small droplets)
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

      // Throttle to avoid PSI rate limiting
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
