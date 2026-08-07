#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE_PATH = path.resolve(__dirname, "../public/assets/js/home-catalog.js");

function createClassList(initial) {
  const values = new Set(initial || []);
  return {
    add(...names) { names.forEach((name) => values.add(name)); },
    remove(...names) { names.forEach((name) => values.delete(name)); },
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
    contains(name) { return values.has(name); }
  };
}

function createHarness(options) {
  const opts = options || {};
  const listeners = new Map();
  const opened = [];
  const telemetry = [];
  const styleValues = new Map();
  const grid = { querySelectorAll() { return [card]; } };
  const card = {
    href: "https://site.test/music/v-23pi56-infra.html",
    classList: createClassList(["album-card"]),
    style: {
      setProperty(name, value) { styleValues.set(name, value); },
      removeProperty(name) { styleValues.delete(name); }
    },
    contains(target) { return target === cover; },
    getAttribute(name) { return name === "aria-label" ? "Ouvrir l'album V-23PI56" : ""; },
    closest(selector) { return selector.includes('data-catalog-grid="albums"') ? grid : null; }
  };
  const cover = {
    closest(selector) {
      return selector.includes('[data-catalog-grid="albums"]') ? card : null;
    }
  };
  const document = {
    body: { classList: createClassList(["home-screen"]) },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    }
  };
  const sandbox = {
    Promise,
    document,
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout
  };
  if (Array.isArray(opts.earlyRecords)) {
    sandbox.__infraEarlyAlbumSwipeProbe = {
      records: opts.earlyRecords.slice(),
      stopped: false,
      stop() { this.stopped = true; }
    };
  }
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SOURCE_PATH, "utf8"), sandbox, { filename: SOURCE_PATH });
  const catalog = sandbox.InfraHomeCatalog.createHomeCatalog({
    catalogState: {},
    openAlbumCard(target, options) {
      opened.push({ target, options });
      return true;
    },
    trackAudioRuntimeEvent(type, data) { telemetry.push({ type, data }); }
  });
  catalog.initAlbumSwipeNavigation();

  function dispatch(type, values) {
    const event = Object.assign({
      target: cover,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0,
      cancelable: true,
      defaultPrevented: false,
      immediateStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.immediateStopped = true; }
    }, values || {});
    (listeners.get(type) || []).forEach((listener) => listener(event));
    return event;
  }

  return { catalog, card, cover, opened, telemetry, styleValues, listeners, dispatch, sandbox };
}

(function testRightSwipeOpensAlbumAndSuppressesResidualClick() {
  const harness = createHarness();
  harness.dispatch("pointerdown", { clientX: 20, clientY: 100 });
  const move = harness.dispatch("pointermove", { clientX: 82, clientY: 104 });
  assert.equal(move.defaultPrevented, true, "a horizontal album swipe must own the gesture");
  assert.equal(harness.card.classList.contains("is-album-swipe-ready"), true);
  assert.equal(harness.styleValues.get("--album-swipe-x"), "62px");

  const end = harness.dispatch("pointerup", { clientX: 82, clientY: 104 });
  assert.equal(end.defaultPrevented, true);
  assert.equal(harness.opened.length, 1);
  assert.equal(harness.opened[0].target, harness.card);
  assert.equal(harness.opened[0].options.trigger, "swipe_right");
  assert.match(harness.opened[0].options.gestureToken, /^swipe-/);
  assert.equal(harness.card.classList.contains("is-album-swipe-tracking"), false);

  const click = harness.dispatch("click");
  assert.equal(click.defaultPrevented, true, "the synthetic click after swipe must not navigate twice");
  assert.equal(click.immediateStopped, true);
  const swipeEvents = harness.telemetry.filter((event) => event.type === "album_swipe");
  assert.equal(new Set(swipeEvents.map((event) => event.data.gesture_token)).size, 1);
  assert.equal(swipeEvents.at(-1).data.result, "navigation_started");
})();

(function testVerticalScrollAndLeftSwipeStayPassive() {
  const vertical = createHarness();
  vertical.dispatch("pointerdown", { clientX: 20, clientY: 100 });
  const verticalMove = vertical.dispatch("pointermove", { clientX: 25, clientY: 145 });
  vertical.dispatch("pointerup", { clientX: 90, clientY: 145 });
  assert.equal(verticalMove.defaultPrevented, false, "vertical scroll must remain native");
  assert.equal(vertical.opened.length, 0);
  assert.equal(vertical.telemetry.at(-1).data.cancel_reason, "vertical_scroll");

  const left = createHarness();
  left.dispatch("pointerdown", { clientX: 90, clientY: 100 });
  const leftMove = left.dispatch("pointermove", { clientX: 20, clientY: 102 });
  left.dispatch("pointerup", { clientX: 20, clientY: 102 });
  assert.equal(leftMove.defaultPrevented, false, "left swipe is outside the requested navigation gesture");
  assert.equal(left.opened.length, 0);
  assert.equal(left.telemetry.at(-1).data.direction, "left");
  assert.equal(left.telemetry.at(-1).data.cancel_reason, "unsupported_direction");
})();

(function testTapDoesNotConsumeSwipeTelemetryBudget() {
  const harness = createHarness();
  harness.dispatch("pointerdown", { clientX: 40, clientY: 100 });
  harness.dispatch("pointerup", { clientX: 43, clientY: 102 });
  assert.equal(harness.telemetry.length, 0, "a tap must not be counted as an album swipe");
})();

(function testEarlyColdGestureIsTransferredWithoutNavigation() {
  const harness = createHarness({
    earlyRecords: [{
      gesture_token: "early-safe-1",
      input_type: "touch",
      album: "COLD ALBUM",
      direction: "left",
      axis: "horizontal",
      dx: -80,
      dy: 5,
      card_rank: 24,
      lower_half: true,
      gesture_duration_ms: 160,
      finished_at_ms: Date.now()
    }]
  });
  const event = harness.telemetry.find((entry) => entry.data.gesture_token === "early-safe-1");
  assert(event, "cold swipe probe was not transferred to runtime telemetry");
  assert.equal(event.data.handler_ready, false);
  assert.equal(event.data.cancel_reason, "handler_not_ready");
  assert.equal(event.data.lower_half, true);
  assert.equal(harness.sandbox.__infraEarlyAlbumSwipeProbe.stopped, true);
  assert.equal(harness.opened.length, 0);
})();

(function testBindingIsIdempotent() {
  const harness = createHarness();
  const pointerDownCount = harness.listeners.get("pointerdown").length;
  harness.catalog.initAlbumSwipeNavigation();
  assert.equal(harness.listeners.get("pointerdown").length, pointerDownCount);
})();

console.log("Home album swipe checks passed: right-open, cold/left diagnostics, vertical guard and click dedupe.");
