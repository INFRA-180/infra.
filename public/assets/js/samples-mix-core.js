/* global module */
// Cœur du Mix Samples (20/11/2026, lot T bis) : fonctions pures, sans DOM ni Web Audio.
// Spécification testée par tools/test-samples.js ; le moteur (samples.js) peut s'y brancher
// via window.InfraSamplesMixCore. Choix d'INFRA : durée en mesures Aucune · 2 · 4 (T12, 27/11 ;
// remplace Aucune · 5 s · Auto), effets Fondu · Reverb · Écho · Basses · Hasard qui écoute,
// défaut 4 mesures + Fondu, sample → morceau reste « pile et fort » (0,35 s).
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
  var EFFECTS = ["fade", "reverb", "echo", "bass", "listen"];
  var DEFAULTS = Object.freeze({ dur: "4", fx: "fade" });

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
  function resolveEffect(fx, bpmA, bpmB) {
    var f = EFFECTS.indexOf(fx) >= 0 ? fx : DEFAULTS.fx;
    return f === "listen" ? listeningEffect(bpmA, bpmB) : f;
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
