import assert from "node:assert/strict";
import test from "node:test";
import { getPatchObjectKey } from "./patch_upload";

test("getPatchObjectKey uses the public two-level shard layout", () => {
  assert.equal(
    getPatchObjectKey(7910401, 26),
    "gerrit-patches/79/10/7910401.26.patch.diff",
  );
});

test("getPatchObjectKey pads short change numbers before sharding", () => {
  assert.equal(
    getPatchObjectKey(123, 4),
    "gerrit-patches/01/23/123.4.patch.diff",
  );
});
