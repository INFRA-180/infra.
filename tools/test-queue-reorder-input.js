#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const transport = fs.readFileSync(path.join(root, "public/assets/js/transport-ui.js"), "utf8");
const nowPlaying = fs.readFileSync(path.join(root, "public/assets/js/now-playing.js"), "utf8");
const audioCore = fs.readFileSync(path.join(root, "public/assets/js/audio-core.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");

function includes(source, fragment, message) {
  assert(source.includes(fragment), message);
}

includes(transport, "const QUEUE_PRESS_HOLD_MS = 420", "touch reorder needs a bounded hold delay");
includes(transport, "const QUEUE_PRESS_MOVE_TOLERANCE_PX = 12", "scroll intent must cancel a pending hold");
includes(transport, 'overlayQueueList.addEventListener("touchstart"', "touch reorder has no start handler");
includes(transport, 'overlayQueueList.addEventListener("touchmove"', "touch reorder has no move handler");
includes(transport, 'overlayQueueList.addEventListener("touchend"', "touch reorder has no commit handler");
includes(transport, 'overlayQueueList.addEventListener("touchcancel"', "touch reorder has no cancellation handler");
includes(transport, '}, { passive: false });', "active touch moves must be able to suppress page scrolling");
includes(transport, 'event.pointerType !== "pen"', "pen input must keep a pointer-event path");
includes(transport, 'overlayQueueList.addEventListener("dragstart"', "desktop HTML drag support regressed");
includes(transport, 'trackAudioRuntimeEvent("queue_reorder"', "queue gestures are not correlated in telemetry");
includes(transport, "queueTelemetryToken", "queue telemetry has no per-gesture token");
includes(transport, 'input_type: gesture.input === "pointer" ? "pen"', "queue telemetry does not distinguish touch, pen and mouse");
includes(transport, "ghost_created_ms", "queue telemetry does not expose ghost creation");
includes(transport, "flip_started: false", "the pre-FLIP baseline is not measurable");
includes(transport, "runQueueAutoScroll", "long queues need edge auto-scroll while reordering");
includes(transport, "movePlaylistItem(fromIndex, drop.index, { after: drop.after })", "touch drop does not reach the queue engine");
includes(transport, 'item.classList.contains("is-current")', "the playing track must stay fixed");

includes(nowPlaying, "item.draggable = true", "future tracks must remain draggable on desktop");
includes(nowPlaying, "Glisser ou maintenir appuyé pour réordonner À suivre", "the input hint does not describe touch reorder");
includes(audioCore, "if (currentIndex >= 0 && from <= currentIndex) return false", "the engine no longer protects the playing prefix");
includes(styles, ".now-playing-up-next-list.is-pointer-reordering", "active touch reorder does not lock the queue surface");
includes(styles, ".now-playing-queue-drag-ghost", "touch reorder has no moving visual proxy");
includes(styles, ".now-playing-queue-drag-ghost {\n  position: fixed;\n  z-index: 10021", "the touch proxy is rendered behind the fullscreen player");
includes(styles, "@keyframes now-playing-queue-pickup", "the touch proxy has no pickup animation");
includes(styles, "translateY(-3px) scale(1.015)", "the touch proxy no longer lifts subtly from the queue");
includes(styles, ".now-playing-queue-drag-ghost {\n    animation: none;", "reduced-motion users cannot disable the pickup animation");
includes(styles, "-webkit-touch-callout: none", "iOS callout can still steal the long press");

console.log("Queue reorder input checks passed: desktop drag, touch hold, pen, auto-scroll and current-track guard.");
