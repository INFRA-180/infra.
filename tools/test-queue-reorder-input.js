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
includes(transport, "const QUEUE_FLIP_DURATION_MS = 170", "queue FLIP duration is not the approved 170 ms");
includes(transport, 'const QUEUE_FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"', "queue FLIP easing regressed");
includes(transport, "animateQueuePreview", "intermediate rows are not animated while dragging");
includes(transport, "animateQueueFinalFlip", "the final rerender has no FLIP reconciliation");
includes(transport, "hideCommittedQueueSource", "the rerendered source can appear below the ghost");
includes(transport, "finishQueueReorderVisuals", "ghost and source visibility are not finalized together");
includes(transport, "queueFinalizingGesture", "native dragend can interrupt the final FLIP cleanup");
includes(transport, "captureQueueBaseGeometry", "queue hit testing needs immutable activation geometry");
includes(transport, "baseScrollTop", "queue hit testing must compensate list scrolling");
includes(transport, "Math.abs(clientY - resolved.midpoint) < 10", "queue targets need midpoint hysteresis");
includes(transport, "row.getAnimations()", "preview telemetry is not based on real CSS transition completion");
includes(transport, "Promise.all(animations)", "final FLIP telemetry is not based on real animation completion");
includes(transport, "flip_animation_count", "queue telemetry does not count real animations");
includes(transport, "preview_target_change_count", "queue telemetry does not expose actual target changes");
includes(transport, "preview_animation_restart_count", "queue telemetry does not prove preview restarts are gone");
includes(transport, "layout_hit_test", "queue telemetry does not prove stable layout hit testing");
includes(transport, "lift_finished", "queue telemetry does not record pickup completion");
includes(transport, "runQueueAutoScroll", "long queues need edge auto-scroll while reordering");
includes(transport, "movePlaylistItem(fromIndex, drop.index, { after: drop.after })", "touch drop does not reach the queue engine");
includes(transport, 'item.classList.contains("is-current")', "the playing track must stay fixed");

includes(nowPlaying, "item.draggable = true", "future tracks must remain draggable on desktop");
includes(nowPlaying, 'data-now-playing-queue-key', "queue rows lack stable track-occurrence keys");
includes(nowPlaying, "Glisser ou maintenir appuyé pour réordonner À suivre", "the input hint does not describe touch reorder");
includes(audioCore, "if (currentIndex >= 0 && from <= currentIndex) return false", "the engine no longer protects the playing prefix");
includes(styles, ".now-playing-up-next-list.is-pointer-reordering", "active touch reorder does not lock the queue surface");
includes(styles, ".now-playing-queue-drag-ghost", "touch reorder has no moving visual proxy");
includes(styles, ".now-playing-queue-drag-ghost {\n  position: fixed;\n  z-index: 10021", "the touch proxy is rendered behind the fullscreen player");
includes(styles, "@keyframes now-playing-queue-pickup", "the touch proxy has no pickup animation");
includes(styles, "translateY(-3px) scale(1.015)", "the touch proxy no longer lifts subtly from the queue");
includes(styles, ".now-playing-up-next-item.is-dragging {\n  opacity: 0;", "the source row must be hidden while the ghost is visible");
includes(styles, ".now-playing-queue-drag-ghost {\n    animation: none;", "reduced-motion users cannot disable the pickup animation");
includes(styles, "-webkit-touch-callout: none", "iOS callout can still steal the long press");

const previewStart = transport.indexOf("function animateQueuePreview");
const previewEnd = transport.indexOf("function animateQueueFinalFlip", previewStart);
const previewBody = transport.slice(previewStart, previewEnd);
assert(!previewBody.includes("row.animate("), "preview rows must not restart WAAPI animations");
assert(!previewBody.includes('fill: "both"'), "preview rows must not retain filled animation effects");

const touchCommitStart = transport.indexOf("function finishQueuePress");
const touchCommitEnd = transport.indexOf("function findTouch", touchCommitStart);
const touchCommitBody = transport.slice(touchCommitStart, touchCommitEnd);
assert(
  touchCommitBody.indexOf("animateQueueFinalFlip(gesture, beforeRects).then") <
    touchCommitBody.indexOf("finishQueueReorderVisuals(gesture, { suppressClick: true })"),
  "touch cleanup must wait for the final FLIP promise"
);

console.log("Queue reorder input checks passed: desktop drag, touch hold, pen, auto-scroll and current-track guard.");
