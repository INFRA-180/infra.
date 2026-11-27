#!/usr/bin/env node
"use strict";

// Section Samples (20/11/2026, lot T bis) : (a) cohérence de public/data/samples.json,
// (b) spécification du cœur du Mix (public/assets/js/samples-mix-core.js),
// (c) télémétrie : chaque événement du Mix est bien gardé par src/js/audio-telemetry.js.
// Les défauts déjà connus (D4) sont listés à part : signalés, sans faire échouer.

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const pub = path.join(root, "public");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(pub, rel), "utf8"));

// Défauts connus, clé = identifiant YouTube + contrôle. Corriger la donnée, puis retirer la ligne.
const KNOWN = new Map([
  ["1c19LDcRyZ0:at", "IMPRESSION / CONTEMPLATION : entrée à 152,7 s, morceau de 125 s (D4)"],
  ["I3Ak5VgyEoc:time", "MARSELHA : son sans temps, exclu du Mix (D4)"],
  ["A9GlyE7Z7IQ:time", "Question avec réponse le zin : son sans temps, exclu du Mix (D4)"],
  ["CFm4R3qHjpw:time", "Soleil qui se leve : son sans temps, exclu du Mix (D4)"],
  ["HQjsAlT92Lg:x", "NYQUIST / LIVE SESSION MALVADO (415-460 s) : extrait de 7 s seulement (trouvé le 20/11)"]
]);
const TOLERANCE_S = 0.05; // arrondis des extraits (ex. 155,987 au lieu de 156)

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
let count = 0;
let voices = 0;
let timed = 0;
let parts4 = 0;
let partsAll = 0;

assert.strictEqual(samples.version, 2, "samples.json : version 2 attendue");
assert(Array.isArray(samples.albums) && samples.albums.length, "samples.json : albums manquants");

for (const album of samples.albums) {
  for (const track of album.tracks || []) {
    const songSeconds = durationOf.get(`${String(album.title).toLowerCase()}|${String(track.title).toLowerCase()}`);
    for (const it of track.items || []) {
      count += 1;
      const where = `${album.title} / ${track.title} / ${it.y}`;
      assert(/^[\w-]{11}$/.test(String(it.y)), `${where} : identifiant YouTube invalide`);

      // voix : 1 ou absent, et une voix doit être jouable dans A cappella
      if ("v" in it) {
        if (it.v !== 1) errors.push(`${where} : v doit valoir 1 (voix) ou être absent`);
        else voices += 1;
      }

      const hasTime = "s0" in it || "s1" in it || "at" in it || "x" in it;
      if (!hasTime) {
        problem(`${it.y}:time`, `${where} : aucun temps (s0, s1, at, x)`);
        if (it.v === 1) errors.push(`${where} : voix sans temps`);
        continue;
      }
      timed += 1;
      if (!finite(it.s0) || !finite(it.s1) || !(it.s0 >= 0) || !(it.s0 < it.s1)) {
        errors.push(`${where} : s0 < s1 attendu (${it.s0} / ${it.s1})`);
      }
      if (!finite(it.at) || it.at < 0) errors.push(`${where} : at manquant ou négatif`);
      else if (finite(songSeconds) && it.at > songSeconds) {
        problem(`${it.y}:at`, `${where} : at ${it.at} s après la fin du morceau (${songSeconds} s)`);
      }
      if ("tb" in it && !(finite(it.tb) && it.tb > 0)) errors.push(`${where} : tb (BPM) doit être un nombre > 0`);
      if ("bpm" in it && !(Array.isArray(it.bpm) && it.bpm.length === 2 && it.bpm.every((b) => finite(b) && b > 0))) {
        errors.push(`${where} : bpm doit être [BPM d'origine, BPM joué]`);
      }

      // passages : p[0] = [s0, s1] ; un extrait x par passage, qui couvre le passage
      // (le nom d'extrait peut garder l'ancien identifiant : NASCAR, lien corrigé en v471)
      const parts = Array.isArray(it.p) ? it.p : [[it.s0, it.s1]];
      if ("p" in it) {
        if (!Array.isArray(it.p) || !it.p.length) errors.push(`${where} : p doit être une liste de passages`);
        else if (it.p[0][0] !== it.s0 || it.p[0][1] !== it.s1) errors.push(`${where} : p[0] doit valoir [s0, s1]`);
      }
      if (!Array.isArray(it.x) || it.x.length !== parts.length) {
        problem(`${it.y}:x`, `${where} : un extrait x par passage attendu (${(it.x || []).length} pour ${parts.length})`);
        continue;
      }
      parts.forEach((q, qi) => {
        const x = it.x[qi];
        if (!Array.isArray(q) || !finite(q[0]) || !finite(q[1]) || !(q[0] < q[1])) {
          errors.push(`${where} : passage ${qi} invalide`);
          return;
        }
        if (!Array.isArray(x) || !/^[\w-]{11}_\d+-\d+$/.test(String(x[0])) || !finite(x[1]) || !(x[2] > 0)) {
          errors.push(`${where} : extrait ${qi} mal formé`);
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

      // pochette : présente pour chaque son jouable
      if (it.c !== 1) errors.push(`${where} : pochette manquante (c)`);
      else if (!covers.has(`${it.y}.webp`)) errors.push(`${where} : fichier assets/samples/${it.y}.webp absent`);
      else usedCovers.add(`${it.y}.webp`);
    }
  }
}
const orphans = [...covers].filter((f) => f.endsWith(".webp") && !usedCovers.has(f));

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

// durée
near(core.transitionSeconds("none", 120), 0.03, "Aucune ≈ 0,03 s");
near(core.transitionSeconds("none", 120, 0), 0.03, "Aucune n'est jamais plafonnée");
near(core.transitionSeconds("5", 120), 5, "5 s");
near(core.transitionSeconds("5"), 5, "5 s sans BPM");
near(core.autoSeconds(120), 8, "Auto à 120 BPM = 4 mesures = 8 s");
near(core.autoSeconds(160), 6, "Auto à 160 BPM = 6 s");
near(core.autoSeconds(60), 12, "Auto bornée à 12 s");
near(core.autoSeconds(300), 4, "Auto bornée à 4 s");
near(core.autoSeconds(0), 8, "Auto sans BPM = 8 s");
near(core.autoSeconds(undefined), 8, "Auto BPM inconnu = 8 s");
near(core.transitionSeconds("auto", 160), 6, "Auto 160 BPM, marge 4 s");
near(core.transitionSeconds("auto", 70), 8, "Auto 70 BPM (13,7 s → 12 s) plafonnée à 2 × 4 s");
near(core.transitionSeconds("auto"), 8, "Auto sans BPM");
near(core.transitionSeconds("5", 120, 2), 4, "5 s plafonnée par une marge de 2 s");
near(core.transitionSeconds("auto", 80, 6), 12, "marge 6 s (extraits refaits) : Auto 80 BPM = 12 s");
near(core.transitionSeconds(undefined, 120), 8, "défaut = Auto");
for (const bpm of [0, 40, 63, 90, 120, 158, 400]) {
  for (const choice of core.DURATIONS) {
    const d = core.transitionSeconds(choice, bpm);
    assert(d >= core.NONE_S && d <= 2 * core.EXTRACT_MARGIN_S, `${choice} @ ${bpm} : ${d} hors bornes`);
  }
}
near(core.transitionFor("sample_to_track", "5", 120), 0.35, "sample → morceau reste 0,35 s");
near(core.transitionFor("track_to_sample", "5", 120), 5, "morceau → sample suit le réglage");
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
assert.deepStrictEqual({ ...core.DEFAULTS }, { dur: "auto", fx: "fade" });

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
    InfraSamplesMixCore: core
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
  E.t.pref.mixo = { dur: "auto", fx: "reverb" };
  const p = E.t.planOf("out", { src: item.src, at: 70, tb: 120, tx: ["t", 66, 68] }, smp);
  assert(p.dur <= 8 + 1e-9 && p.dur >= 2, `M3 : durée de sortie ${p.dur} hors marges`);
}

// ---------- bilan ----------
if (errors.length) {
  console.error(`Samples checks FAILED (${errors.length}) :\n- ${errors.slice(0, 30).join("\n- ")}`);
  process.exit(1);
}
const stale = [...KNOWN.keys()].filter((k) => !seenKnown.has(k));
console.log(
  `Samples checks passed: ${count} sons, ${timed} avec temps, ${voices} voix, ${parts4}/${partsAll} passages avec 4 s de marge des deux côtés, ` +
    `${orphans.length} pochette(s) orpheline(s), cœur du Mix et télémétrie OK.`
);
console.log(`Samples défauts connus (${seenKnown.size}) : ${[...seenKnown].map((k) => KNOWN.get(k)).join(" ; ")}`);
if (stale.length) console.log(`Samples : corrigés, à retirer de la liste KNOWN : ${stale.join(", ")}`);
