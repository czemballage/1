import { send } from "../lib/github.js";
import { MAX_SITE_BYTES } from "./build.js";

export default function handler(req, res) {
  send(res, 200, {
    accessCodeRequired: Boolean(process.env.ACCESS_CODE),
    maxSiteBytes: MAX_SITE_BYTES,
    configured: Boolean(process.env.GITHUB_TOKEN),
  });
}
