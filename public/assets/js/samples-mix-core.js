/* global module */
// Cœur du Mix Samples (20/11/2026, lot T bis) : fonctions pures, sans DOM ni Web Audio.
// Spécification testée par tools/test-samples.js ; le moteur (samples.js) peut s'y brancher
// via window.InfraSamplesMixCore. Choix d'INFRA : durée en mesures Aucune · 2 · 4 (T12, 27/11 ;
// remplace Aucune · 5 s · Auto). F5 (28/11) : effet Auto par défaut (Fondu · Reverb · Écho · Filtre au
// choix) ; sample → morceau a sa vraie transition (même réglage que morceau → sample), calée sur le temps.
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.InfraSamplesMixCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var NONE_S = 0.03; // « Aucune » : coupe propre, sans clic
  var FIXED_S = 5; // ancien « 5 s » (réglage retenu sur l'appareil → 2 mesures)
  var AUTO_BARS = 4; // ancien « Auto » : 4 mesures de 4 temps = 16 temps = 960 / BPM secondes
  var NO_BPM = 120; // tempo inconnu : les mesures sont comptées à 120 BPM
  var AUTO_MIN_S = 4;
  var AUTO_MAX_S = 12;
  var AUTO_NO_BPM_S = 8;
  var EXTRACT_MARGIN_S = 4; // marge des extraits R2 de chaque côté de s0 / s1 (aujourd'hui)
  var TO_TRACK_S = 0.35; // sample → ton morceau : entrée nette (XF de samples.js)

  var DURATIONS = ["none", "2", "4"]; // T12 : nombre de mesures (8 · 16 quand les extraits seront recoupés)
  var LEGACY = { 5: "2", auto: "4" }; // anciens choix retenus sur l'appareil
  // F5 (28/11/2026, INFRA Q3 A) : « Auto » par défaut ; Fondu, Reverb, Écho, Filtre au choix. « Hasard »
  // rejoint Auto, « Basses » devient Filtre (anciens réglages retenus : LEGACY_FX).
  var EFFECTS = ["auto", "fade", "reverb", "echo", "filter"];
  var LEGACY_FX = { listen: "auto", random: "auto", bass: "filter" };
  // Transitions réellement jouées (champ fx de la télémétrie et de samples:transition).
  var PLAYED = ["blend", "echo", "filter", "wash", "roll", "brake", "fade", "reverb", "cut"];
  var OVERLAP_FX = { fade: 1, reverb: 1, blend: 1, filter: 1 }; // les deux voix s'entendent ensemble
  var RATIOS = [1, 2, 0.5, 1.5, 2 / 3]; // rapports de tempo essayés (3_WEB_DJ § 4)
  var MATCH_MAX = 0.06; // ≤ 6 % : mixable (vitesse de lecture légère, INFRA Q2 A)
  var GRID_MIN = 0.5; // confiance minimale d'une grille pour caler sur le 1er temps
  var MAX_S = 12; // durée maximale d'un passage (extraits de 30 à 45 s)
  var DEFAULTS = Object.freeze({ dur: "4", fx: "auto" });

  // Télémétrie du Mix : noms d'événements et champs compacts (aucun titre, aucune adresse).
  var TELEMETRY = Object.freeze({
    events: [
      "samples_part",
      "samples_seek",
      "samples_toggle",
      "samples_sort",
      "samples_mix_in",
      "samples_jump",
      "samples_mix_opt", // { opt: "dur" | "fx", choice }
      "samples_mix_fx", // { fx, dur_s, bpm_gap }
      "samples_mix_try", // { fx, dur_s }
      "samples_tab_swipe", // { tab, direction }
      "samples_voice_mark", // { at }
      // M1 (27/11/2026) : un événement par passage, envoyé quand le nouveau son part.
      "samples_pass", // { kind, cause, fx, dur_s, late_ms, gap_ms, pre, buf, ctx, vis }
      "samples_lock", // { cause, ctx } : pause ou coupure venue de l'extérieur
      "samples_resync" // { late_ms, dropped } : retour d'arrière-plan
    ],
    strings: ["sec", "sort", "scope", "to", "fx", "opt", "choice", "tab", "mode", "direction", "kind", "cause", "buf", "ctx"],
    numbers: ["n", "k", "bpm", "at", "bpm_gap", "dur_s", "late_ms", "gap_ms", "dropped"],
    booleans: ["pre", "fade", "vis"]
  });

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // Durée « Auto » : 4 mesures au tempo du sample, bornée 4-12 s ; 8 s sans BPM connu.
  function autoSeconds(bpm) {
    var b = num(bpm);
    if (!(b > 0)) return AUTO_NO_BPM_S;
    return clamp((AUTO_BARS * 4 * 60) / b, AUTO_MIN_S, AUTO_MAX_S);
  }

  // Durée de n mesures de 4 temps au tempo donné (120 BPM si inconnu).
  function barSeconds(bars, bpm) {
    var b = num(bpm);
    return ((Number(bars) || AUTO_BARS) * 4 * 60) / (b > 0 ? b : NO_BPM);
  }
  // Durée d'un fondu centré sur la jointure, en mesures (T12) : il mange margin s de chaque côté au plus,
  // donc jamais plus de 2 × margin (8 s avec les extraits actuels). « Aucune » n'est pas plafonnée.
  function transitionSeconds(choice, bpm, margin) {
    var c = String(choice == null ? DEFAULTS.dur : choice);
    c = LEGACY[c] || c;
    if (c === "none") return NONE_S;
    var m = num(margin);
    if (!(m >= 0)) m = EXTRACT_MARGIN_S;
    var want = barSeconds(c === "2" ? 2 : 4, bpm);
    return Math.max(NONE_S, Math.min(want, 2 * m));
  }

  // kind : "sample_to_sample", "track_to_sample" (réglables) ou "sample_to_track" (fixe 0,35 s).
  function transitionFor(kind, choice, bpm, margin) {
    if (kind === "sample_to_track") return TO_TRACK_S;
    return transitionSeconds(choice, bpm, margin);
  }

  // « Hasard qui écoute » : choisit l'effet selon l'écart de tempo entre les deux sons.
  // < 4 BPM → fondu ; 4 à 12 → filtre de basses ; > 12 → écho. Tempo inconnu → fondu.
  function bpmGap(a, b) {
    var x = num(a),
      y = num(b);
    if (!(x > 0) || !(y > 0)) return NaN;
    return Math.abs(x - y);
  }
  function listeningEffect(bpmA, bpmB) {
    var gap = bpmGap(bpmA, bpmB);
    if (!isFinite(gap) || gap < 4) return "fade";
    if (gap <= 12) return "bass";
    return "echo";
  }
  // Effet réellement joué (on affiche toujours celui-là, jamais « Hasard »).
  // ctx (facultatif) : contexte d'autoPick ; sans lui, Auto ne connaît que les deux tempos.
  function resolveEffect(fx, bpmA, bpmB, ctx) {
    var f = LEGACY_FX[fx] || fx;
    f = EFFECTS.indexOf(f) >= 0 ? f : DEFAULTS.fx;
    if (f !== "auto") return f;
    return autoPick(Object.assign({ outTempo: bpmA, inTempo: bpmB }, ctx || {})).fx;
  }

  // ---------- F5 (28/11/2026) : tempo, grille, choix d'Auto, calage des passages ----------
  // Rapport de tempo : la vitesse « rate » à donner au son qui ENTRE pour que ses temps tombent sur ceux du
  // son qui SORT (a = tempo sortant, b = tempo entrant), en essayant 1, 2, ½, 3/2, 2/3. null si inconnu.
  function tempoMatch(a, b) {
    a = num(a);
    b = num(b);
    if (!(a > 0) || !(b > 0)) return null;
    var best = null;
    RATIOS.forEach(function (r) {
      var rate = (a * r) / b,
        dev = Math.abs(rate - 1);
      if (!best || dev < best.dev - 1e-12) best = { ratio: r, rate: rate, dev: dev };
    });
    best.ok = best.dev <= MATCH_MAX + 1e-12;
    return best;
  }
  // Grille [bpm, t0, conf] utilisable pour caler (confiance ≥ GRID_MIN).
  function gridOk(g) {
    return !!(g && num(g[0]) > 0 && isFinite(num(g[1])) && num(g[2]) >= GRID_MIN);
  }
  function barOf(bpm) {
    var b = num(bpm);
    return 240 / (b > 0 ? b : NO_BPM);
  }
  // 1er temps de mesure de la grille autour de t : dir < 0 avant, > 0 après, 0 le plus proche.
  function downbeat(g, t, dir) {
    var bar = barOf(g[0]),
      k = (t - num(g[1])) / bar;
    k = dir < 0 ? Math.floor(k + 1e-9) : dir > 0 ? Math.ceil(k - 1e-9) : Math.round(k);
    return num(g[1]) + k * bar;
  }
  // Le 1er temps le plus proche de t, s'il est à moins de maxBars mesure (sinon t).
  function snapNear(g, t, maxBars) {
    if (!gridOk(g)) return t;
    var d = downbeat(g, t, 0);
    return Math.abs(d - t) <= (maxBars == null ? 0.35 : maxBars) * barOf(g[0]) ? d : t;
  }

  // « Auto » qui écoute (INFRA, 28/11) : selon le rapport de tempo, la confiance des grilles et la distance
  // au moment fort go. c : { kind, outTempo, inTempo, outConf, inConf, goBars, outBuf, last }.
  //   tempos mixables (≤ 6 %) et grilles sûres → fondu calé avec échange des basses (ou balayage de filtre
  //   si le passage d'avant était déjà un fondu calé) ;
  //   vers ton morceau avec un moment fort (go au moins 1 mesure après at) → boucle qui roule puis go ;
  //   tempo inconnu → reverb en nappe ; écart moyen → écho de sortie ; grand écart (> 12 %) → freinage ;
  //   jamais deux fois de suite la même transition quand une autre convient.
  function autoPick(c) {
    c = c || {};
    var m = tempoMatch(c.outTempo, c.inTempo),
      grids = num(c.outConf) >= GRID_MIN && num(c.inConf) >= GRID_MIN,
      last = c.last || "",
      buf = c.outBuf !== false,
      pick = function (list, why) {
        list = list.filter(function (f) {
          return buf || (f !== "brake" && f !== "roll");
        });
        var f =
          list.filter(function (x) {
            return x !== last;
          })[0] ||
          list[0] ||
          "fade";
        return { fx: f, rate: 1, why: why, match: m };
      };
    if (m && m.ok && grids) {
      var p = pick(["blend", "filter"], "tempo");
      p.rate = m.rate;
      return p;
    }
    if (c.kind === "in" && num(c.goBars) >= 1 && buf && last !== "roll") return pick(["roll"], "go");
    if (!m) return pick(["wash", "fade"], "unknown");
    if (m.dev > 0.12) return pick(["brake", "wash", "echo"], "far");
    return pick(["echo", "wash", "brake"], m.ok ? "grid" : "near");
  }

  // Calage d'un passage, en temps de source des deux sons (fonction pure, testée sur les vraies données).
  // o : { fx, bars (0 = Aucune, 2, 4), outTempo, outGrid, outEnd (jointure voulue), outMax (fin de l'extrait
  // qui sort), outMin (sortie au plus tôt), inTempo, inGrid, inAt (entrée voulue du son qui entre), inMin
  // (début de son extrait), rate (vitesse calée, sinon 1) }.
  // Rend R (position du son qui sort à l'instant de référence) et, en secondes depuis cet instant : inStart
  // (départ du son qui entre, à la position inFrom), inDur (sa montée), outStart / outDur (sortie), gap
  // (instant où le son qui entre domine), lead (avance du premier geste), span (durée totale). Fondus : la
  // voix qui sort porte la durée choisie (bug 1) ; la voix qui entre monte sur sa vraie marge et atteint inAt
  // pile à l'instant de référence, sur un 1er temps quand les grilles le permettent.
  function schedule(o) {
    o = o || {};
    var bars = num(o.bars) > 0 ? num(o.bars) : 0,
      fx = !bars ? "cut" : PLAYED.indexOf(o.fx) >= 0 ? o.fx : "fade",
      outT = num(o.outTempo) > 0 ? num(o.outTempo) : NO_BPM,
      inT = num(o.inTempo) > 0 ? num(o.inTempo) : outT,
      beat = 60 / outT,
      bar = 4 * beat,
      outEnd = num(o.outEnd),
      outMax = isFinite(num(o.outMax)) ? num(o.outMax) : outEnd + 60,
      outMin = isFinite(num(o.outMin)) ? Math.min(num(o.outMin), outEnd) : outEnd - 30,
      inMin = isFinite(num(o.inMin)) ? num(o.inMin) : -Infinity,
      inAt = num(o.inAt),
      rate = num(o.rate) > 0 ? clamp(num(o.rate), 1 - MATCH_MAX, 1 + MATCH_MAX) : 1,
      S = { fx: fx, beat: beat, bar: bar, rate: 1, rateBack: 2 * barOf(inT) };
    // l'entrée du son qui entre sur son 1er temps (au plus ¼ de mesure plus loin, jamais hors de l'extrait)
    if (gridOk(o.inGrid)) {
      var ia = snapNear(o.inGrid, inAt, 0.25);
      if (ia >= inMin) inAt = ia;
    }
    S.inAt = inAt;
    var outSnap = gridOk(o.outGrid),
      place = function (want, rmax) {
        var R = Math.min(want, rmax);
        if (outSnap) R = downbeat(o.outGrid, R + 1e-6, -1);
        return Math.max(outMin, R);
      };
    if (OVERLAP_FX[fx]) {
      S.rate = rate;
      var D = Math.min(bars * bar, MAX_S),
        preWant = fx === "blend" || fx === "filter" ? Math.min(bar, D / 2) : D / 2,
        avail = Math.max(0, inAt - inMin),
        pre = Math.min(preWant, avail / S.rate);
      S.inFrom = inAt - pre * S.rate;
      S.inStart = -pre;
      S.inDur = Math.max(0.08, pre);
      S.outStart = fx === "fade" || fx === "reverb" ? -pre : 0;
      S.outDur = D;
      S.R = place(outEnd, outMax - (S.outStart + D));
      // pas assez d'extrait après R : la sortie se raccourcit (jamais sous une demi-mesure)
      var room = outMax - S.R - S.outStart;
      if (room < S.outDur) S.outDur = Math.max(Math.min(bar / 2, D), room);
      S.gap = 0;
    } else {
      var len = 0,
        after = 0;
      if (fx === "echo") {
        S.gap = (bars >= 4 ? 4 : 2) * beat;
        S.outStart = -beat;
        S.outDur = Math.min(0.25 * beat, 0.12);
        after = 0.1;
      } else if (fx === "wash") {
        S.gap = (bars >= 4 ? 2 : 1) * beat;
        S.outStart = -bar;
        S.outDur = bar;
      } else if (fx === "brake") {
        len = clamp(beat * (bars >= 4 ? 2 : 1), 0.3, 1.6);
        S.gap = len;
        S.outStart = 0;
        S.outDur = len;
        after = len;
      } else if (fx === "roll") {
        len = Math.min(bars >= 4 ? 2 * bar : bar, 8);
        S.roll = len;
        S.gap = len + 0.5 * beat;
        S.outStart = 0;
        S.outDur = 0.03;
      } else {
        S.gap = 0;
        S.outStart = 0;
        S.outDur = 0.03;
      }
      S.R = place(outEnd, outMax - after);
      S.inFrom = inAt;
      S.inStart = S.gap;
      S.inDur = fx === "cut" ? 0.03 : 0.08; // entrée nette sur le temps, sans marche finale
    }
    if (Math.abs(S.rate - 1) < 0.003) S.rate = 1;
    S.lead = Math.max(0, -Math.min(S.inStart, S.outStart));
    S.span = Math.max(S.inStart + S.inDur, S.outStart + S.outDur, S.gap) - Math.min(S.inStart, S.outStart);
    S.rateHold = S.outStart + S.outDur; // la vitesse calée tient jusqu'au silence du son qui sort
    return S;
  }

  // Comparer sample ↔ morceau au même endroit musical (geste n° 1 d'INFRA) : le morceau contient le sample
  // à partir de at (source s0), joué au tempo du morceau (vitesse bpm[0] / tb s'il a été calé, sinon 1).
  function speedOf(s) {
    var a = s && s.bpm ? num(s.bpm[0]) : NaN,
      tb = num(s && s.tb);
    var k = a > 0 && tb > 0 ? a / tb : 1;
    return k >= 0.5 && k <= 2 ? k : 1;
  }
  function sampleToTrack(s, src) {
    return num(s.at) + (num(src) - num(s.s0)) * speedOf(s);
  }
  function trackToSample(s, t) {
    return num(s.s0) + (num(t) - num(s.at)) / speedOf(s);
  }

  // Fondu à puissance égale : t de 0 (début) à 1 (fin) ; out² + in² = 1 à tout instant.
  function equalPowerGains(t) {
    var p = clamp(num(t) || 0, 0, 1) * (Math.PI / 2);
    return { out: Math.cos(p), in: Math.sin(p) };
  }
  // Courbes pour AudioParam.setValueCurveAtTime (au moins 2 points).
  function equalPowerCurves(steps) {
    var n = Math.max(2, Math.floor(num(steps) || 64));
    var out = new Float32Array(n),
      inn = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var g = equalPowerGains(i / (n - 1));
      out[i] = g.out;
      inn[i] = g.in;
    }
    return { out: out, in: inn };
  }

  return Object.freeze({
    NONE_S: NONE_S,
    FIXED_S: FIXED_S,
    AUTO_MIN_S: AUTO_MIN_S,
    AUTO_MAX_S: AUTO_MAX_S,
    AUTO_NO_BPM_S: AUTO_NO_BPM_S,
    EXTRACT_MARGIN_S: EXTRACT_MARGIN_S,
    TO_TRACK_S: TO_TRACK_S,
    DURATIONS: DURATIONS.slice(),
    LEGACY: Object.freeze(Object.assign({}, LEGACY)),
    EFFECTS: EFFECTS.slice(),
    LEGACY_FX: Object.freeze(Object.assign({}, LEGACY_FX)),
    PLAYED: PLAYED.slice(),
    MATCH_MAX: MATCH_MAX,
    GRID_MIN: GRID_MIN,
    tempoMatch: tempoMatch,
    gridOk: gridOk,
    downbeat: downbeat,
    snapNear: snapNear,
    autoPick: autoPick,
    schedule: schedule,
    speedOf: speedOf,
    sampleToTrack: sampleToTrack,
    trackToSample: trackToSample,
    DEFAULTS: DEFAULTS,
    TELEMETRY: TELEMETRY,
    autoSeconds: autoSeconds,
    barSeconds: barSeconds,
    transitionSeconds: transitionSeconds,
    transitionFor: transitionFor,
    bpmGap: bpmGap,
    listeningEffect: listeningEffect,
    resolveEffect: resolveEffect,
    equalPowerGains: equalPowerGains,
    equalPowerCurves: equalPowerCurves
  });
});
