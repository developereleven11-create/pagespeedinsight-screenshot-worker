const fs = require("fs-extra");
const path = require("path");

function sanitizeFilename(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
}

async function ensureDirs() {
  await fs.ensureDir(path.join(__dirname, "screenshots/mobile"));
  await fs.ensureDir(path.join(__dirname, "screenshots/desktop"));
}

module.exports = {
  sanitizeFilename,
  ensureDirs
};
