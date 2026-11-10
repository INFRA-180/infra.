"use strict";

// Recherches dans le code source insensibles au formatage (chantier JavaScript d'INFRA, étape 4e).
// Les contrôles du site vérifient que certains bouts de code existent. Avant, ils les cherchaient
// au caractère près : un simple retour à la ligne ajouté par le formatage les cassait.
// Ici, chaque recherche essaie d'abord le texte exact, puis le texte « sans espaces » :
// on compare le code et le motif après avoir retiré tous les blancs.
// Les positions rendues sont toujours celles du texte d'origine (slice reste utilisable).

const cache = new Map();

const WORD = /[A-Za-z0-9_$]/;

// Texte normalisé : les blancs disparaissent, sauf un espace entre deux caractères de mot
// (« return x » reste « return x », « f (a, b) » devient « f(a,b) »).
function squashed(text) {
  let entry = cache.get(text);
  if (entry) return entry;
  const map = new Int32Array(text.length + 1);
  let out = "";
  let n = 0;
  let pendingSpace = -1;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 32 || code === 10 || code === 13 || code === 9) {
      if (pendingSpace < 0) pendingSpace = i;
      continue;
    }
    if (pendingSpace >= 0 && n > 0 && WORD.test(out[n - 1]) && WORD.test(text[i])) {
      map[n] = pendingSpace;
      n += 1;
      out += " ";
    }
    pendingSpace = -1;
    map[n] = i;
    n += 1;
    out += text[i];
  }
  map[n] = text.length;
  entry = { text: out, map };
  if (text.length > 256) cache.set(text, entry);
  return entry;
}

function squash(text) {
  return squashed(String(text)).text;
}

// Position (dans le texte d'origine) du début d'un index du texte sans espaces.
function originalIndex(text, squashedIndex) {
  return squashed(text).map[squashedIndex];
}

function squashedStart(text, originalStart) {
  if (!originalStart) return 0;
  return squash(text.slice(0, originalStart)).length;
}

function codeHas(source, needle, fromIndex) {
  if (typeof source !== "string" || typeof needle !== "string") return source.includes(needle, fromIndex);
  return codeIndexOf(source, needle, fromIndex) >= 0;
}

function codeIndexOf(source, needle, fromIndex) {
  if (typeof source !== "string" || typeof needle !== "string") return source.indexOf(needle, fromIndex);
  const exact = source.indexOf(needle, fromIndex);
  if (exact >= 0) return exact;
  if (/^\s|\s$/.test(needle)) return -1; // un blanc au bord est une limite voulue
  const compactNeedle = squash(needle);
  if (!compactNeedle) return -1;
  const at = squashed(source).text.indexOf(compactNeedle, squashedStart(source, fromIndex));
  return at < 0 ? -1 : originalIndex(source, at);
}

function codeLastIndexOf(source, needle, fromIndex) {
  if (typeof source !== "string" || typeof needle !== "string") return source.lastIndexOf(needle, fromIndex);
  const exact = source.lastIndexOf(needle, fromIndex);
  if (exact >= 0) return exact;
  if (/^\s|\s$/.test(needle)) return -1; // un blanc au bord est une limite voulue
  const compactNeedle = squash(needle);
  if (!compactNeedle) return -1;
  const limit = fromIndex === undefined ? undefined : squashedStart(source, fromIndex);
  const at = squashed(source).text.lastIndexOf(compactNeedle, limit);
  return at < 0 ? -1 : originalIndex(source, at);
}

// Même expression régulière, appliquée au texte normalisé : chaque blanc (espace, \s, \n…, avec son
// quantificateur) devient « un espace facultatif ». Un blanc obligatoire au tout début ou à la fin
// de l'expression sert de limite (ex. /\ssrc="/) : dans ce cas, pas de relâchement.
const relaxedCache = new Map();
function relaxed(regex) {
  const key = regex.source + "/" + regex.flags;
  let result = relaxedCache.get(key);
  if (result !== undefined) return result || null;
  const source = regex.source;
  let out = "";
  let inClass = false;
  let abort = false;
  for (let i = 0; i < source.length && !abort; i += 1) {
    const ch = source[i];
    let tokenEnd = i;
    if (ch === "\\") {
      const next = source[i + 1];
      if (!inClass && (next === "s" || next === "n" || next === "r" || next === "t")) {
        tokenEnd = i + 1;
      } else {
        out += ch + (next === undefined ? "" : next);
        i += 1;
        continue;
      }
    } else if (inClass) {
      if (ch === "]") inClass = false;
      out += ch;
      continue;
    } else if (ch === "[") {
      inClass = true;
      out += ch;
      continue;
    } else if (ch !== " ") {
      out += ch;
      continue;
    }
    const after = skipQuantifier(source, tokenEnd);
    const quantifier = source.slice(tokenEnd + 1, after + 1);
    const optional = /^[*?]/.test(quantifier) || /^\{0/.test(quantifier);
    const atStart = out === "" || /(^|[^\\])[\^(|]$/.test(out);
    const rest = source.slice(after + 1);
    const atEnd = rest === "" || /^[$)|]/.test(rest);
    if (!optional && (atStart || atEnd)) abort = true;
    if (!out.endsWith(" ?")) out += " ?";
    i = after;
  }
  if (abort) {
    relaxedCache.set(key, false);
    return null;
  }
  try {
    result = new RegExp(out, regex.flags.replace(/[gy]/g, ""));
  } catch (_error) {
    result = null;
  }
  relaxedCache.set(key, result || false);
  return result;
}

function skipQuantifier(source, index) {
  let i = index;
  const next = source[i + 1];
  if (next === "*" || next === "+" || next === "?") i += 1;
  else if (next === "{") {
    const close = source.indexOf("}", i + 1);
    if (close > 0 && /^\{\d+(,\d*)?\}$/.test(source.slice(i + 1, close + 1))) i = close;
  }
  if (source[i + 1] === "?") i += 1;
  return i;
}

function relaxedExec(regex, source) {
  const loose = relaxed(regex);
  if (!loose) return null;
  const match = loose.exec(squashed(source).text);
  if (match) match.index = originalIndex(source, match.index);
  return match;
}

function codeTest(regex, source) {
  if (!(regex instanceof RegExp) || typeof source !== "string") return regex.test(source);
  if (regex.test(source)) return true;
  if (regex.global || regex.sticky) return false;
  return Boolean(relaxedExec(regex, source));
}

function codeMatch(source, regex) {
  if (typeof source !== "string" || !(regex instanceof RegExp) || regex.global || regex.sticky) return source.match(regex);
  return source.match(regex) || relaxedExec(regex, source);
}

function codeSearch(source, regex) {
  if (typeof source !== "string" || !(regex instanceof RegExp)) return source.search(regex);
  const exact = source.search(regex);
  if (exact >= 0) return exact;
  const match = relaxedExec(regex, source);
  return match ? match.index : -1;
}

function fail(message, fallback) {
  const assert = require("node:assert/strict");
  if (message instanceof Error) throw message;
  throw new assert.AssertionError({ message: message || fallback, stackStartFn: fail });
}

function codeAssertMatch(source, regex, message) {
  if (!codeTest(regex, source)) {
    fail(message, `The input did not match the regular expression ${regex} (even ignoring whitespace).`);
  }
}

function codeAssertDoesNotMatch(source, regex, message) {
  if (codeTest(regex, source)) {
    fail(message, `The input was expected to not match the regular expression ${regex}.`);
  }
}

module.exports = {
  squash,
  codeHas,
  codeIndexOf,
  codeLastIndexOf,
  codeTest,
  codeMatch,
  codeSearch,
  codeAssertMatch,
  codeAssertDoesNotMatch
};
