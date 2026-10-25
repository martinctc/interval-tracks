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
| `audio/` | the rendered MP3s the manifest's `audio/<slug>.mp3` URLs resolve to |
| `covers/` | generated cover art, referenced site-relative |

The audio used to live on immutable [Release assets](https://github.com/martinctc/interval-tracks/releases),
but **iOS cannot play those**: GitHub serves release files as
`Content-Type: application/octet-stream` with `Content-Disposition: attachment`,
and iOS WebKit (Safari *and* Chrome-on-iOS) refuses media with a non-audio type —
desktop Chromium sniffs the bytes and plays it anyway, which is why the failure
looked device-specific. The MP3s therefore ship with the site: GitHub Pages
serves `.mp3` as `audio/mp3` with Range support, so the player streams and seeks
normally on a phone. Regenerating a track still happens in `interval-track-maker`
and lands here through `itm publish`; nothing is re-uploaded.

## Where it comes from

This project is **three repos**, sitting side by side. Only this one is published.

| repo | what it is | published |
| --- | --- | --- |
| `interval-track-maker` | the generator — owns the music scores, speech, mix and the whole `itm publish` step | no |
| `interval-track-editor` | a mini Strudel editor for live-coding a groove by ear | no |
| `interval-tracks` | **this repo** — the published website | **yes** |

`interval-track-maker` copies the site files, a fresh `tracks.json`, the covers and
the audio into here and pushes. The manifest, `audio/` and `covers/` are generated —
regenerate them with `itm publish`, never by hand. The three UI files
(`index.html` / `app.js` / `styles.css`) *are* edited here, so copy them back into
the maker's `site/` before the next publish, which copies `site/` over its output
and would otherwise overwrite them. To change the audio, the speech or the mix,
work **there** (its `docs/runbook.md` §4 is the publish/deploy runbook). To
live-edit a groove by ear, use **`interval-track-editor`**.

Publishing is a local, manual step by design — rendering needs Playwright
Chromium, ffmpeg and an 88 MB speech model, none of which belong in CI.

## Deploying

Push to `main`. The workflow in `.github/workflows/deploy.yml` publishes the
repository contents to GitHub Pages. Nothing to build.