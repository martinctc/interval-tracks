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

const KIND_LABELS = {
  hiit: 'HIIT',
  tabata: 'Tabata',
  emom: 'EMOM',
  sprint: 'Sprint',
  long: 'Long',
  bells: 'Bells',
  custom: 'Custom',
};

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
  populateSelect('f-kind', unique(state.tracks.map((t) => t.structure.kind)), KIND_LABELS);

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
    if (kind !== 'all' && t.structure.kind !== kind) return false;
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

function cardFor(track) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.slug = track.slug;
  card.style.setProperty('--card-accent', track.accent || 'var(--accent)');

  const head = document.createElement('div');
  head.className = 'card-head';
  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = track.title;
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = track.styleLabel;
  head.append(title, chip);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.append(
    metaItem(`${fmtDuration(track.durationSec)}`, 'length'),
    metaItem(`BPM ${track.bpm}${track.snapped ? '' : ' (forced)'}`, 'tempo'),
    track.key ? metaItem(track.key, 'key') : metaItem(`${track.structure.reps} rounds`, 'rounds')
  );

  const sub = document.createElement('div');
  sub.className = 'card-sub';
  sub.textContent = track.presetSummary || track.structure.label;

  const play = document.createElement('button');
  play.className = 'card-play';
  play.type = 'button';
  play.dataset.play = track.slug;
  play.textContent = '▶ Play';

  card.append(head, meta, sub, play);
  return card;
}

function metaItem(text, label) {
  const span = document.createElement('span');
  span.title = label;
  span.textContent = text;
  return span;
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

  toggleBtn.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
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

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      audio.paused ? audio.play() : audio.pause();
    }
  });
}

function playTrack(slug) {
  const track = state.tracks.find((t) => t.slug === slug);
  if (!track) return;
  state.current = track;
  playerEl.hidden = false;
  audio.src = new URL(track.audio.url, document.baseURI).href;
  audio.play().catch(() => {});
  nowEl.textContent = `${track.title} · ${track.styleLabel}`;
  localStorage.setItem('itm.last', track.slug);
  setMediaSession(track);
  updateActiveCard();
  updateNav();
  updatePhase();
}

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
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: 'Interval Tracks',
    album: track.styleLabel,
  });
  const handlers = {
    play: () => audio.play(),
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
