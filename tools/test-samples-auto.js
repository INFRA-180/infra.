#!/usr/bin/env node
// F5 + F6 (28/11/2026) : choix d'« Auto » et calage des passages du Mix, sur une table de VRAIS cas
// (public/data/samples.json + public/data/samples-mix.json). Fonctions pures de samples-mix-core.js :
// aucun son, aucun navigateur. Lancé par tools/test-samples.js (npm test), ou seul : node tools/test-samples-auto.js
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

module.exports = function run(core) {
  const root = path.resolve(__dirname, "..");
  const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg} : ${a} au lieu de ${b}`);

  // ---------- rapports de tempo (1, 2, ½, 3/2, 2/3 ; ≤ 6 % = mixable) ----------
  const tm = core.tempoMatch;
  assert.strictEqual(tm(0, 120), null, "tempo inconnu");
  assert.strictEqual(tm(120, 120).ratio, 1);
  assert(tm(120, 123).ok && !tm(120, 130).ok, "6 % : 123 oui, 130 non");
  assert.strictEqual(tm(70, 140).ratio, 2, "demi-tempo");
  assert(tm(70, 140).ok && Math.abs(tm(70, 140).rate - 1) < 1e-9);
  assert.strictEqual(tm(140, 72).ratio, 0.5, "double tempo");
  assert.strictEqual(tm(90, 140).ratio, 1.5, "90 → 140 : 3/2 (3,7 %)");
  assert(tm(90, 140).ok);
  near(tm(90, 140).rate, 135 / 140, 1e-9, "vitesse donnée au son qui entre");
  assert.strictEqual(tm(140, 90).ratio, 2 / 3, "140 → 90 : 2/3");
  assert(!tm(91.34, 99).ok, "HONNETE 91,34 → 99 : 7,7 %, pas mixable");

  // ---------- Auto ----------
  const ap = core.autoPick;
  const sure = { outConf: 0.85, inConf: 0.95 };
  assert.strictEqual(ap({ ...sure, outTempo: 120, inTempo: 122 }).fx, "blend", "tempos proches → fondu calé");
  assert.strictEqual(ap({ ...sure, outTempo: 120, inTempo: 122, last: "blend" }).fx, "filter", "jamais deux fondus calés de suite");
  assert.strictEqual(ap({ outTempo: 120, inTempo: 122, outConf: 0.35, inConf: 0.95 }).fx, "echo", "grille peu sûre : pas de fondu calé");
  assert.strictEqual(ap({ ...sure, kind: "in", outTempo: 91, inTempo: 99, goBars: 2 }).fx, "roll", "moment fort go → boucle qui roule");
  assert.strictEqual(ap({ ...sure, kind: "in", outTempo: 91, inTempo: 99, goBars: 2, outBuf: false }).fx, "echo", "flux : pas de boucle");
  assert.strictEqual(ap({ ...sure, kind: "in", outTempo: 120, inTempo: 121, goBars: 4 }).fx, "blend", "calé passe avant la boucle");
  assert.strictEqual(ap({ ...sure, outTempo: 91.34, inTempo: 99 }).fx, "echo", "écart moyen → écho");
  assert.strictEqual(ap({ ...sure, outTempo: 91.34, inTempo: 99, last: "echo" }).fx, "wash", "écho déjà joué → nappe");
  assert.strictEqual(ap({ ...sure, outTempo: 100, inTempo: 125 }).fx, "brake", "grand écart → freinage");
  assert.strictEqual(ap({ ...sure, outTempo: 100, inTempo: 125, outBuf: false }).fx, "wash", "flux : pas de freinage");
  assert.strictEqual(ap({ outTempo: 0, inTempo: 120 }).fx, "wash", "tempo inconnu → nappe (sans rythme)");
  assert.strictEqual(ap({ outTempo: 0, inTempo: 120, last: "wash" }).fx, "fade");
  near(ap({ ...sure, outTempo: 120, inTempo: 122 }).rate, 120 / 122, 1e-9, "vitesse calée rendue");

  // ---------- calage : propriétés générales ----------
  const grid = [120, 0.5, 0.9]; // une mesure = 2 s, 1er temps à 0,5 s
  let S = core.schedule({ fx: "blend", bars: 4, outTempo: 120, outGrid: grid, outEnd: 41.3, outMax: 45, outMin: 20, inTempo: 120, inGrid: [120, 10.1, 0.9], inAt: 10.2, inMin: 6 });
  near((S.R - 0.5) / 2, Math.round((S.R - 0.5) / 2), 1e-9, "sortie sur un 1er temps de la grille");
  assert(S.R + S.outStart + S.outDur <= 45 + 1e-9, "la sortie tient dans l'extrait");
  near(S.outDur, 8, 1e-9, "bug 1 : 4 mesures vraiment jouées par la voix qui sort (8 s)");
  near(S.inAt, 10.1, 1e-9, "entrée calée sur le 1er temps du son qui entre");
  near(S.inFrom, S.inAt - 2, 1e-9, "le son qui entre monte une mesure avant (basses retenues)");
  assert.strictEqual(S.gap, 0);
  // marge avant presque nulle (116 samples sur 254) : la durée n'est plus rabotée
  S = core.schedule({ fx: "fade", bars: 4, outTempo: 92, outEnd: 60, outMax: 64, outMin: 30, inTempo: 92, inAt: 0.3, inMin: 0 });
  assert(S.outDur > 10, `bug 1 : 4 mesures à 92 BPM (${S.outDur.toFixed(1)} s), plus 2 s`);
  near(S.inFrom, 0, 1e-9, "le son qui entre part de sa vraie marge");
  assert(S.inDur >= 0.08, "jamais de montée plus courte que 80 ms");
  // écho : coupe sur le temps, entrée 4 temps plus tard, en temps du son qui sort
  S = core.schedule({ fx: "echo", bars: 4, outTempo: 100, outGrid: [100, 1, 0.9], outEnd: 50, outMax: 54, outMin: 30, inAt: 20, inMin: 16 });
  near(S.gap, 4 * 0.6, 1e-9, "écho : 4 répétitions d'un temps");
  near(S.inStart, S.gap, 1e-9);
  assert(S.lead >= 0.6 - 1e-9, "l'envoi monte un temps avant");
  S = core.schedule({ fx: "echo", bars: 2, outTempo: 100, outEnd: 50, outMax: 54, outMin: 30, inAt: 20, inMin: 16 });
  near(S.gap, 1.2, 1e-9, "écho 2 mesures : 2 répétitions");
  S = core.schedule({ fx: "brake", bars: 2, outTempo: 60, outEnd: 50, outMax: 50.5, outMin: 30, inAt: 20, inMin: 16 });
  assert(S.R + S.outDur <= 50.5 + 1e-9 && S.gap === S.outDur, "freinage : tient dans l'extrait, entrée à l'arrêt");
  S = core.schedule({ fx: "roll", bars: 4, outTempo: 120, outEnd: 50, outMax: 54, outMin: 30, inAt: 20, inMin: 16 });
  near(S.roll, 4, 1e-9, "boucle : 2 mesures");
  near(S.gap, 4.25, 1e-9, "boucle puis un demi-temps de silence");
  S = core.schedule({ fx: "blend", bars: 0, outTempo: 120, outEnd: 50, outMax: 54, inAt: 20, inMin: 16 });
  assert.strictEqual(S.fx, "cut", "Aucune = coupe");
  S = core.schedule({ fx: "blend", bars: 4, outTempo: 120, outEnd: 50, outMax: 54, outMin: 30, inAt: 20, inMin: 16, rate: 1.2 });
  near(S.rate, 1.06, 1e-9, "vitesse jamais au-delà de 6 %");

  // ---------- comparer sample ↔ morceau au même endroit musical ----------
  const sw = { at: 10, s0: 100, tb: 120, bpm: [90, 120] };
  near(core.sampleToTrack(sw, 104), 13, 1e-9, "sample calé 90 → 120 : 4 s de source = 3 s de morceau");
  near(core.trackToSample(sw, core.sampleToTrack(sw, 117.3)), 117.3, 1e-9, "aller-retour exact");
  near(core.sampleToTrack({ at: 5, s0: 20, tb: 100 }, 25), 10, 1e-9, "sans bpm : même vitesse");
  near(core.speedOf({ tb: 100, bpm: [300, 100] }), 1, 1e-9, "vitesse aberrante ignorée");

  // ---------- table de cas réels (samples.json + samples-mix.json) ----------
  const samples = JSON.parse(fs.readFileSync(path.join(root, "public/data/samples.json"), "utf8"));
  const mixPath = path.join(root, "public/data/samples-mix.json");
  if (!fs.existsSync(mixPath)) return; // grilles pas encore publiées : propriétés seules
  const mix = JSON.parse(fs.readFileSync(mixPath, "utf8")).items;
  const tempo = (g, base) => (g && g[2] >= 0.5 ? g[0] : base);
  const rows = [];
  for (const a of samples.albums)
    for (const t of a.tracks || [])
      for (const it of t.items || []) {
        const m = mix[`${a.title}|${t.title}|${it.y}`];
        if (!m || !Array.isArray(it.x) || !it.x.length || !Array.isArray(it.tx)) continue;
        rows.push({ name: `${t.title} / ${it.t}`, it, m });
      }
  assert(rows.length > 200, `table réelle : ${rows.length} cas`);
  const count = {};
  for (const { name, it, m } of rows) {
    const x = it.x[it.x.length - 1];
    const sTempo = tempo(m.sg, (it.bpm && it.bpm[0]) || it.tb);
    const tTempo = tempo(m.tgd, it.tb);
    const entry = Number.isFinite(it.go) ? it.go : it.at;
    const pick = ap({ kind: "in", outTempo: sTempo, inTempo: tTempo, outConf: m.sg ? m.sg[2] : 0, inConf: m.tgd ? m.tgd[2] : 0, goBars: Number.isFinite(it.go) ? ((it.go - it.at) * tTempo) / 240 : 0 });
    count[pick.fx] = (count[pick.fx] || 0) + 1;
    const match = tm(sTempo, tTempo);
    if (pick.fx === "blend" || pick.fx === "filter") assert(match && match.ok, `${name} : fondu calé sans tempo mixable`);
    for (const bars of [2, 4]) {
      const S = core.schedule({
        fx: pick.fx, bars, outTempo: sTempo, outGrid: m.sg, outEnd: it.s1, outMax: x[1] + x[2], outMin: it.s0 + (it.s1 - it.s0) / 2,
        inTempo: tTempo, inGrid: m.tgd, inAt: entry, inMin: it.tx[1], rate: pick.rate
      });
      const where = `${name} (${pick.fx}, ${bars} mesures)`;
      assert(S.inFrom >= it.tx[1] - 1e-9, `${where} : ton morceau part avant son extrait`);
      assert(S.R <= it.s1 + 1e-9 && S.R >= it.s0 - 1e-9, `${where} : sortie ${S.R} hors du sample`);
      if (S.outStart + S.outDur > 0.2) assert(S.R + S.outStart + S.outDur <= x[1] + x[2] + 1e-6 || S.R <= it.s0 + (it.s1 - it.s0) / 2 + 1e-9, `${where} : la sortie déborde de l'extrait`);
      assert(Math.abs(S.rate - 1) <= 0.06 + 1e-9, `${where} : vitesse ${S.rate}`);
      assert(S.span > 0 && S.span < 20, `${where} : durée ${S.span}`);
      if (core.gridOk(m.sg) && S.R > it.s0 + (it.s1 - it.s0) / 2 + 1e-6) {
        const k = (S.R - m.sg[1]) / (240 / m.sg[0]);
        near(k, Math.round(k), 1e-6, `${where} : sortie hors du 1er temps`);
      }
      if (core.gridOk(m.tgd) && Math.abs(S.inAt - entry) > 1e-9) {
        const k = (S.inAt - m.tgd[1]) / (240 / m.tgd[0]);
        near(k, Math.round(k), 1e-6, `${where} : entrée hors du 1er temps`);
      }
      assert(S.inDur >= 0.03 && S.inStart + S.inDur >= 0 - 1e-9, `${where} : montée`);
    }
  }
  // cas nommés (F4_FAIT.md)
  const find = (re) => rows.find((r) => re.test(r.name));
  const honnete = find(/^HONNETE \//);
  if (honnete) assert.notStrictEqual(ap({ kind: "in", outTempo: honnete.m.sg[0], inTempo: honnete.m.tgd[0], outConf: 0.85, inConf: 0.95 }).fx, "blend", "HONNETE : 91 → 99, pas de fondu calé");
  const candana = rows.find((r) => r.it.y === "QNJL6nfu__Q");
  if (candana) assert.strictEqual(ap({ kind: "in", outTempo: candana.m.sg[0], inTempo: candana.m.tgd[0], outConf: candana.m.sg[2], inConf: candana.m.tgd[2] }).fx, "blend", "CANDANA / They Don't Care About Us : 89,8 → 92, fondu calé");
  // Auto ne joue pas toujours la même chose sur les vrais cas
  assert(Object.keys(count).length >= 3, `Auto trop monotone : ${JSON.stringify(count)}`);
  module.exports.count = count;
};

if (require.main === module) {
  module.exports(require(path.resolve(__dirname, "../public/assets/js/samples-mix-core.js")));
  console.log("Samples Auto checks passed:", JSON.stringify(module.exports.count || {}));
}
