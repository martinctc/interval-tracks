# Interval Tracks

Interval workout audio, generated from code rather than licensed from a library:
a music bed, bell and ping cues on every interval boundary, and sparse spoken
encouragement. Pick a shape, tap play, and the readout tracks the workout.

**Live site:** <https://martinctc.github.io/interval-tracks/>

## What is in this repository

Only the website, and deliberately so:

| file | what it is |
| --- | --- |
| `index.html`, `app.js`, `styles.css` | the whole app — vanilla, no build step, no framework |
| `tracks.json` | the manifest: every card field, the filter inputs, and the segment/cue tables the player's WORK / REST readout runs off |

There is **no audio in this repository**. `tracks.json` points at immutable
[Release assets](https://github.com/martinctc/interval-tracks/releases), one
`tracks-<date>` tag per publish, so a page load costs a few KB and every audio
URL stays cacheable forever. Regenerating a track means publishing a new tag and
updating the manifest, never re-uploading anything.

## Where it comes from

This project is **three repos**, sitting side by side. Only this one is published.

| repo | what it is | published |
| --- | --- | --- |
| `interval-track-maker` | the generator — owns the music scores, speech, mix and the whole `itm publish` step | no |
| `interval-track-editor` | a mini Strudel editor for live-coding a groove by ear | no |
| `interval-tracks` | **this repo** — the published website | **yes** |

`interval-track-maker` copies the three site files plus a fresh `tracks.json` into
here and pushes; nothing on the site is hand-edited. To change the audio, the
speech or the mix, work **there** (its `docs/runbook.md` §4 is the publish/deploy
runbook). To live-edit a groove by ear, use **`interval-track-editor`**. Come here
only to change the site UI (`index.html` / `app.js` / `styles.css`).

Publishing is a local, manual step by design — rendering needs Playwright
Chromium, ffmpeg and an 88 MB speech model, none of which belong in CI.

## Deploying

Push to `main`. The workflow in `.github/workflows/deploy.yml` publishes the
repository contents to GitHub Pages. Nothing to build.