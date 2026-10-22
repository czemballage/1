#!/usr/bin/env node
// Turns a build request (build.json + site.zip + icon.png) into a ready-to-build Android project.
//
// Usage: node prepare.mjs <input-dir> <android-project-dir>
//
// Everything in the input is untrusted: values are validated, written only into
// resource/properties files with proper escaping, and never passed to a shell.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const MAX_SITE_BYTES = 100 * 1024 * 1024;
const ASSET_BASE = "https://appassets.androidplatform.net/assets/www/";

const [inputDir, projectDir] = process.argv.slice(2);
if (!inputDir || !projectDir) {
  console.error("usage: prepare.mjs <input-dir> <android-project-dir>");
  process.exit(2);
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.join(inputDir, "build.json"), "utf8"));
const cfg = validate(raw);

const appDir = path.join(projectDir, "app");
const mainDir = path.join(appDir, "src", "main");
const wwwDir = path.join(mainDir, "assets", "www");
fs.rmSync(path.join(mainDir, "assets"), { recursive: true, force: true });

let startUrl = cfg.url;
if (cfg.mode === "html") {
  const zipPath = path.join(inputDir, "site.zip");
  if (!fs.existsSync(zipPath)) fail("No website files were uploaded.");
  startUrl = ASSET_BASE + extractSite(zipPath, wwwDir).split("/").map(encodeURIComponent).join("/");
}

writeProperties(path.join(appDir, "app-config.properties"), {
  applicationId: cfg.packageId,
  versionCode: String(cfg.versionCode),
  versionName: cfg.versionName,
});

const resDir = path.join(mainDir, "res");
const valuesDir = path.join(resDir, "values");
fs.mkdirSync(valuesDir, { recursive: true });
fs.writeFileSync(
  path.join(valuesDir, "generated.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${androidString(cfg.appName)}</string>
    <string name="start_url" translatable="false">${androidString(startUrl)}</string>
    <color name="theme_color">${cfg.themeColor}</color>
    <color name="icon_background">${cfg.iconBackground}</color>
    <bool name="light_status_bar">${isLight(cfg.themeColor)}</bool>
</resources>
`,
);

writeIcons(resDir, path.join(inputDir, "icon.png"), cfg.themeColor);

console.log(`Prepared ${cfg.appName} (${cfg.packageId} ${cfg.versionName}/${cfg.versionCode}) -> ${startUrl}`);

// ---------------------------------------------------------------------------

function validate(c) {
  const out = {};
  out.appName = String(c.appName ?? "").trim();
  if (!out.appName || out.appName.length > 50) fail("App name must be 1-50 characters.");

  out.packageId = String(c.packageId ?? "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(out.packageId) || out.packageId.length > 100) {
    fail("Package ID must look like com.company.app (letters, digits, underscores, at least one dot).");
  }

  out.versionName = String(c.versionName ?? "1.0").trim();
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,29}$/.test(out.versionName)) fail("Version name must look like 1.0.0.");

  out.versionCode = Number(c.versionCode ?? 1);
  if (!Number.isInteger(out.versionCode) || out.versionCode < 1 || out.versionCode > 2100000000) {
    fail("Version code must be a whole number between 1 and 2100000000.");
  }

  out.mode = c.mode === "url" ? "url" : "html";
  if (out.mode === "url") {
    let u;
    try { u = new URL(String(c.url ?? "")); } catch { fail("Website URL is not valid."); }
    if (u.protocol !== "https:" && u.protocol !== "http:") fail("Website URL must start with http:// or https://.");
    out.url = u.href;
  }

  const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? "")) ? String(v).toUpperCase() : d);
  out.themeColor = color(c.themeColor, "#FFFFFF");
  out.iconBackground = color(c.iconBackground, "#FFFFFF");
  return out;
}

function extractSite(zipPath, dest) {
  const tmp = fs.mkdtempSync(path.join(path.dirname(zipPath), "site-"));
  try {
    // Info-ZIP strips "../" and absolute paths, so entries cannot escape tmp.
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", tmp], { stdio: "inherit" });
  } catch {
    fail("The uploaded file is not a valid ZIP archive.");
  }

  let total = 0;
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name === "__MACOSX" || entry.name === ".DS_Store" || entry.name === ".git") {
        fs.rmSync(full, { recursive: true, force: true });
        continue;
      }
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink() || !(st.isFile() || st.isDirectory())) {
        fs.rmSync(full, { force: true }); // never package files from outside the upload
      } else if (st.isDirectory()) {
        walk(full);
      } else {
        total += st.size;
        files.push(path.relative(tmp, full).split(path.sep).join("/"));
      }
    }
  })(tmp);
  if (total > MAX_SITE_BYTES) fail("Website files are larger than 100 MB.");

  // A zip of a folder usually wraps everything in one top-level directory: unwrap it.
  let root = tmp;
  for (;;) {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) root = path.join(root, entries[0].name);
    else break;
  }
  const rel = files.map((f) => path.relative(root, path.join(tmp, f)).split(path.sep).join("/")).filter((f) => !f.startsWith(".."));
  const htmlFiles = rel.filter((f) => /\.html?$/i.test(f)).sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  if (htmlFiles.length === 0) fail("No .html file was found in the upload.");
  const entry = rel.find((f) => f.toLowerCase() === "index.html") ?? htmlFiles[0];

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(root, dest, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Packaged ${rel.length} files (${(total / 1024).toFixed(0)} KB), entry page: ${entry}`);
  return entry;
}

function writeProperties(file, values) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[=:#!]/g, (m) => "\\" + m);
  fs.writeFileSync(file, Object.entries(values).map(([k, v]) => `${k}=${esc(v)}`).join("\n") + "\n");
}

function androidString(s) {
  const xml = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return xml
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/^([@?])/, "\\$1");
}

function isLight(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

function writeIcons(resDir, iconPath, fallbackColor) {
  let png;
  if (fs.existsSync(iconPath)) {
    png = fs.readFileSync(iconPath);
    if (png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) fail("App icon must be a PNG image.");
  } else {
    png = solidPng(192, fallbackColor);
  }
  const mipmap = path.join(resDir, "mipmap-xxxhdpi");
  fs.mkdirSync(mipmap, { recursive: true });
  fs.writeFileSync(path.join(mipmap, "ic_launcher_image.png"), png);

  // Legacy launchers use the bitmap directly; Android 8+ gets an adaptive icon with padding
  // so the launcher's mask does not cut off the edges.
  const mipmapDefault = path.join(resDir, "mipmap");
  fs.mkdirSync(mipmapDefault, { recursive: true });
  fs.writeFileSync(
    path.join(mipmapDefault, "ic_launcher.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@mipmap/ic_launcher_image" />
`,
  );
  const anydpi = path.join(resDir, "mipmap-anydpi-v26");
  fs.mkdirSync(anydpi, { recursive: true });
  fs.writeFileSync(
    path.join(anydpi, "ic_launcher.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/icon_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_image" android:inset="19%" />
    </foreground>
</adaptive-icon>
`,
  );
}

function solidPng(size, hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
