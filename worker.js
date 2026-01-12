const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { chromium } = require("playwright");
const { sanitizeFilename, ensureDirs } = require("./utils");

const URLS_FILE = path.join(__dirname, "data/urls.csv");

async function readUrls() {
  return new Promise((resolve) => {
    const results = [];
    fs.createReadStream(URLS_FILE)
      .pipe(csv())
      .on("data", (data) => results.push(data.url))
      .on("end", () => resolve(results));
  });
}

async function takeScreenshot(browser, url, mode) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const psiUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(
    url
  )}&form_factor=${mode}`;

  await page.goto(psiUrl, { waitUntil: "networkidle" });

  // Wait for Lighthouse performance section
  await page.waitForSelector('section[aria-labelledby="performance"]', {
    timeout: 60000
  });

  const performanceSection = await page.$(
    'section[aria-labelledby="performance"]'
  );

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

async function start() {
  await ensureDirs();
  const urls = await readUrls();

  console.log(`Found ${urls.length} URLs`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  for (const url of urls) {
    try {
      console.log(`Processing ${url}`);

      await takeScreenshot(browser, url, "mobile");
      await takeScreenshot(browser, url, "desktop");

      await new Promise((r) => setTimeout(r, 15000));
    } catch (err) {
      console.error(`Failed for ${url}`, err.message);
    }
  }

  await browser.close();
  console.log("All done");
}

start();
