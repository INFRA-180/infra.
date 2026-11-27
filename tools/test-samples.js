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

// Hasard qui écoute
assert.strictEqual(core.listeningEffect(120, 120), "fade");
assert.strictEqual(core.listeningEffect(120, 123.9), "fade");
assert.strictEqual(core.listeningEffect(120, 124), "bass");
assert.strictEqual(core.listeningEffect(130, 120), "bass");
assert.strictEqual(core.listeningEffect(120, 132), "bass");
assert.strictEqual(core.listeningEffect(120, 132.1), "echo");
assert.strictEqual(core.listeningEffect(70, 140), "echo");
assert.strictEqual(core.listeningEffect(0, 120), "fade", "tempo inconnu → fondu");
assert.strictEqual(core.listeningEffect(undefined, 120), "fade");
assert.strictEqual(core.resolveEffect("listen", 90, 120), "echo");
assert.strictEqual(core.resolveEffect("reverb", 90, 120), "reverb");
assert.strictEqual(core.resolveEffect("inconnu", 90, 120), "fade", "effet inconnu → défaut");
assert.deepStrictEqual(core.EFFECTS, ["fade", "reverb", "echo", "bass", "listen"]);
assert.deepStrictEqual({ ...core.DEFAULTS }, { dur: "4", fx: "fade" });

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
    AudioContext: function () {}
  };
  const sandbox = {
    window: win,
    document: doc,
    navigator: {},
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => clock.wall },
    Date: FakeDate,
    setTimeout: () => 0,
    clearTimeout() {},
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
  return { t, clock, events, listeners, win, doc };
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
  // ton morceau → sample : plafonné par la marge de son extrait (4 s après la minute)
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
