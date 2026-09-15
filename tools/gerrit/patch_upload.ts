import crypto from "node:crypto";
import https from "node:https";
import tls from "node:tls";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sql from "mssql";

export type PatchUploadItem = {
  gerritChangeId: number;
  revisionNumber: number;
  patchSha256: string;
  body: Buffer;
};

export type PatchUploadResult = {
  GerritChangeID: number;
  RevisionNumber: number;
  ObjectKey: string | null;
  Uploaded: boolean;
  Error: string | null;
};

type UploadConfig = {
  endpoint: URL;
  secret: string;
  ca?: string[];
  timeoutMs: number;
  retryCount: number;
};

const DEFAULT_UPLOAD_URL = "https://www.cromite.org/api/gerrit-patches.php";
const DEFAULT_CA_PATH = path.join(
  __dirname, "api", "certificates",
  "actalis-domain-validation-server-ca-g3.pem",
);

export function getPatchObjectKey(changeId: number, revision: number): string {
  const padded = String(changeId).padStart(4, "0");
  return `gerrit-patches/${padded.slice(0, 2)}/${padded.slice(2, 4)}/${changeId}.${revision}.patch.diff`;
}

export async function loadUploadConfig(required = false): Promise<UploadConfig | null> {
  const secret = process.env.GERRIT_PATCH_UPLOAD_SECRET;
  if (!secret) {
    if (required) throw new Error("Missing required environment variable: GERRIT_PATCH_UPLOAD_SECRET");
    return null;
  }
  const endpoint = new URL(process.env.GERRIT_PATCH_UPLOAD_URL ?? DEFAULT_UPLOAD_URL);
  if (endpoint.protocol !== "https:") throw new Error("GERRIT_PATCH_UPLOAD_URL must use HTTPS");
  const caPath = process.env.GERRIT_PATCH_UPLOAD_CA_PATH
    ? path.resolve(__dirname, process.env.GERRIT_PATCH_UPLOAD_CA_PATH)
    : DEFAULT_CA_PATH;
  return {
    endpoint,
    secret,
    ca: endpoint.hostname.toLowerCase() === "www.cromite.org"
      ? [...tls.rootCertificates, await readFile(caPath, "utf8")]
      : undefined,
    timeoutMs: Number(process.env.GERRIT_PATCH_UPLOAD_TIMEOUT_MS ?? "60000"),
    retryCount: Number(process.env.GERRIT_PATCH_UPLOAD_RETRY_COUNT ?? "3"),
  };
}

function putOnce(config: UploadConfig, item: PatchUploadItem): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac("sha256", config.secret).update([
    "PUT", String(item.gerritChangeId), String(item.revisionNumber), timestamp,
    item.patchSha256,
  ].join("\n")).digest("hex");
  const url = new URL(config.endpoint);
  url.searchParams.set("change", String(item.gerritChangeId));
  url.searchParams.set("revision", String(item.revisionNumber));

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "PUT",
      ca: config.ca,
      rejectUnauthorized: true,
      servername: url.hostname,
      timeout: config.timeoutMs,
      headers: {
        "Content-Type": "text/x-diff",
        "Content-Length": item.body.length,
        "X-Timestamp": timestamp,
        "X-Patch-SHA256": item.patchSha256,
        "X-Signature": signature,
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        if (response.statusCode === 201 || response.statusCode === 204) return resolve();
        reject(new Error(`Patch upload HTTP ${response.statusCode}: ${Buffer.concat(chunks).toString("utf8").slice(0, 1000)}`));
      });
    });
    request.on("timeout", () => request.destroy(new Error(`Patch upload timed out after ${config.timeoutMs}ms`)));
    request.on("error", reject);
    request.end(item.body);
  });
}

export async function uploadPatch(
  config: UploadConfig,
  item: PatchUploadItem,
  log?: (message: string) => void,
): Promise<PatchUploadResult> {
  const actualHash = crypto.createHash("sha256").update(item.body).digest("hex");
  if (actualHash !== item.patchSha256) {
    return { GerritChangeID: item.gerritChangeId, RevisionNumber: item.revisionNumber, ObjectKey: null, Uploaded: false, Error: `SHA-256 mismatch: expected ${item.patchSha256}, got ${actualHash}` };
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= config.retryCount; attempt += 1) {
    try {
      log?.(`change=${item.gerritChangeId} revision=${item.revisionNumber} upload attempt=${attempt}/${config.retryCount} started.`);
      await putOnce(config, item);
      log?.(`change=${item.gerritChangeId} revision=${item.revisionNumber} upload attempt=${attempt}/${config.retryCount} succeeded.`);
      return { GerritChangeID: item.gerritChangeId, RevisionNumber: item.revisionNumber, ObjectKey: getPatchObjectKey(item.gerritChangeId, item.revisionNumber), Uploaded: true, Error: null };
    } catch (error) {
      lastError = error;
      log?.(`change=${item.gerritChangeId} revision=${item.revisionNumber} upload attempt=${attempt}/${config.retryCount} failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < config.retryCount) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  return { GerritChangeID: item.gerritChangeId, RevisionNumber: item.revisionNumber, ObjectKey: null, Uploaded: false, Error: lastError instanceof Error ? lastError.message : String(lastError) };
}

export class ConcurrentPatchUploader {
  private readonly active = new Set<Promise<void>>();
  private readonly results: PatchUploadResult[] = [];

  constructor(
    private readonly config: UploadConfig,
    private readonly concurrency: number,
    private readonly log?: (message: string) => void,
    private readonly onResult?: (result: PatchUploadResult) => Promise<void>,
  ) {
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new Error("Patch upload concurrency must be a positive integer");
    }
  }

  async enqueue(item: PatchUploadItem): Promise<void> {
    while (this.active.size >= this.concurrency) await Promise.race(this.active);
    let task: Promise<void>;
    task = uploadPatch(this.config, item, this.log)
      .then(async (result) => {
        this.results.push(result);
        try {
          await this.onResult?.(result);
        } catch (error) {
          this.log?.(`change=${result.GerritChangeID} revision=${result.RevisionNumber} immediate result persistence failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
      .finally(() => { this.active.delete(task); });
    this.active.add(task);
  }

  async drain(): Promise<PatchUploadResult[]> {
    await Promise.all(this.active);
    return this.results.splice(0);
  }
}

export async function persistUploadResults(db: sql.ConnectionPool, results: PatchUploadResult[]): Promise<void> {
  if (results.length === 0) return;
  const deduplicated = new Map<string, PatchUploadResult>();
  for (const result of results) {
    const key = `${result.GerritChangeID}:${result.RevisionNumber}`;
    const previous = deduplicated.get(key);
    if (!previous?.Uploaded || result.Uploaded) deduplicated.set(key, result);
  }
  await db.request().input("ResultsJson", sql.NVarChar(sql.MAX), JSON.stringify([...deduplicated.values()])).query(`
    UPDATE patch
    SET [PatchObjectKey] = CASE WHEN source.[Uploaded] = 1 THEN source.[ObjectKey] ELSE patch.[PatchObjectKey] END,
        [PatchUploadedAt] = CASE WHEN source.[Uploaded] = 1 THEN COALESCE(patch.[PatchUploadedAt], SYSUTCDATETIME()) ELSE patch.[PatchUploadedAt] END,
        [PatchUploadError] = source.[Error]
    FROM [dbo].[GerritPatch] patch
    INNER JOIN OPENJSON(@ResultsJson) WITH (
      [GerritChangeID] bigint '$.GerritChangeID', [RevisionNumber] int '$.RevisionNumber',
      [ObjectKey] varchar(512) '$.ObjectKey', [Uploaded] bit '$.Uploaded', [Error] nvarchar(2000) '$.Error'
    ) source ON source.[GerritChangeID] = patch.[GerritChangeID]
            AND source.[RevisionNumber] = patch.[RevisionNumber];
  `);
}
