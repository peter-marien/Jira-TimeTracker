import test from "node:test";
import assert from "node:assert/strict";

import { appendTagMarkers, parseTagMarkers, validateTagName } from "./tags.ts";

test("extracts tag markers and removes them from imported notes", () => {
    assert.deepEqual(
        parseTagMarkers("Worked on reports #[[client]] #[[billable]]"),
        { notes: "Worked on reports", tagNames: ["client", "billable"] }
    );
});

test("deduplicates imported tag names case-insensitively", () => {
    assert.deepEqual(parseTagMarkers("#[[Focus]] #[[focus]]").tagNames, ["Focus"]);
});

test("preserves unrelated note spacing and invalid markers", () => {
    assert.equal(parseTagMarkers("Keep  spacing #[[]]").notes, "Keep  spacing #[[]]");
});

test("appends markers individually separated by whitespace", () => {
    assert.equal(appendTagMarkers("Investigation", ["support", "urgent"]), "Investigation #[[support]] #[[urgent]]");
});

test("rejects names containing marker delimiters", () => {
    assert.ok(validateTagName("bad #[[ name"));
    assert.ok(validateTagName("bad ]] name"));
});
