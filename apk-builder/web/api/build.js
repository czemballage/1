import crypto from "node:crypto";
import { HttpError, REPO, gh, handleError, send } from "../lib/github.js";

export const MAX_SITE_BYTES = 3 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB (base64 adds ~33%)
const MAX_ICON_BYTES = 300 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    checkAccessCode(body.accessCode);
    const config = validate(body);
    const site = config.mode === "html" ? decode(body.site, MAX_SITE_BYTES, "Website ZIP") : null;
    if (config.mode === "html" && !site) throw new HttpError(400, "Please add your website files.");
    const icon = body.icon ? decode(body.icon, MAX_ICON_BYTES, "Icon") : null;

    const id = crypto.randomBytes(8).toString("hex");
    await createBuildBranch(id, config, site, icon);
    return send(res, 202, { id });
  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 400, { error: "Invalid request body." });
    return handleError(res, err);
  }
}

function checkAccessCode(code) {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return;
  const a = Buffer.from(String(code ?? ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, "Wrong access code.");
}

// Mirrors the checks in apk-builder/scripts/prepare.mjs so users get errors before waiting on a build.
function validate(b) {
  const appName = String(b.appName ?? "").trim();
  if (!appName || appName.length > 50) throw new HttpError(400, "App name must be 1-50 characters.");
  const packageId = String(b.packageId ?? "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageId) || packageId.length > 100) {
    throw new HttpError(400, "Package ID must look like com.company.app.");
  }
  const versionName = String(b.versionName ?? "1.0").trim();
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,29}$/.test(versionName)) throw new HttpError(400, "Version name must look like 1.0.0.");
  const versionCode = Number(b.versionCode ?? 1);
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new HttpError(400, "Version code must be a whole number of at least 1.");
  }
  const mode = b.mode === "url" ? "url" : "html";
  let url;
  if (mode === "url") {
    try {
      const u = new URL(String(b.url ?? ""));
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      url = u.href;
    } catch {
      throw new HttpError(400, "Enter a full website address starting with https://");
    }
  }
  const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? "")) ? String(v) : d);
  return {
    appName, packageId, versionName, versionCode, mode, url,
    themeColor: color(b.themeColor, "#FFFFFF"),
    iconBackground: color(b.iconBackground, "#FFFFFF"),
  };
}

function decode(b64, max, label) {
  if (typeof b64 !== "string" || !b64) return null;
  const buf = Buffer.from(b64, "base64");
  if (buf.length > max) throw new HttpError(413, `${label} is too large (max ${Math.round(max / 1024 / 1024 * 10) / 10} MB).`);
  return buf;
}

// One commit on a fresh apk-build/<id> branch carries the request; pushing it starts the workflow.
async function createBuildBranch(id, config, site, icon) {
  let base = process.env.GITHUB_BASE_BRANCH;
  if (!base) base = (await gh(`/repos/${REPO}`)).default_branch;
  const ref = await gh(`/repos/${REPO}/git/ref/heads/${encodeURIComponent(base)}`);
  const parent = await gh(`/repos/${REPO}/git/commits/${ref.object.sha}`);

  const files = [["build.json", Buffer.from(JSON.stringify(config, null, 2))]];
  if (site) files.push(["site.zip", site]);
  if (icon) files.push(["icon.png", icon]);
  const tree = [];
  for (const [name, data] of files) {
    const blob = await gh(`/repos/${REPO}/git/blobs`, {
      method: "POST",
      body: { content: data.toString("base64"), encoding: "base64" },
    });
    tree.push({ path: `apk-builder/input/${name}`, mode: "100644", type: "blob", sha: blob.sha });
  }
  const newTree = await gh(`/repos/${REPO}/git/trees`, { method: "POST", body: { base_tree: parent.tree.sha, tree } });
  const commit = await gh(`/repos/${REPO}/git/commits`, {
    method: "POST",
    body: { message: `APK build ${id}: ${config.appName}`, tree: newTree.sha, parents: [parent.sha] },
  });
  await gh(`/repos/${REPO}/git/refs`, { method: "POST", body: { ref: `refs/heads/apk-build/${id}`, sha: commit.sha } });
}
