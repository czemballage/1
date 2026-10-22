# HTML to APK

A website that turns an HTML site (files, a ZIP, pasted HTML, or a URL) into an installable Android APK.

- **`web/`**: the website, deployed on Vercel. Static page plus three API routes: `api/build`, `api/status` and `api/config`.
- **`android/`**: a small Android app with a full-screen WebView. It has no dependencies, and the APK is about 100 KB plus your files.
- **`scripts/prepare.mjs`**: copies a build request into the Android project (name, package ID, version, icon, files).
- **`.github/workflows/build-apk.yml`**: builds and signs the APK on GitHub Actions.

## How a build works

1. The browser zips the site and sends it to `/api/build`.
2. The API commits the request to a new branch, `apk-build/<id>`. That push starts the workflow.
3. The workflow runs `prepare.mjs`, then `gradle assembleRelease`, and signs the APK.
4. The APK is published as a prerelease named `apk-<id>`, and the branch is deleted.
5. The page polls `/api/status` until the download link appears.

Builds older than 24 hours are deleted automatically.

## Vercel environment variables

| Name | Required | Value |
| --- | --- | --- |
| `GITHUB_TOKEN` | yes | A fine-grained token for this repo with **Contents: Read and write** and **Actions: Read only**. |
| `GITHUB_REPO` | no | The repo that runs the builds. Default: `czemballage/1`. |
| `GITHUB_BASE_BRANCH` | no | The branch whose workflow and template are used. Default: the repo's default branch. |
| `ACCESS_CODE` | no | If set, visitors must enter this code to start a build. This stops strangers from using your build minutes. |

## Signing

Every build gets a fresh signing key unless these repository secrets are set: `APK_KEYSTORE_BASE64`, `APK_KEYSTORE_PASSWORD`, `APK_KEY_ALIAS` and `APK_KEY_PASSWORD`. A fresh key is fine for sideloading. To publish updates of the same app, or to use Google Play, set these secrets so every build uses the same key.
