import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTimeSliceBoundary, roundTimeSliceBoundaries } from "./time-utils.ts";

test("normalizes saved time slice boundaries to whole minutes", () => {
    const normalized = normalizeTimeSliceBoundary("2026-05-26T10:15:42.987+02:00");

    assert.ok(normalized);
    assert.equal(new Date(normalized).toISOString(), "2026-05-26T08:15:00.000Z");
});

test("keeps null boundaries null", () => {
    assert.equal(normalizeTimeSliceBoundary(null), null);
});

test("rounds time slice boundaries to the selected interval", () => {
    const rounded = roundTimeSliceBoundaries({
        id: 7,
        work_item_id: 12,
        start_time: "2026-05-26T10:08:42.987+02:00",
        end_time: "2026-05-26T10:52:10.000+02:00",
    }, 15);

    assert.equal(new Date(rounded.start_time).toISOString(), "2026-05-26T08:15:00.000Z");
    assert.equal(new Date(rounded.end_time).toISOString(), "2026-05-26T08:45:00.000Z");
    assert.equal(rounded.id, 7);
});

test("leaves open-ended time slices open while rounding the start", () => {
    const rounded = roundTimeSliceBoundaries({
        start_time: "2026-05-26T10:08:42.987+02:00",
        end_time: null,
    }, 15);

    assert.equal(new Date(rounded.start_time).toISOString(), "2026-05-26T08:15:00.000Z");
    assert.equal(rounded.end_time, null);
});
