# AGENTS.md

This is **one of three repos** in the Interval Tracks project. **Only this one is
published** — GitHub Pages deploys `main` via `.github/workflows/deploy.yml`.

| repo | what it is | published |
| --- | --- | --- |
| `interval-track-maker` | the generator — music, speech, mix and `itm publish` | no |
| `interval-track-editor` | a mini Strudel editor for live-coding a groove by ear | no |
| `interval-tracks` | **this repo** — the published website | yes |

## Working here

- `tracks.json`, `index.html`, `app.js`, `styles.css` and `covers/` are **produced
  by `itm publish`** in `interval-track-maker` and copied in. Do **not** hand-edit
  `tracks.json` — regenerate it in the maker repo and re-publish.
- To change the audio, the speech or the mix, work in **`interval-track-maker`**
  (its `docs/runbook.md` §4 is the publish/deploy runbook).
- Come here only to change the **site UI** (`index.html` / `app.js` /
  `styles.css`).
- Deploy: push to `main`; the workflow publishes the repository contents. No
  build step.
