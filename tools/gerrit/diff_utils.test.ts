import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { extractDiffFilePaths, getPatchCacheAbsolutePath, getPatchCacheRelativePath } from "./diff_utils";

test("patch cache paths remain database-compatible and resolve beside the tool", () => {
  const relativePath = getPatchCacheRelativePath(7910401, 3);
  assert.equal(relativePath, "tools/gerrit/cache/patches/79/7910401.3.patch.diff");
  assert.equal(
    getPatchCacheAbsolutePath(relativePath),
    path.join(__dirname, "cache", "patches", "79", "7910401.3.patch.diff"),
  );
});

test("extractDiffFilePaths indexes both rename paths", () => {
  const diff = [
    "diff --git a/old/location/file.cc b/new/location/file.cc",
    "similarity index 100%",
    "rename from old/location/file.cc",
    "rename to new/location/file.cc",
  ].join("\n");

  assert.deepEqual(extractDiffFilePaths(diff), [
    "old/location/file.cc",
    "new/location/file.cc",
  ]);
});

test("extractDiffFilePaths indexes both copy paths", () => {
  const diff = [
    "diff --git a/source/file.cc b/copied/file.cc",
    "similarity index 100%",
    "copy from source/file.cc",
    "copy to copied/file.cc",
  ].join("\n");

  assert.deepEqual(extractDiffFilePaths(diff), [
    "source/file.cc",
    "copied/file.cc",
  ]);
});

test("extractDiffFilePaths retains the old path for deleted files", () => {
  const diff = [
    "diff --git a/deleted/file.cc b/deleted/file.cc",
    "deleted file mode 100644",
    "--- a/deleted/file.cc",
    "+++ /dev/null",
  ].join("\n");

  assert.deepEqual(extractDiffFilePaths(diff), ["deleted/file.cc"]);
});
