import { BUILD_ID, REPO, gh, handleError, send } from "../lib/github.js";

// Reports a build's progress: queued -> building -> done (with a download link) or failed.
export default async function handler(req, res) {
  const id = String(req.query.id ?? "");
  if (!BUILD_ID.test(id)) return send(res, 400, { error: "Invalid build id." });
  try {
    const release = await gh(`/repos/${REPO}/releases/tags/apk-${id}`, { allow404: true });
    const apk = release?.assets?.find((a) => a.name.endsWith(".apk"));
    if (apk) {
      return send(res, 200, { state: "done", downloadUrl: apk.browser_download_url, size: apk.size });
    }

    const runs = await gh(`/repos/${REPO}/actions/runs?branch=${encodeURIComponent(`apk-build/${id}`)}&per_page=1`);
    const run = runs.workflow_runs?.[0];
    if (!run) return send(res, 200, { state: "queued" });
    if (run.status !== "completed") {
      return send(res, 200, { state: run.status === "in_progress" ? "building" : "queued", logsUrl: run.html_url });
    }
    if (run.conclusion === "success") return send(res, 200, { state: "building", logsUrl: run.html_url });
    return send(res, 200, { state: "failed", error: await failureReason(run), logsUrl: run.html_url });
  } catch (err) {
    return handleError(res, err);
  }
}

// prepare.mjs reports bad input as ::error:: annotations; surface the first one to the user.
async function failureReason(run) {
  if (run.conclusion === "cancelled") return "The build was cancelled.";
  try {
    const { jobs } = await gh(`/repos/${REPO}/actions/runs/${run.id}/jobs`);
    for (const job of jobs ?? []) {
      const notes = await gh(`/repos/${REPO}/check-runs/${job.id}/annotations`);
      const note = notes.find((n) => n.annotation_level === "failure" && !/exit code \d+/.test(n.message));
      if (note) return note.message;
    }
  } catch {
    // Fall through to the generic message.
  }
  return "The Android build failed. Open the build log for details.";
}
