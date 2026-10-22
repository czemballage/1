// Minimal GitHub REST client for the build API. Configured through Vercel environment variables:
//   GITHUB_TOKEN        fine-grained token with "Contents: read & write" and "Actions: read" on the repo
//   GITHUB_REPO         owner/name of the repo that holds the builder workflow (default czemballage/1)
//   GITHUB_BASE_BRANCH  branch whose workflow + template are used (default: the repo's default branch)

export const REPO = process.env.GITHUB_REPO || "czemballage/1";
export const BUILD_ID = /^[a-z0-9]{8,40}$/;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function gh(path, { method = "GET", body, allow404 = false } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new HttpError(500, "The server is missing its GITHUB_TOKEN setting.");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html2apk",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    console.error(`GitHub ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    throw new HttpError(502, `GitHub request failed (${res.status}). Check the server's GitHub token and repo settings.`);
  }
  return res.status === 204 ? null : res.json();
}

export function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(data);
}

export function handleError(res, err) {
  if (err instanceof HttpError) return send(res, err.status, { error: err.message });
  console.error(err);
  return send(res, 500, { error: "Unexpected server error." });
}
