import assert from "node:assert/strict";
import test from "node:test";
import { formatUploadError, getPatchObjectKey } from "./patch_upload";

test("upload errors retain network failures inside an empty AggregateError", () => {
  const cause = Object.assign(new Error("connect failed"), {
    code: "ETIMEDOUT", syscall: "connect", address: "192.0.2.1", port: 443,
  });
  const message = formatUploadError(new AggregateError([cause], ""), "");
  assert.match(message, /AggregateError/);
  assert.match(message, /code=ETIMEDOUT/);
  assert.match(message, /syscall=connect address=192\.0\.2\.1 port=443/);
});

test("upload diagnostics redact the secret, follow causes and fit the SQL field", () => {
  const error = new Error("outer", { cause: new Error("test-secret\nTLS failure") });
  const message = formatUploadError(error, "test-secret");
  assert.match(message, /cause=\[Error \[REDACTED\] TLS failure\]/);
  assert.ok(!message.includes("test-secret"));
  assert.equal(formatUploadError(new Error("x".repeat(3000)), "").length, 2000);
  assert.equal(formatUploadError(new Error(""), ""), "Error");
});

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
