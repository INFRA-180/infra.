#!/usr/bin/env node
"use strict";

// Section Samples (20/11/2026, lot T bis) : (a) cohérence de public/data/samples.json,
// (b) spécification du cœur du Mix (public/assets/js/samples-mix-core.js),
// (c) télémétrie : chaque événement du Mix est bien gardé par src/js/audio-telemetry.js.
// Les défauts déjà connus (D4) sont listés à part : signalés, sans faire échouer.
// Lot D1 (27/11/2026) : anti-retour — aucune voix, noms propres, pochettes justes, entrée dans le morceau, champs complets.

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const pub = path.join(root, "public");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(pub, rel), "utf8"));

// Défauts connus, clé = identifiant YouTube + contrôle. Corriger la donnée, puis retirer la ligne.
const KNOWN = new Map([]);
const TOLERANCE_S = 0.05; // arrondis des extraits (ex. 155,987 au lieu de 156)

// Anti-retour du lot D1 (27/11/2026) : musique seulement, noms propres, pochettes justes, entrée dans le morceau.
// Empreintes MD5 des images fausses connues (« SAMPLE 2 » d'un morceau INFRA, boîte « DAYDREAMS » partagée).
const BAD_COVERS = new Map([
  ["12df58c8", "pochette « SAMPLE 2 » (image d'un morceau INFRA)"],
  ["88a3748e", "boîte « DAYDREAMS » (seulement pour DAYDREAMS CARTRIDGE)"]
]);
const BAD_COVER_OK = new Set(["QnAwfzWqJEI"]); // DAYDREAMS CARTRIDGE : c'est sa vraie pochette
// Une même image pour deux artistes différents = erreur, sauf même disque (liste ci-dessous, clé = ids triés).
const SHARED_COVER_OK = new Set([]);
const DIRTY_ARTIST = /- Topic$|^(André Navarro II|Music for empty rooms|DUSTintheDNA|mrthereismusic)$/i;
const DIRTY_TITLE = /：|::|Vinyl Rip|Atmospheric DnB|【|\[Japan\]|（）|^0\d[ -]/;

const errors = [];
const seenKnown = new Set();
function problem(key, message) {
  if (KNOWN.has(key)) {
    seenKnown.add(key);
    return;
  }
  errors.push(message);
}
const finite = (v) => typeof v === "number" && Number.isFinite(v);

// ---------- (a) données ----------
const samples = readJson("data/samples.json");
const durations = readJson("data/track-durations.json");
const durationOf = new Map(
  (durations.tracks || []).map((t) => [`${String(t.album).toLowerCase()}|${String(t.title).toLowerCase()}`, Number(t.seconds)])
);
const coverDir = path.join(pub, "assets/samples");
const covers = new Set(fs.existsSync(coverDir) ? fs.readdirSync(coverDir) : []);
const usedCovers = new Set();
const coverArtists = new Map(); // empreinte -> Map(artiste -> id)
const md5 = (file) => crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
let count = 0;
let timed = 0;
let parts4 = 0;
let partsAll = 0;

assert.strictEqual(samples.version, 2, "samples.json : version 2 attendue");
assert(Array.isArray(samples.albums) && samples.albums.length, "samples.json : albums manquants");

for (const album of samples.albums) {
  for (const track of album.tracks || []) {
    const songSeconds = durationOf.get(`${String(album.title).toLowerCase()}|${String(track.title).toLowerCase()}`);
    if (!(track.items || []).length) errors.push(`${album.title} / ${track.title} : morceau sans sample`);
    for (const it of track.items || []) {
      count += 1;
      const where = `${album.title} / ${track.title} / ${it.y}`;
      assert(/^[\w-]{11}$/.test(String(it.y)), `${where} : identifiant YouTube invalide`);

      // musique seulement : plus aucune voix (a cappella) dans Samples (D1, INFRA 27/11/2026)
      if ("v" in it) errors.push(`${where} : voix (v) — les voix ne sont plus publiées dans Samples`);

      // noms : artiste jamais vide, ni chaîne YouTube, ni « - Topic » ; titre sans bruit
      if (!String(it.t || "").trim()) errors.push(`${where} : titre vide`);
      if (!String(it.a || "").trim()) problem(`${it.y}:a`, `${where} : artiste vide`);
      else if (DIRTY_ARTIST.test(it.a)) problem(`${it.y}:a`, `${where} : artiste = chaîne YouTube (« ${it.a} »)`);
      if (DIRTY_TITLE.test(String(it.t || ""))) problem(`${it.y}:t`, `${where} : titre sale (« ${it.t} »)`);

      // champs complets : chaque son se joue (temps, extrait, pochette)
      for (const k of ["at", "s0", "s1", "x", "c"]) {
        if (!(k in it)) problem(`${it.y}:${k}`, `${where} : champ ${k} manquant`);
      }
      if (!("s0" in it && "s1" in it && "at" in it)) continue;
      timed += 1;
      if (!finite(it.s0) || !finite(it.s1) || !(it.s0 >= 0) || !(it.s0 < it.s1)) {
        errors.push(`${where} : s0 < s1 attendu (${it.s0} / ${it.s1})`);
      }
      // entrée dans le morceau : au moins 2 s avant la fin ; moment fort après l'entrée
      if (!finite(it.at) || it.at < 0) errors.push(`${where} : at manquant ou négatif`);
      else if (finite(songSeconds) && it.at + 2 > songSeconds) {
        problem(`${it.y}:at`, `${where} : at ${it.at} s trop près ou après la fin du morceau (${songSeconds} s)`);
      }
      if ("go" in it && !(finite(it.go) && it.go >= it.at)) errors.push(`${where} : go (${it.go}) avant at (${it.at})`);
      if ("tb" in it && !(finite(it.tb) && it.tb > 0)) errors.push(`${where} : tb (BPM) doit être un nombre > 0`);
      if ("bpm" in it && !(Array.isArray(it.bpm) && it.bpm.length === 2 && it.bpm.every((b) => finite(b) && b > 0))) {
        errors.push(`${where} : bpm doit être [BPM d'origine, BPM joué]`);
      }

      // passages : p[0] = [s0, s1] ; un extrait x par passage, au nom du son (y), qui couvre le passage
      const parts = Array.isArray(it.p) ? it.p : [[it.s0, it.s1]];
      if ("p" in it) {
        if (!Array.isArray(it.p) || !it.p.length) errors.push(`${where} : p doit être une liste de passages`);
        else if (it.p[0][0] !== it.s0 || it.p[0][1] !== it.s1) errors.push(`${where} : p[0] doit valoir [s0, s1]`);
      }
      if (!Array.isArray(it.x) || it.x.length !== parts.length) {
        problem(`${it.y}:x`, `${where} : un extrait x par passage attendu (${(it.x || []).length} pour ${parts.length})`);
      } else {
        const xName = new RegExp(`^${it.y.replace(/[-]/g, "\\-")}_\\d+-\\d+(_v\\d+)?$`);
        parts.forEach((q, qi) => {
          const x = it.x[qi];
          if (!Array.isArray(q) || !finite(q[0]) || !finite(q[1]) || !(q[0] < q[1])) {
            errors.push(`${where} : passage ${qi} invalide`);
            return;
          }
          if (!Array.isArray(x) || !xName.test(String(x[0])) || !finite(x[1]) || !(x[2] > 0)) {
            errors.push(`${where} : extrait ${qi} mal formé ou au nom d'un autre son (${x && x[0]})`);
            return;
          }
          const before = q[0] - x[1];
          const after = x[1] + x[2] - q[1];
          if (before < -TOLERANCE_S || after < -TOLERANCE_S) {
            problem(`${it.y}:x`, `${where} : l'extrait ${qi} ne couvre pas le passage (${q[0]}-${q[1]} s)`);
          } else {
            partsAll += 1;
            if (before >= 4 - TOLERANCE_S && after >= 4 - TOLERANCE_S) parts4 += 1;
          }
        });
      }

      // pochette : présente, pas une image fausse connue, pas celle d'un autre artiste
      if (it.c !== 1) errors.push(`${where} : pochette manquante (c)`);
      else if (!covers.has(`${it.y}.webp`)) errors.push(`${where} : fichier assets/samples/${it.y}.webp absent`);
      else {
        usedCovers.add(`${it.y}.webp`);
        const h = md5(path.join(coverDir, `${it.y}.webp`));
        const bad = BAD_COVERS.get(h.slice(0, 8));
        if (bad && !BAD_COVER_OK.has(it.y)) problem(`${it.y}:c`, `${where} : ${bad}`);
        const artist = String(it.a || "").toLowerCase();
        if (!coverArtists.has(h)) coverArtists.set(h, new Map());
        if (!coverArtists.get(h).has(artist)) coverArtists.get(h).set(artist, it.y);
      }
    }
  }
}
for (const [h, byArtist] of coverArtists) {
  if (byArtist.size < 2) continue;
  const ids = [...byArtist.values()].sort();
  if (!SHARED_COVER_OK.has(ids.join("+"))) {
    errors.push(`pochette ${h.slice(0, 8)} partagée par des artistes différents : ${[...byArtist].map(([a, y]) => `${a || "?"} (${y})`).join(", ")}`);
  }
}
const orphans = [...covers].filter((f) => f.endsWith(".webp") && !usedCovers.has(f));
if (orphans.length) errors.push(`${orphans.length} pochette(s) orpheline(s) dans assets/samples : ${orphans.slice(0, 5).join(", ")}`);

// ---------- (b) cœur du Mix ----------
const corePath = path.join(pub, "assets/js/samples-mix-core.js");
const core = require(corePath);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-9, `${msg} : ${a} au lieu de ${b}`);

// chargé comme dans le navigateur : global window.InfraSamplesMixCore
const sandbox = { window: {} };
sandbox.globalThis = sandbox.window;
vm.runInNewContext(fs.readFileSync(corePath, "utf8"), sandbox.window);
assert(sandbox.window.InfraSamplesMixCore, "InfraSamplesMixCore doit être exposé en global");
assert.strictEqual(typeof sandbox.window.InfraSamplesMixCore.transitionSeconds, "function");

// durée en mesures (T12, 27/11/2026) : Aucune · 2 · 4
assert.deepStrictEqual(core.DURATIONS, ["none", "2", "4"], "T12 : Aucune · 2 · 4 mesures");
near(core.transitionSeconds("none", 120), 0.03, "Aucune ≈ 0,03 s");
near(core.transitionSeconds("none", 120, 0), 0.03, "Aucune n'est jamais plafonnée");
near(core.transitionSeconds("2", 120), 4, "2 mesures à 120 BPM = 4 s");
near(core.transitionSeconds("4", 120), 8, "4 mesures à 120 BPM = 8 s");
near(core.transitionSeconds("4", 160), 6, "4 mesures à 160 BPM = 6 s");
near(core.transitionSeconds("2", 160), 3, "2 mesures à 160 BPM = 3 s");
near(core.transitionSeconds("2"), 4, "2 mesures sans BPM (compté à 120)");
near(core.transitionSeconds("4", 70), 8, "4 mesures à 70 BPM (13,7 s) plafonnées à 2 × 4 s");
near(core.transitionSeconds("2", 120, 1), 2, "2 mesures plafonnées par une marge de 1 s");
near(core.transitionSeconds("4", 80, 6), 12, "marge 6 s (extraits refaits) : 4 mesures à 80 BPM = 12 s");
near(core.transitionSeconds(undefined, 120), 8, "défaut = 4 mesures");
near(core.transitionSeconds("auto", 120), 8, "ancien « Auto » retenu → 4 mesures");
near(core.transitionSeconds("5", 120), 4, "ancien « 5 s » retenu → 2 mesures");
near(core.barSeconds(1, 60), 4, "1 mesure à 60 BPM = 4 s");
near(core.autoSeconds(120), 8, "autoSeconds (ancienne règle) gardée");
for (const bpm of [0, 40, 63, 90, 120, 158, 400]) {
  for (const choice of core.DURATIONS) {
    const d = core.transitionSeconds(choice, bpm);
    assert(d >= core.NONE_S && d <= 2 * core.EXTRACT_MARGIN_S, `${choice} @ ${bpm} : ${d} hors bornes`);
  }
}
near(core.transitionFor("sample_to_track", "4", 120), 0.35, "sample → morceau reste 0,35 s");
near(core.transitionFor("track_to_sample", "2", 120), 4, "morceau → sample suit le réglage");
near(core.transitionFor("sample_to_sample", "none", 120), 0.03, "sample → sample suit le réglage");

// ancien « Hasard qui écoute » (gardé pour les anciens appels) ; F5 : Hasard rejoint Auto
assert.strictEqual(core.listeningEffect(120, 120), "fade");
assert.strictEqual(core.listeningEffect(120, 132.1), "echo");
assert.strictEqual(core.listeningEffect(0, 120), "fade", "tempo inconnu → fondu");
assert.strictEqual(core.resolveEffect("reverb", 90, 120), "reverb");
assert.strictEqual(core.resolveEffect("bass", 90, 120), "filter", "F5 : ancien « Basses » → Filtre");
assert.strictEqual(core.resolveEffect("inconnu", 120, 120.5, { outConf: 0.9, inConf: 0.9 }), "blend", "effet inconnu → Auto");
assert.deepStrictEqual(core.EFFECTS, ["auto", "fade", "reverb", "echo", "filter"]);
assert.deepStrictEqual({ ...core.DEFAULTS }, { dur: "4", fx: "auto" }, "F5 : Auto par défaut (INFRA Q3 A)");
require("./test-samples-auto.js")(core);

// fondu à puissance égale
for (let i = 0; i <= 100; i += 1) {
  const g = core.equalPowerGains(i / 100);
  near(g.out * g.out + g.in * g.in, 1, `puissance égale à t = ${i / 100}`);
  assert(g.out >= 0 && g.in >= 0, "gains positifs");
}
near(core.equalPowerGains(0).out, 1, "début : sortant plein");
near(core.equalPowerGains(0).in, 0, "début : entrant muet");
near(core.equalPowerGains(1).in, 1, "fin : entrant plein");
assert(Math.abs(core.equalPowerGains(1).out) < 1e-12, "fin : sortant muet");
near(core.equalPowerGains(0.5).out, Math.SQRT1_2, "milieu : -3 dB");
near(core.equalPowerGains(-2).out, 1, "t borné à 0");
const curves = core.equalPowerCurves(33);
assert.strictEqual(curves.out.length, 33);
assert(curves.in instanceof Float32Array, "courbes en Float32Array (setValueCurveAtTime)");
assert(Math.abs(curves.out[0] - 1) < 1e-6 && Math.abs(curves.in[32] - 1) < 1e-6, "courbes de 1 à 0 et de 0 à 1");
assert.strictEqual(core.equalPowerCurves(1).out.length, 2, "au moins 2 points");

// ---------- (c) télémétrie ----------
const telemetry = fs.readFileSync(path.join(root, "src/js/audio-telemetry.js"), "utf8");
function setOf(name) {
  const m = telemetry.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  assert(m, `${name} introuvable dans audio-telemetry.js`);
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}
const raw = setOf("RAW_EVENTS");
const direct = setOf("DIRECT_EVENTS");
for (const ev of core.TELEMETRY.events) {
  assert(raw.has(ev), `télémétrie : ${ev} absent de RAW_EVENTS (événement jeté)`);
  assert(direct.has(ev), `télémétrie : ${ev} absent de DIRECT_EVENTS (jamais envoyé)`);
}
for (const [kind, name] of [["strings", "TELEMETRY_STRING_FIELDS"], ["numbers", "TELEMETRY_NUMBER_FIELDS"], ["booleans", "TELEMETRY_BOOLEAN_FIELDS"]]) {
  const fields = setOf(name);
  for (const f of core.TELEMETRY[kind]) assert(fields.has(f), `télémétrie : champ ${f} absent de ${name}`);
}
// événements réellement envoyés par samples.js : tous gardés
const samplesJs = fs.readFileSync(path.join(pub, "assets/js/samples.js"), "utf8");
for (const m of samplesJs.matchAll(/track\(\s*"(samples_[a-z_]+)"/g)) {
  assert(raw.has(m[1]) && direct.has(m[1]), `télémétrie : ${m[1]} envoyé par samples.js mais jeté`);
}
// M1 (27/11/2026) : samples_pass, samples_lock, samples_resync envoient seulement des champs gardés
// (sinon le journal les perd en silence, comme fx et dur_s avant le 20/11).
const keptFields = new Set([...core.TELEMETRY.strings, ...core.TELEMETRY.numbers, ...core.TELEMETRY.booleans, "mode", "state", "delta_ms"]);
for (const ev of ["samples_pass", "samples_lock", "samples_resync"]) {
  assert(core.TELEMETRY.events.includes(ev), `télémétrie : ${ev} absent du cœur du Mix`);
  const calls = [...samplesJs.matchAll(new RegExp(`track\\(\\s*"${ev}",\\s*\\{([\\s\\S]*?)\\}\\);`, "g"))];
  if (ev === "samples_pass") assert(calls.length >= 1, "samples_pass doit être envoyé par samples.js");
  for (const c of calls) {
    for (const k of c[1].matchAll(/^\s*([a-z_]+):/gm)) {
      assert(keptFields.has(k[1]), `télémétrie : ${ev}.${k[1]} n'est dans aucune liste gardée`);
    }
  }
}
for (const f of ["kind", "cause", "buf", "ctx", "late_ms", "gap_ms", "vis"]) {
  assert(keptFields.has(f), `samples_pass : champ ${f} attendu dans TELEMETRY`);
}

// ---------- (d) moteur (samples.js chargé hors navigateur, horloge simulée) ----------
// M2 (27/11/2026) : un faux document, une fausse horloge murale ; pas de Web Audio (l'horloge du moteur
// retombe alors sur performance.now, comme un contexte suspendu). Le crochet _t n'existe que pour ce test.
function loadEngine(opts) {
  const o = opts || {};
  const clock = { wall: 1000000 };
  const events = [];
  const listeners = {};
  const fakeAudio = o.audio || null;
  const doc = {
    currentScript: null,
    visibilityState: "visible",
    baseURI: "http://localhost/",
    documentElement: { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      return id === "infraGlobalAudio" ? fakeAudio : null;
    },
    dispatchEvent() {
      return true;
    }
  };
  class FakeDate extends Date {
    static now() {
      return clock.wall;
    }
  }
  const win = {
    __INFRA_SAMPLES_TEST__: true,
    addEventListener(type, fn) {
      (listeners["w:" + type] = listeners["w:" + type] || []).push(fn);
    },
    InfraTrackEvent(name, data) {
      events.push([name, data]);
    },
    location: { origin: "http://localhost" },
    InfraSamplesMixCore: core,
    // constructeur présent (les extraits sont « jouables ») ; aucun contexte n'est créé par ces tests
    // (sauf F1 : faux contexte passé par o.AudioContext)
    AudioContext: o.AudioContext || function () {}
  };
  const timers = [];
  const sandbox = {
    window: win,
    document: doc,
    navigator: o.navigator || {},
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => clock.wall },
    Date: FakeDate,
    // F1 : minuteurs gardés quand le test les demande (o.timers), lancés à la main par runTimers()
    setTimeout: o.timers
      ? (fn, ms) => {
          timers.push({ fn, at: clock.wall + (ms || 0) });
          return timers.length;
        }
      : () => 0,
    clearTimeout() {},
    Audio: o.Audio,
    setInterval: () => 0,
    clearInterval() {},
    requestAnimationFrame: () => 0,
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    URL,
    URLSearchParams,
    console
  };
  vm.runInNewContext(samplesJs, sandbox, { filename: "samples.js" });
  const t = win.InfraSamples && win.InfraSamples._t;
  assert(t, "samples.js : crochet de test _t absent");
  const runTimers = (ms) => {
    clock.wall += ms || 0;
    for (let guard = 0; guard < 100; guard++) {
      const due = timers.filter((x) => !x.done && x.at <= clock.wall);
      if (!due.length) break;
      due.forEach((x) => {
        x.done = true;
        x.fn();
      });
    }
  };
  return { t, clock, events, listeners, win, doc, runTimers };
}

// F1 (28/11/2026) : faux Web Audio, juste assez pour suivre les branchements et l'état du contexte.
function fakeAudio(opts) {
  const o = opts || {};
  const made = [];
  made.params = [];
  class Param {
    constructor(v) {
      this.value = v;
      this.calls = [];
      made.params.push(this);
    }
    setValueAtTime(v, t) {
      this.calls.push(["set", v, t]);
      this.value = v;
    }
    linearRampToValueAtTime(v, t) {
      this.calls.push(["lin", v, t]);
    }
    exponentialRampToValueAtTime(v, t) {
      this.calls.push(["exp", v, t]);
    }
    cancelScheduledValues(t) {
      this.calls.push(["cancel", t]);
    }
  }
  if (o.hold !== false)
    Param.prototype.cancelAndHoldAtTime = function (t) {
      this.calls.push(["hold", t]);
    };
  class Node {
    constructor(kind) {
      this.kind = kind;
      this.out = [];
    }
    connect(n) {
      this.out.push(n);
      return n;
    }
    disconnect() {
      this.out = [];
    }
  }
  class Ctx {
    constructor(init) {
      this.init = init;
      this.state = "suspended";
      this.currentTime = 5;
      this.sampleRate = 8000;
      this.destination = new Node("dest");
      made.push(this);
    }
    resume() {
      if (o.resume === "never") return new Promise(() => {});
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
    createGain() {
      const gain = new Param(1);
      gain.isGain = true;
      return Object.assign(new Node("gain"), { gain });
    }
    createBiquadFilter() {
      return Object.assign(new Node("biquad"), { frequency: new Param(350), Q: new Param(1) });
    }
    createDynamicsCompressor() {
      const n = new Node("limiter");
      ["threshold", "knee", "ratio", "attack", "release"].forEach((k) => (n[k] = new Param(0)));
      return n;
    }
    createConvolver() {
      return new Node("convolver");
    }
    createDelay() {
      return Object.assign(new Node("delay"), { delayTime: new Param(0) });
    }
    createBuffer(ch, n) {
      const data = Array.from({ length: ch }, () => new Float32Array(n));
      return { numberOfChannels: ch, duration: n / 8000, getChannelData: (c) => data[c] };
    }
    createBufferSource() {
      return Object.assign(new Node("src"), { start() {}, stop() {}, playbackRate: new Param(1) });
    }
    createMediaElementSource() {
      return new Node("media");
    }
  }
  const Audio = class {
    constructor() {
      this.paused = true;
    }
    setAttribute() {}
    removeAttribute() {}
    addEventListener() {}
    removeEventListener() {}
    play() {
      return { then() {} };
    }
    pause() {}
  };
  return { Ctx, Audio, made };
}
{
  // F1 : contexte « playback », limiteur en fin de chaîne, retours d'effets sur un bus à part, horloge
  // audio même contexte suspendu, garde de resume() (jamais bloqué), recréation au geste suivant.
  const A = fakeAudio({ resume: "never" });
  const E = loadEngine({ AudioContext: A.Ctx, Audio: A.Audio, timers: true });
  const c = E.t.ensureCtx(true);
  assert(c, "F1 : contexte créé");
  assert.strictEqual(c.init && c.init.latencyHint, "playback", "F1 : latencyHint playback");
  const b = E.t.bus();
  assert(b.lim && b.out.out.includes(b.lim) && b.lim.out.includes(c.destination), "F1 : bus.out → limiteur → sortie");
  assert.strictEqual(b.lim.threshold.value, -1, "F1 : limiteur à −1 dB");
  assert.strictEqual(b.lim.ratio.value, 20, "F1 : ratio 20");
  assert(b.fx.out.includes(b.out), "F1 : retours d'effets → bus.out");
  assert.strictEqual(E.t.now(), 5, "F3 : instant d'un passage sur l'horloge audio, même contexte suspendu");
  assert.strictEqual(E.t.eng.ownSuspend, true, "F1 : reprise en cours = la nôtre");
  E.runTimers(1600);
  assert.strictEqual(E.t.eng.ownSuspend, false, "F1 : ownSuspend jamais bloqué (resume sans réponse)");
  assert.strictEqual(E.t.eng.stuck, true, "F1 : contexte bloqué noté");
  assert(E.events.some((e) => e[0] === "samples_lock" && e[1].cause === "resume_stuck"), "F1 : blocage journalisé");
  const c2 = E.t.ensureCtx(true);
  assert(c2 && c2 !== c && c.state === "closed", "F1 : nouveau contexte au geste suivant");
  assert.strictEqual(E.t.eng.stuck, false);
  // sans geste : jamais recréé
  E.runTimers(1600);
  assert.strictEqual(E.t.ensureCtx(), c2, "F1 : hors geste, le contexte n'est pas recréé");
}
{
  // F1 : cancelAndHoldAtTime pour les fondus quand il existe, repli sinon.
  for (const hold of [true, false]) {
    const A = fakeAudio({ hold });
    const E = loadEngine({ AudioContext: A.Ctx, Audio: A.Audio, timers: true });
    const c = E.t.ensureCtx(true);
    const g = c.createGain();
    const v = { g, gv: { from: 0, to: 1, when: 0, dur: 1 } };
    E.t.setCurve(v, 1, 0, 6, 2);
    const kinds = g.gain.calls.map((x) => x[0]);
    assert.strictEqual(kinds[0], hold ? "hold" : "cancel", `F1 : fondu ${hold ? "avec" : "sans"} cancelAndHoldAtTime`);
    assert(kinds.includes("lin"), "F1 : paliers du fondu posés");
  }
}
{
  // F1 : Media Session du Mix (lecture, pause, suivant, précédent, position), rendue au site à la fermeture.
  const handlers = {};
  const nav = { mediaSession: { setActionHandler: (a, fn) => (handlers[a] = fn), metadata: null, playbackState: "none" } };
  const E = loadEngine({ navigator: nav });
  E.t.msHandlers(true);
  for (const a of ["play", "pause", "nexttrack", "previoustrack", "seekto"])
    assert.strictEqual(typeof handlers[a], "function", `F1 : bouton ${a} du Mix`);
  E.t.msHandlers(false);
  assert.strictEqual(handlers.seekto, null, "F1 : Mix fermé → position rendue");
  assert.strictEqual(typeof handlers.nexttrack, "function", "F1 : Mix fermé → suivant repasse au lecteur du site");
}
{
  // B5 : tâches en retard (retour d'arrière-plan) : dans l'ordre de leur instant, événements d'interface jetés
  const E = loadEngine();
  const order = [];
  const t0 = E.t.now();
  E.t.clockAt(t0 + 2, () => order.push("tard"), "duo");
  E.t.clockAt(t0 + 1, () => order.push("tôt"), "duo");
  const ui = E.t.clockAt(t0 + 1.5, () => order.push("ui"), "ev");
  ui.drop = true;
  E.clock.wall += 30000; // 30 s gelé
  E.t.clockTick();
  assert.deepStrictEqual(order, ["tôt", "tard"], "B5 : tâches en retard dans l'ordre de leur instant, interface jetée");
  const rs = E.events.filter((e) => e[0] === "samples_resync");
  assert.strictEqual(rs.length, 1, "B5 : un seul samples_resync");
  assert(rs[0][1].late_ms >= 28000 && rs[0][1].dropped === 1, "B5 : retard et tâches jetées notés");
  // à l'heure : rien de jeté, aucun samples_resync
  const ok = [];
  E.t.clockAt(E.t.now() + 0.1, () => ok.push(1), "duo");
  E.clock.wall += 120;
  E.t.clockTick();
  assert.deepStrictEqual(ok, [1]);
  assert.strictEqual(E.events.filter((e) => e[0] === "samples_resync").length, 1, "B5 : pas de samples_resync à l'heure");
}

{
  // M3 : ton morceau dans le moteur. Partie « morceau » : extrait préparé (tx) sinon flux du fichier R2.
  const E = loadEngine();
  const item = { src: "assets/music/streams/v1/album/01-titre é.m4a", at: 70, go: NaN, tb: 120, tx: ["album_01-titre_700", 66, 68] };
  const ts = E.t.trackSeg(item);
  assert.strictEqual(ts.track, true);
  assert.strictEqual(ts.stream, undefined, "M3 : extrait préparé → tampon décodé");
  assert.strictEqual(ts.s0, 70, "M3 : entrée = at");
  assert.strictEqual(ts.s1, 130, "M3 : une minute");
  assert(/\/streams\/samples\/t\/album_01-titre_700\.m4a$/.test(ts.url), "M3 : extrait sous streams/samples/t/");
  item.noTx = Date.now() + 60000;
  item.tx = ["album_01-titre_700", 66, 68];
  const ts2 = E.t.trackSeg({ src: item.src, at: 70, go: 72, tx: null });
  assert.strictEqual(ts2.stream, true, "M3 : sans extrait → flux");
  assert.strictEqual(ts2.s0, 72, "M3 : entrée au moment fort (go)");
  assert(ts2.url.startsWith("https://infra180-api.pages.dev/audio/assets/music/streams/v1/album/"), "M3 : fichier R2 du morceau");
  assert(ts2.url.endsWith("01-titre%20%C3%A9.m4a"), "M3 : chemin encodé");
  // plus rien de grisé sur iPhone (le volume de ton morceau passe par le moteur)
  for (const d of E.t.getOptions().durations) assert.strictEqual(E.t.supports("dur", d), true, `M3 : durée ${d} grisée`);
  assert.strictEqual(E.t.getOptions().trackFades, true, "M3 : fondus de ton morceau partout");
  // ton morceau → sample (F5 : calé, la sortie porte la durée, jamais au-delà de son extrait)
  const smp = { y: "aaaaaaaaaaa", s0: 10, s1: 20, at: 70, tb: 120, x: [["aaaaaaaaaaa_100-200", 6, 18]] };
  E.t.pref.mixo = { dur: "4", fx: "reverb" };
  const p = E.t.planOf("out", { src: item.src, at: 70, tb: 120, tx: ["t", 66, 68] }, smp);
  assert(p.dur <= 8 + 1e-9 && p.dur >= 2, `M3 : durée de sortie ${p.dur} hors marges`);
}
{
  // M5 : durée et effet du Mix à chaque passage qui s'y prête ; sample → morceau reste net.
  const E = loadEngine();
  const mk = (y, s0, s1, x0, xd, extra) => Object.assign({ y, s0, s1, at: 10, tb: 120, x: [[y + "_1-2", x0, xd]] }, extra || {});
  const a = mk("aaaaaaaaaaa", 10, 30, 6, 28, { bpm: [120, 120] });
  const b = mk("bbbbbbbbbbb", 50, 70, 46, 28, { bpm: [120, 120] });
  // deux samples d'un même morceau joués à la suite (parties) : marges 4 s des deux côtés
  const item = Object.assign({}, a, {
    chain: [a, b],
    segs: [
      { y: a.y, s0: 10, s1: 30, ci: 0, from: 0, x: a.x[0] },
      { y: b.y, s0: 50, s1: 70, ci: 1, from: 20, x: b.x[0] }
    ]
  });
  E.t.pref.mixo = { dur: "4", fx: "echo" };
  let p = E.t.planOf("seg", item, item, { k: 1 });
  assert.strictEqual(p.fx, "echo", "M5 : effet aussi entre deux samples d'un même morceau");
  near(p.dur, 8, "M5 : 4 mesures à 120 BPM entre deux parties (marges 4 s)");
  E.t.pref.mixo = { dur: "2", fx: "bass" };
  p = E.t.planOf("seg", item, item, { k: 1 });
  near(p.dur, 4, "M5 : 2 mesures entre deux parties");
  assert.strictEqual(p.fx, "bass");
  E.t.pref.mixo = { dur: "none", fx: "reverb" };
  p = E.t.planOf("seg", item, item, { k: 1 });
  assert.strictEqual(p.fx, "cut", "M5 : Aucune = coupe");
  // parties qui se suivent dans le même son : jointure sans couture, jamais d'effet
  const c = mk("ccccccccccc", 10, 20, 6, 30);
  const cont = Object.assign({}, c, {
    chain: [c],
    segs: [
      { y: c.y, s0: 10, s1: 20, ci: 0, from: 0, x: c.x[0] },
      { y: c.y, s0: 20, s1: 30, ci: 0, from: 10, x: ["ccccccccccc_2-3", 16, 18] }
    ]
  });
  E.t.pref.mixo = { dur: "4", fx: "reverb" };
  p = E.t.planOf("seg", cont, cont, { k: 1 });
  assert(p.dur < 0.2 && p.fx === "fade", "M5 : parties contiguës sans effet");
  // sample → ton morceau : toujours 0,35 s, sans effet ; ancien réglage retenu « auto » → 4 mesures
  E.t.pref.mixo = { dur: "auto", fx: "reverb" };
  p = E.t.planOf("in", a, a, { dur: 0.35 });
  assert(Math.abs(p.dur - 0.35) < 1e-9 && p.fx === "fade", "M5 : sample → morceau net");
  assert.strictEqual(E.t.getOptions().dur, "4", "M5 : ancien « Auto » lu comme 4 mesures");
  E.t.pref.mixo = { dur: "5", fx: "fade" };
  assert.strictEqual(E.t.getOptions().dur, "2", "M5 : ancien « 5 s » lu comme 2 mesures");
  assert.deepStrictEqual(E.t.getOptions().durations, ["none", "2", "4"]);
}

{
  // F1 (28/11/2026) : volume égal lu dans samples-mix.json (exemple de test dans tools/fixtures, jamais dans public/).
  const E = loadEngine();
  const smp = { album: "D 2.0141", track: "MARJOLAINE", y: "4nag_GD6J5I" };
  assert.strictEqual(E.t.levelOf(smp, { ci: 0 }), 1, "F1 : sans fichier, niveau inchangé");
  const mixEx = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/samples-mix.example.json"), "utf8"));
  E.t.setMixData(mixEx);
  near(E.t.levelOf(smp, { ci: 0 }), Math.pow(10, 4.5 / 20), "F1 : g appliqué à la voix du sample");
  near(E.t.levelOf(smp, { track: true }), Math.pow(10, -2 / 20), "F1 : tg appliqué à la minute de ton morceau");
  const chain = Object.assign({}, smp, { chain: [{ album: "ALBUM", track: "TITRE", y: "zzzzzzzzzzz" }, smp] });
  near(E.t.levelOf(chain, { ci: 1 }), Math.pow(10, 4.5 / 20), "F1 : enchaînement → niveau du sample entendu");
  assert.strictEqual(E.t.levelOf(chain, { ci: 0 }), 1, "F1 : sample inconnu → niveau inchangé");
  const hot = { album: "ALBUM", track: "TITRE", y: "aaaaaaaaaaa" };
  near(E.t.levelOf(hot, { ci: 0 }), Math.pow(10, 6 / 20), "F1 : gain borné à +6 dB");
  near(E.t.levelOf(hot, { track: true }), Math.pow(10, -12 / 20), "F1 : gain borné à −12 dB");
  assert.strictEqual(E.t.levelOf({ album: "ALBUM", track: "TITRE", y: "bbbbbbbbbbb" }, { ci: 0 }), 1, "F1 : valeur fausse ignorée");
  assert.deepStrictEqual(E.t.mixInfo(smp).sg, [92, 1.25, 0.8], "F1 : grilles gardées pour les transitions");
  E.t.setMixData({ version: 2, items: mixEx.items });
  assert.strictEqual(E.t.levelOf(smp, { ci: 0 }), 1, "F1 : version inconnue ignorée");
  assert(!fs.existsSync(path.join(pub, "data/samples-mix.example.json")), "F1 : l'exemple de test reste hors de public/");
}

{
  // F3 (28/11/2026) : plafond du journal — les passages du Mix ne sont plus chassés par les gestes répétés.
  const pick = (re) => {
    const m = telemetry.match(re);
    assert(m, `audio-telemetry.js : ${re} introuvable`);
    return m[0];
  };
  const src = [
    pick(/const SESSION_EVENT_CAP = \d+;/),
    pick(/const SESSION_MIX_PRIORITY_CAP = \d+;/),
    pick(/const SESSION_MIX_PRIORITY_EVENTS = new Set\(\[[\s\S]*?\]\);/),
    pick(/function capSessionEvents\(input\) \{[\s\S]*?\n  \}\n/)
  ].join("\n");
  const cap = new Function(`${src}; return capSessionEvents;`)();
  const evs = [];
  for (let i = 0; i < 20; i++) evs.push({ event: "samples_pass", i });
  for (let i = 0; i < 60; i++) evs.push({ event: i % 2 ? "samples_seek" : "samples_lock", i });
  const kept = cap(evs);
  assert.strictEqual(kept.length, 48, "F3 : plafond 48 inchangé");
  assert.strictEqual(kept.filter((e) => e.event === "samples_pass").length, 20, "F3 : tous les passages gardés");
  // et le site garde de la place : au plus 36 places prioritaires
  const many = Array.from({ length: 80 }, (_, i) => ({ event: i < 60 ? "samples_pass" : "audio_play", i }));
  assert(cap(many).filter((e) => e.event === "audio_play").length >= 12, "F3 : 12 places au moins pour le reste");
  // mode et champs gardés : samples_pass envoie n, choice, bpm_gap (J4) ; le mode suit la section
  const E = loadEngine();
  E.t.pref.sec = "mix";
  E.t.setOptions({ fx: "echo" });
  const opt = E.events.find((e) => e[0] === "samples_mix_opt");
  assert(opt && opt[1].mode === "mix" && opt[1].opt === "fx" && opt[1].choice === "echo", "F3 : mode « mix » et choix notés");
  assert(/n: passN,\s*choice: plan\.picked/.test(samplesJs), "F3 : samples_pass numéroté, effet choisi noté");
  const ui = fs.readFileSync(path.join(pub, "assets/js/samples-mix-ui.js"), "utf8");
  for (const m of ui.matchAll(/track\("samples_mix_opt", \{([^}]*)\}\)/g))
    for (const k of m[1].matchAll(/([a-z_]+):/g))
      assert(keptFields.has(k[1]), `F3 : samples_mix_opt.${k[1]} (page Mix) serait jeté`);
}

// ---------- F5 (28/11/2026) : transitions calées, Auto, fin douce, comparer sample ↔ morceau ----------
{
  // Réglage choisi : appliqué dans les DEUX sens (INFRA, 28/11 : « faut qu'il y ait une transition reverb
  // ou quoi, si t'as choisi ») ; Auto par défaut ; anciens réglages Hasard / Basses relus.
  const E = loadEngine();
  const src = "assets/music/streams/v1/album/01-titre.m4a";
  const smpA = { album: "A", track: "T", y: "aaaaaaaaaaa", s0: 10, s1: 40, at: 70, go: NaN, tb: 120, src, tx: ["t_700", 66, 68], x: [["aaaaaaaaaaa_1-2", 6, 38]] };
  const smpB = { album: "B", track: "U", y: "bbbbbbbbbbb", s0: 20, s1: 50, at: 12, go: NaN, tb: 120, src, tx: ["u_120", 8, 68], x: [["bbbbbbbbbbb_1-2", 16, 38]] };
  const voice = { x0: 6, len: 38, item: smpA, k: 0 };
  assert.strictEqual(E.t.getOptions().fx, "auto", "F5 : Auto par défaut");
  for (const fx of ["reverb", "echo", "filter", "fade"]) {
    E.t.pref.mixo = { dur: "4", fx };
    const pOut = E.t.planOf("out", smpA, smpB);
    const pIn = E.t.planOf("in", smpA, smpA, { voice });
    assert(pOut.sched && pIn.sched, `F5 : passages calés (${fx})`);
    assert.strictEqual(pOut.fx, fx, `F5 : ton morceau → sample joue ${fx}`);
    assert.strictEqual(pIn.fx, fx, `F5 : sample → ton morceau joue ${fx} (plus l'entrée nette de 0,35 s)`);
  }
  E.t.pref.mixo = { dur: "4", fx: "auto" };
  const pa = E.t.planOf("in", smpA, smpA, { voice });
  assert(pa.picked === "auto" && E.t.st && pa.fx !== "auto", "F5 : Auto choisit une vraie transition");
  assert(E.t.planOf("in", smpA, smpA, { dur: 0.35 }).sched == null, "F5 : entrée de repli (YouTube, fin d'extrait) inchangée");
  E.t.pref.mixo = { dur: "none", fx: "reverb" };
  assert.strictEqual(E.t.planOf("in", smpA, smpA, { voice }).fx, "cut", "F5 : Aucune = coupe");
  E.t.pref.mixo = { dur: "4", fx: "listen" };
  assert.strictEqual(E.t.getOptions().fx, "auto", "F5 : ancien « Hasard » → Auto");
  E.t.pref.mixo = { dur: "4", fx: "bass" };
  assert.strictEqual(E.t.getOptions().fx, "filter", "F5 : ancien « Basses » → Filtre");
  assert.strictEqual(E.t.setOptions({ fx: "auto" }).fx, "auto", "F5 : Auto se choisit");
  assert.deepStrictEqual(E.t.getOptions().effects, ["auto", "fade", "reverb", "echo", "filter"]);
  // grille du morceau : entrée calée sur le 1er temps le plus proche (samples-mix.json, tgd)
  E.t.setMixData({ version: 1, items: { "A|T|aaaaaaaaaaa": { tgd: [120, 0.3, 0.95], sg: [120, 0.1, 0.9] } } });
  assert(Math.abs(E.t.entryOf(smpA) - 70.3) < 1e-9, "F5 : entrée de ton morceau sur son 1er temps");
  assert.strictEqual(E.t.entryOf(smpB), 12, "F5 : sans grille, entrée inchangée");
  // aller et retour sample ↔ morceau : 0,3 s tous les deux, au même endroit musical
  assert(/function jumpToSample\(cur, t\) \{\s*var plan = planOf\("seek", null, null, \{ dur: 0\.3 \}\);/.test(samplesJs), "F5 : retour au sample en 0,3 s");
  assert(/planOf\("seek", i, i, \{ dur: 0\.3 \}\)/.test(samplesJs), "F5 : aller au morceau en 0,3 s");
}
{
  // F5 : fin douce (INFRA, 28/11 : « faut pas que ce soit aussi brut ») : aucune automation de fin ne
  // saute de plus de 1 dB en moins de 20 ms (voix qui entre en fin de montée, voix qui sort sous −12 dB,
  // retours d'écho et de nappe) ; filtres jamais déplacés d'un coup pendant qu'ils s'entendent.
  const A = fakeAudio();
  const E = loadEngine({ AudioContext: A.Ctx, Audio: A.Audio, timers: true });
  const c = E.t.ensureCtx(true);
  c.state = "running";
  E.t.bus();
  const P = A.made.params[0].constructor.prototype;
  for (const k of ["setValueAtTime", "linearRampToValueAtTime", "exponentialRampToValueAtTime", "cancelScheduledValues", "cancelAndHoldAtTime"]) {
    const f = P[k];
    P[k] = function (...a) {
      if (!("v0" in this)) this.v0 = this.value;
      return f.apply(this, a);
    };
  }
  // valeur d'un paramètre à l'instant t, d'après ses appels (sémantique Web Audio simplifiée)
  const curve = (p) => {
    let ev = [];
    const at = (t) => {
      const sorted = ev.slice().sort((a, b) => a.t - b.t);
      let prev = null, next = null;
      for (const e of sorted) {
        if (e.t <= t) prev = e;
        else { next = e; break; }
      }
      const pv = prev ? prev.v : p.v0 != null ? p.v0 : p.value;
      const pt = prev ? prev.t : -Infinity;
      if (next && next.type === "lin" && isFinite(pt)) return pv + ((next.v - pv) * (t - pt)) / (next.t - pt);
      if (next && next.type === "exp" && isFinite(pt) && pv > 0) return pv * Math.pow(next.v / pv, (t - pt) / (next.t - pt));
      return pv;
    };
    for (const [type, a, b] of p.calls) {
      if (type === "set" || type === "lin" || type === "exp") ev.push({ type, v: a, t: b });
      else if (type === "cancel") ev = ev.filter((e) => e.t < a);
      else if (type === "hold") {
        const v = at(a);
        ev = ev.filter((e) => e.t <= a);
        ev.push({ type: "set", v, t: a });
      }
    }
    return at;
  };
  const db = (x) => 20 * Math.log10(x);
  const smooth = (p, from, to, keep, what) => {
    const f = curve(p);
    for (let t = from; t < to; t += 0.002) {
      const a = f(t), b = f(t + 0.02);
      if (!keep(a) || !keep(b) || a < 0.001 || b < 0.001) continue;
      assert(Math.abs(db(b) - db(a)) <= 1 + 1e-6, `${what} : saut de ${(db(b) - db(a)).toFixed(2)} dB en 20 ms à t = ${t.toFixed(3)}`);
    }
  };
  const buf = c.createBuffer(2, 8000 * 60);
  let checked = 0;
  const core = E.win.InfraSamplesMixCore;
  for (const fx of ["fade", "reverb", "blend", "filter", "echo", "wash", "brake", "roll"]) {
    for (const bpm of [70, 128, 170]) {
      E.t.eng.voices.length = 0;
      const item = { y: "aaaaaaaaaaa", x: [["a", 0, 60]] };
      const sg = { x: ["a", 0, 60], s0: 0, s1: 60 };
      const ov = E.t.startVoice(buf, item, 0, 10, 5, sg);
      E.t.setCurve(ov, 0, 1, 5, 0.05);
      const S = core.schedule({ fx, bars: 2, outTempo: bpm, outEnd: 40, outMax: 44, outMin: 20, inTempo: bpm, inAt: 20, inMin: 16, rate: 1.03 });
      const R = 5 + (S.R - 10); // la voix qui sort est à la position S.R à cet instant
      const nv = E.t.startVoice(buf, item, 0, S.inFrom, R + S.inStart, sg);
      const plan = { id: 1, kind: "smp", when: R + S.inStart, want: R + S.inStart, dur: S.span, fx: S.fx, picked: "auto", opt: {}, ev: {}, sched: S, fromTempo: bpm, toTempo: bpm };
      const before = A.made.params.length;
      E.t.transition({ all: true, except: nv, main: ov }, { v: nv }, plan, R + S.inStart);
      const end = R + S.span + 8;
      const what = `${fx} @ ${bpm}`;
      smooth(nv.g.gain, R + S.inStart, end, (x) => x >= 0.9, `${what}, fin de la montée`);
      if (fx !== "echo" && fx !== "roll") smooth(ov.g.gain, R - 2, end, (x) => x <= 0.25, `${what}, fin de la voix qui sort`);
      // retours d'effet créés par ce passage (écho, nappe) : leur extinction
      const sends = new Set((ov.sends || []).concat(nv.sends || []).map((s) => s.gain));
      A.made.params.slice(before).forEach((p, i) => {
        if (!p.isGain || sends.has(p) || !p.calls.length) return;
        if (fx === "roll") return; // boucle : coupes voulues entre ses paliers (avant le 1er temps)
        smooth(p, R + S.gap, end, () => true, `${what}, queue d'effet ${i}`);
        checked++;
      });
      // filtres des deux voix : aucun saut pendant qu'elles s'entendent
      for (const [v, name] of [[nv, "entrant"], [ov, "sortant"]]) {
        const g = curve(v.g.gain);
        for (const p of [v.hp.frequency, v.lp.frequency]) {
          const f = curve(p);
          for (let t = R + S.inStart; t < end; t += 0.001) {
            if (g(t) < 0.001 || g(t + 0.001) < 0.001) continue;
            const r = Math.abs(Math.log(f(t + 0.001) / f(t)));
            assert(r < Math.log(1.5), `${what} : filtre ${name} qui saute à t = ${t.toFixed(3)}`);
          }
        }
      }
      // vitesse calée (F6) : seulement pour les fondus, retour progressif à 1
      const pr = nv.s.playbackRate.calls;
      if (["fade", "reverb", "blend", "filter"].includes(fx)) {
        assert(pr.some((x) => x[0] === "lin" && x[1] === 1), `${what} : retour progressif de la vitesse à 1`);
        const t = E.t.ctxAt(nv, S.inAt);
        assert(Math.abs(t - R) < 1e-3, `${what} : le son qui entre est sur son 1er temps à l'instant calé (${(t - R).toFixed(4)})`);
      } else assert(!pr.length, `${what} : vitesse inchangée`);
    }
  }
  assert(checked >= 6, `F5 : queues d'effet vérifiées (${checked})`);
}

// ---------- bilan ----------
if (errors.length) {
  console.error(`Samples checks FAILED (${errors.length}) :\n- ${errors.slice(0, 30).join("\n- ")}`);
  process.exit(1);
}
const stale = [...KNOWN.keys()].filter((k) => !seenKnown.has(k));
console.log(
  `Samples checks passed: ${count} sons (musique seulement), ${timed} avec temps, ${parts4}/${partsAll} passages avec 4 s de marge des deux côtés, ` +
    `${orphans.length} pochette(s) orpheline(s), cœur du Mix et télémétrie OK.`
);
console.log(`Samples défauts connus (${seenKnown.size}) : ${[...seenKnown].map((k) => KNOWN.get(k)).join(" ; ")}`);
if (stale.length) console.log(`Samples : corrigés, à retirer de la liste KNOWN : ${stale.join(", ")}`);
