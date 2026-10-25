# AGENTS.md

This is **one of three repos** in the Interval Tracks project. **Only this one is
published** — GitHub Pages deploys `main` via `.github/workflows/deploy.yml`.

| repo | what it is | published |
| --- | --- | --- |
| `interval-track-maker` | the generator — music, speech, mix and `itm publish` | no |
| `interval-track-editor` | a mini Strudel editor for live-coding a groove by ear | no |
| `interval-tracks` | **this repo** — the published website | yes |

## Working here

- `tracks.json`, `audio/` and `covers/` are **produced by `itm publish`** in
  `interval-track-maker` and copied in. Do **not** hand-edit `tracks.json` —
  regenerate it in the maker repo and re-publish.
- The UI files (`index.html`, `app.js`, `styles.css`) are edited **here**. Copy
  them back into the maker's `site/` before the next publish: `itm publish` copies
  `site/` over its output, so an unsynced fix is silently reverted.
- To change the audio, the speech or the mix, work in **`interval-track-maker`**
  (its `docs/runbook.md` §4 is the publish/deploy runbook).
- Audio is served from `audio/` on Pages, **not** from GitHub Release assets: iOS
  refuses the `application/octet-stream` type GitHub sends for release files. See
  `README.md`.
- Deploy: push to `main`; the workflow publishes the repository contents
  (including `audio/`). No build step.
