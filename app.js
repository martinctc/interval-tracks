'use strict';

/**
 * The site logic: filter tracks.json into a card grid, then play one with a live
 * WORK/REST readout driven by the manifest's `segments`.
 *
 * No framework and no build step on purpose — the manifest is the contract, so
 * everything here is a read of `tracks.json` plus a plain <audio> element.
 */

const audio = document.getElementById('audio');
const playerEl = document.getElementById('player');
const phaseEl = document.getElementById('phase');
const phaseKind = document.getElementById('phase-kind');
const phaseCount = document.getElementById('phase-count');
const phaseRound = document.getElementById('phase-round');
const seekEl = document.getElementById('seek');
const tCur = document.getElementById('t-cur');
const tDur = document.getElementById('t-dur');
const toggleBtn = document.getElementById('toggle');
const nowEl = document.getElementById('now');
const playerError = document.getElementById('player-error');

const state = {
  tracks: [],
  view: [],
  current: null,
};

const el = (id) => document.getElementById(id);

function fmtClock(sec) {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec) {
  return `${Math.round(sec / 60)} min`;
}

async function init() {
  let data;
  try {
    const res = await fetch('tracks.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    el('grid').innerHTML = `<p class="empty">Could not load tracks.json (${err.message}).</p>`;
    el('count').textContent = '';
    return;
  }

  state.tracks = Array.isArray(data.tracks) ? data.tracks : [];
  el('generated').textContent = data.generatedAt
    ? `Built ${new Date(data.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.`
    : '';

  populateSelect('f-genre', unique(state.tracks.map((t) => t.styleLabel)));
  // Built from the shapes actually present, not from a table of preset names. It
  // used to list the catalogue's `kind` values, which named training disciplines
  // ("HIIT", "Tabata", "Sprint") — the opposite of what D2 asks for, and not what
  // the cards show. If a preset's intervals ever change, this follows.
  populateSelect('f-kind', unique(state.tracks.map(shapeLabel)));

  for (const id of ['f-duration', 'f-genre', 'f-kind', 'f-sort']) el(id).addEventListener('change', apply);
  wirePlayer();

  const last = localStorage.getItem('itm.last');
  apply();
  if (last && state.tracks.some((t) => t.slug === last)) {
    const card = document.querySelector(`.card[data-slug="${cssEscape(last)}"]`);
    if (card) card.scrollIntoView({ block: 'center' });
  }
}

function populateSelect(id, values, labels = {}) {
  const select = el(id);
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labels[value] ?? value;
    select.append(option);
  }
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

function apply() {
  const duration = el('f-duration').value;
  const genre = el('f-genre').value;
  const kind = el('f-kind').value;
  const sort = el('f-sort').value;

  state.view = state.tracks.filter((t) => {
    if (duration === 'short' && t.durationSec >= 600) return false;
    if (duration === 'mid' && (t.durationSec < 600 || t.durationSec >= 1200)) return false;
    if (duration === 'long' && t.durationSec < 1200) return false;
    if (genre !== 'all' && t.styleLabel !== genre) return false;
    if (kind !== 'all' && shapeLabel(t) !== kind) return false;
    return true;
  });

  if (sort === 'duration') state.view.sort((a, b) => a.durationSec - b.durationSec);
  if (sort === 'bpm') state.view.sort((a, b) => b.bpm - a.bpm);

  renderGrid();
  el('count').textContent = `${state.view.length} of ${state.tracks.length} tracks`;
  el('empty').hidden = state.view.length > 0;
}

function renderGrid() {
  const grid = el('grid');
  grid.replaceChildren(...state.view.map(cardFor));
  updateActiveCard();
}

/**
 * "45/15" — the shape, in seconds, bare.
 *
 * The card shows this as its heading, and the filter names it "Work / rest (s)",
 * so the unit is stated once for the whole page instead of on every card. The
 * manifest's own `title` ("12 × 45s / 15s — Techno") is the stable identity of a
 * track and stays as it is; nothing user-facing should print it verbatim, because
 * it carries the genre that the card already shows in its chip.
 */
function shapeLabel(track) {
  const { workSec, restSec } = track.structure;
  // The manifest rounds to milliseconds, so whole values print as "45" and a
  // genuine fraction such as 22.5 survives as "22.5". No unit: the filter that
  // lists these values is labelled "Work / rest (s)".
  return restSec > 0 ? `${workSec}/${restSec}` : `${workSec} continuous`;
}

function cardFor(track) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.slug = track.slug;
  card.style.setProperty('--card-accent', track.accent || 'var(--accent)');

  const top = document.createElement('div');
  top.className = 'card-top';

  // The cover is drawn from the track's own spectrum. It is decorative: the
  // heading and chip already name the track, so an empty alt keeps a screen
  // reader from announcing a picture with nothing useful to say. It is a
  // thumbnail, not a sleeve: a full-width square pushed the facts a whole
  // screen down on a phone.
  if (track.cover?.url) {
    const cover = document.createElement('img');
    cover.className = 'card-cover';
    cover.src = track.cover.url;
    cover.alt = '';
    cover.loading = 'lazy';
    cover.decoding = 'async';
    cover.width = 72;
    cover.height = 72;
    top.append(cover);
  }

  const head = document.createElement('div');
  head.className = 'card-head';
  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = shapeLabel(track);
  // Five cards share the heading "45/15", so a screen reader would hear the same
  // thing five times over. The genre is visually the chip; here it is for anyone
  // not looking at it.
  const forScreen = document.createElement('span');
  forScreen.className = 'sr-only';
  forScreen.textContent = `, ${track.styleLabel}`;
  title.append(forScreen);
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = track.styleLabel;
  head.append(title, chip);
  top.append(head);

  // One line, no labels: every item here is either a number or already reads as
  // one. The old card also carried `presetSummary` ("12 rounds of 45s work / 15s
  // rest"), which restated the heading in prose — rounds for a second time and
  // the interval for a second time.
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const parts = [`${track.structure.reps} rounds`, fmtDuration(track.durationSec)];
  // Bells-only has no music engine, so it has no tempo to report. It was showing
  // "120 BPM forced", which reads as a tempo someone pinned; 120 is only the
  // nominal bar length the cue arithmetic uses (snap.mjs NOMINAL_BPM).
  if (track.style !== 'bells-only') {
    parts.push(`${track.bpm} BPM${track.snapped ? '' : ' forced'}`);
    if (track.key) parts.push(track.key);
  }
  parts.forEach((text, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'meta-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '·';
      meta.append(sep);
    }
    const item = document.createElement('span');
    item.textContent = text;
    meta.append(item);
  });

  const play = document.createElement('button');
  play.className = 'card-play';
  play.type = 'button';
  play.dataset.play = track.slug;
  play.textContent = '▶ Play';

  card.append(top, meta, play);
  return card;
}

function wirePlayer() {
  el('grid').addEventListener('click', (event) => {
    const target = event.target.closest('[data-play]');
    if (target) playTrack(target.dataset.play);
    else {
      const card = event.target.closest('.card');
      if (card) playTrack(card.dataset.slug);
    }
  });

  toggleBtn.addEventListener('click', () => (audio.paused ? startPlayback() : audio.pause()));
  document.getElementById('back15').addEventListener('click', () => skip(-15));
  document.getElementById('fwd15').addEventListener('click', () => skip(15));
  document.getElementById('prev').addEventListener('click', () => step(-1));
  document.getElementById('next').addEventListener('click', () => step(1));

  seekEl.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Number(seekEl.value);
  });

  audio.addEventListener('play', () => {
    toggleBtn.textContent = '❚❚';
    toggleBtn.setAttribute('aria-label', 'Pause');
    acquireWake();
  });
  audio.addEventListener('pause', () => {
    toggleBtn.textContent = '▶';
    toggleBtn.setAttribute('aria-label', 'Play');
    releaseWake();
  });
  audio.addEventListener('loadedmetadata', () => {
    seekEl.max = String(audio.duration || 0);
    tDur.textContent = fmtClock(audio.duration || 0);
    updatePhase();
  });
  audio.addEventListener('timeupdate', () => {
    if (Number.isFinite(audio.duration) && !seekEl.matches(':active')) seekEl.value = String(audio.currentTime);
    tCur.textContent = fmtClock(audio.currentTime);
    updatePhase();
  });
  audio.addEventListener('ended', () => step(1));
  audio.addEventListener('playing', clearPlayError);
  audio.addEventListener('error', () => showPlayError(messageFor()));

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      audio.paused ? startPlayback() : audio.pause();
    }
  });

  window.addEventListener('resize', syncPlayerPad);
}

/**
 * One place to start playback, so every entry point (card tap, toggle button,
 * space bar) reports a failed play instead of leaving an unhandled rejection.
 * On iOS a play() outside a user gesture rejects — seeing it here beats a
 * button that silently does nothing.
 */
function startPlayback() {
  audio.play().then(clearPlayError).catch((err) => {
    console.error('Audio playback error:', err);
    showPlayError(messageFor(err));
  });
}

/** MediaError codes, plus the rejection a blocked autoplay produces. */
function messageFor(err) {
  switch (audio.error?.code) {
    case 1: return 'Playback was aborted.';
    case 2: return 'Network error while loading the audio — check your connection and try again.';
    case 3: return 'The audio could not be decoded on this device.';
    case 4: return 'This device could not load the audio file.';
  }
  if (err?.name === 'NotAllowedError') return 'Playback was blocked — tap play again.';
  return 'The audio could not be played. Tap play to try again.';
}

function showPlayError(message) {
  playerError.textContent = message;
  playerError.hidden = false;
  syncPlayerPad();
}

function clearPlayError() {
  if (playerError.hidden) return;
  playerError.textContent = '';
  playerError.hidden = true;
  syncPlayerPad();
}

function playTrack(slug) {
  const track = state.tracks.find((t) => t.slug === slug);
  if (!track) return;
  state.current = track;
  playerEl.hidden = false;
  clearPlayError();
  syncPlayerPad();
  audio.src = new URL(track.audio.url, document.baseURI).href;
  startPlayback();
  // Genre and shape, once each. This used to be `track.title · styleLabel`, which
// printed "12 × 45s / 15s — Techno · Techno" — the genre twice, because the
// manifest title already carries it.
nowEl.textContent = `${track.styleLabel} · ${shapeLabel(track)}`;
  localStorage.setItem('itm.last', track.slug);
  setMediaSession(track);
  updateActiveCard();
  updateNav();
  updatePhase();
}

/**
 * The player is `position: fixed`, so it covers whatever sits behind it. The
 * stylesheet reserves a fixed 8.5rem at the bottom of the page, but on a phone
 * the stacked player measures taller than that and a card's Play button ended
 * up underneath it — a tap landed on the player instead of the button. Track
 * the real height instead of guessing it.
 *
 * A ResizeObserver rather than a one-off measurement: the player grows again
 * once updatePhase() fills the round label (it wraps on a narrow phone) and at
 * the 720px layout switch, so padding has to follow every size change.
 */
function syncPlayerPad() {
  document.body.style.paddingBottom = playerEl.hidden
    ? ''
    : `${playerEl.offsetHeight}px`;
}
if ('ResizeObserver' in window) new ResizeObserver(syncPlayerPad).observe(playerEl);

function step(delta) {
  if (!state.current) return;
  const i = state.view.findIndex((t) => t.slug === state.current.slug);
  if (i === -1) return;
  const next = state.view[i + delta];
  if (next) playTrack(next.slug);
}

function skip(seconds) {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
}

/** Which segment covers time `t`. Linear is fine: a track has ~26 of them. */
function segmentAt(track, t) {
  for (const segment of track.segments) {
    if (t < segment.endSec) return segment;
  }
  return track.segments[track.segments.length - 1];
}

function updatePhase() {
  const track = state.current;
  if (!track || !track.segments?.length) return;

  const segment = segmentAt(track, audio.currentTime);
  const remaining = Math.max(0, segment.endSec - audio.currentTime);
  let label = 'WORK';
  let isWork = true;

  if (segment.kind === 'rest') {
    label = 'REST';
    isWork = false;
  } else if (segment.kind === 'leadIn') {
    label = 'GET READY';
    isWork = false;
  } else if (segment.kind === 'coolDown') {
    label = 'COOL DOWN';
    isWork = false;
  }

  phaseKind.textContent = label;
  phaseEl.classList.toggle('work', isWork);
  phaseCount.textContent = fmtClock(remaining);
  phaseRound.textContent =
    segment.kind === 'work' || segment.kind === 'rest'
      ? `Round ${segment.rep} of ${track.structure.reps}`
      : track.structure.label;
}

function updateActiveCard() {
  for (const card of document.querySelectorAll('.card.playing')) card.classList.remove('playing');
  if (state.current) {
    document.querySelector(`.card[data-slug="${cssEscape(state.current.slug)}"]`)?.classList.add('playing');
  }
}

function updateNav() {
  if (!state.current) return;
  const i = state.view.findIndex((t) => t.slug === state.current.slug);
  document.getElementById('prev').disabled = i <= 0;
  document.getElementById('next').disabled = i === -1 || i >= state.view.length - 1;
}

function setMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      // Lock screen shows title and artist side by side, so the shape belongs in the
      // title and the genre in the artist slot — otherwise the two swap places and
      // "Techno" ends up under "Interval Tracks".
      title: `${track.styleLabel} · ${shapeLabel(track)}`,
      artist: `${track.structure.reps} rounds`,
      album: 'Interval Tracks',
    });
  } catch {
    /* MediaMetadata missing; lock-screen art is a nicety, not worth a throw */
  }
  const handlers = {
    play: () => startPlayback(),
    pause: () => audio.pause(),
    previoustrack: () => step(-1),
    nexttrack: () => step(1),
    seekbackward: (details) => skip(-(details.seekOffset || 15)),
    seekforward: (details) => skip(details.seekOffset || 15),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      /* unsupported action; ignore */
    }
  }
}

let wakeLock = null;
async function acquireWake() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    /* denied or unsupported; the screen just sleeps as usual */
  }
}
function releaseWake() {
  try {
    wakeLock?.release();
  } catch {
    /* already gone */
  }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !audio.paused) acquireWake();
});

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/"/g, '\\"');
}

init();
