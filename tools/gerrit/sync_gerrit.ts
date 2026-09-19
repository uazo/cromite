import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import sql from "mssql";
import {
  diffCacheExists,
  extractDiffFilePaths,
  getPatchCacheRelativePath,
  getPatchCacheAbsolutePath,
  isPatchCacheRelativePath,
  parseDiff,
  readDiffCache,
  type ParsedDiff,
  writeDiffCache,
} from "./diff_utils";
import {
  ConcurrentPatchUploader,
  loadUploadConfig,
  persistUploadResults,
} from "./patch_upload";

type SqlConfig = sql.config;
type SqlExecutor = sql.ConnectionPool | sql.Transaction;

type GerritAccount = {
  _account_id?: number;
  name?: string;
  email?: string;
};

type GerritChange = {
  _number: number;
  change_id: string;
  project: string;
  branch: string;
  full_branch?: string;
  status: string;
  subject: string;
  owner?: GerritAccount;
  created: string;
  updated: string;
  submitted?: string;
  submit_type?: string;
  current_revision_number?: number;
  insertions?: number;
  deletions?: number;
  total_comment_count?: number;
  unresolved_comment_count?: number;
  work_in_progress?: boolean;
  has_review_started?: boolean;
  _more_changes?: boolean;
};

type GerritCommit = {
  commit?: string;
  message?: string;
};

type SyncOptions = {
  pageSize: number;
  maxPages: number;
  optionBits: number;
  baseUrl: string;
  initialMergeAfter: Date | null;
  fetchRetryCount: number;
  fetchRetryDelayMs: number;
  changeId: string | null;
};

type SyncStateRow = {
  SyncName: string;
  Active: boolean;
  MergeAfter: Date | null;
  MergeBefore: Date | null;
  LastUpdatedAt: Date | null;
  LastChangeNumber: number | null;
  LastSyncedAt: Date | null;
  LastStatus: string | null;
  LastError: string | null;
};

type SyncWindow = {
  syncName: string;
  query: string;
  mergeAfter: Date | null;
  mergeBefore: Date | null;
};

type SyncTargetResult = {
  changes: GerritChange[];
  fetchedPatches: number;
  pendingPatches: number;
  truncated: boolean;
};

type PendingPatch = {
  GerritPatchID: number;
  GerritChangeID: number;
  ChangeID: string;
  RevisionNumber: number;
  PatchCachePath: string | null;
  Insertions: number;
};

type PendingFileNamePatch = {
  GerritPatchID: number;
  GerritChangeID: number;
  RevisionNumber: number;
  PatchSha256: string;
  ChangeID: string;
  PatchCachePath: string;
};
type ChangeProcessingState = {
  exists: boolean;
  existingGerritChangeID: number | null;
  hasOpenPending409: boolean;
  hasLargeDiffPending: boolean;
  hasIndexedPatch: boolean;
  patchCachePath: string | null;
};

const LARGE_DIFF_INSERTIONS_THRESHOLD = 1000;
const LARGE_DIFF_PENDING_REASON = "patch_disabled_large_insertions";
const GERRIT_START_SPLIT_THRESHOLD = 10000;
const MERGED_WINDOW_SPLIT_OVERLAP_MS = 1000;
let patchUploader: ConcurrentPatchUploader | null = null;

function logInfo(message: string): void {
  console.log(`[gerrit-sync] ${message}`);
}

function formatChangeLogPrefix(
  syncName: string,
  change: GerritChange,
  current: number,
  total: number,
): string {
  return `[${syncName}][${change.change_id}][${current}/${total}]`;
}

function formatDeferredPatchLogPrefix(
  patch: PendingPatch,
  current: number,
  total: number,
): string {
  return `[deferred][${patch.ChangeID}][${current}/${total}]`;
}

function withEffectiveGerritChangeID(
  change: GerritChange,
  effectiveGerritChangeID: number | null,
): GerritChange {
  return effectiveGerritChangeID && effectiveGerritChangeID !== change._number
    ? { ...change, _number: effectiveGerritChangeID }
    : change;
}

function formatDuration(startedAt: number): string {
  return `${Date.now() - startedAt}ms`;
}

function buildMergedQuery(mergeAfter: Date, mergeBefore: Date): string {
  return `status:merged mergedafter:"${formatGerritQueryDate(mergeAfter)}" mergedbefore:"${formatGerritQueryDate(mergeBefore)}"`;
}

function clampVarChar(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
}

function normalizeBugToken(rawToken: string): string | null {
  const token = rawToken.trim();
  if (!token || /^none$/i.test(token)) {
    return null;
  }

  const buganizerMatch = /^b[:/](\d+)$/i.exec(token);
  if (buganizerMatch) {
    return `b/${buganizerMatch[1]}`;
  }

  const chromiumProjectMatch = /^chromium:(\d+)$/i.exec(token);
  if (chromiumProjectMatch) {
    return `chromium:${chromiumProjectMatch[1]}`;
  }

  const crbugMatch = /^(?:https?:\/\/)?crbug\.com\/(\d+)$/i.exec(token);
  if (crbugMatch) {
    return `chromium:${crbugMatch[1]}`;
  }

  const numericMatch = /^(\d+)$/i.exec(token);
  if (numericMatch) {
    return `chromium:${numericMatch[1]}`;
  }

  return token;
}

function extractBugIdsFromCommitMessage(commitMessage: string | null): string[] {
  if (!commitMessage) {
    return [];
  }

  const bugLine = commitMessage
    .split(/\r?\n/)
    .find((line) => /^Bug:\s*/i.test(line));
  if (!bugLine) {
    return [];
  }

  const rawValue = bugLine.replace(/^Bug:\s*/i, "").trim();
  if (!rawValue || /^none$/i.test(rawValue)) {
    return [];
  }

  const bugIds = rawValue
    .split(",")
    .map((token) => normalizeBugToken(token))
    .filter((token): token is string => Boolean(token));

  return Array.from(new Set(bugIds));
}

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSqlConfig(): SqlConfig {
  return {
    server: getRequiredEnv("SQLSERVER_HOST"),
    port: Number(process.env.SQLSERVER_PORT ?? "1433"),
    database: getRequiredEnv("SQLSERVER_DATABASE"),
    user: getRequiredEnv("SQLSERVER_USER"),
    password: getRequiredEnv("SQLSERVER_PASSWORD"),
    options: {
      encrypt: (process.env.SQLSERVER_ENCRYPT ?? "true") === "true",
      trustServerCertificate:
        (process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE ?? "false") === "true",
    },
    pool: {
      max: Number(process.env.SQLSERVER_POOL_MAX ?? "10"),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function getSyncOptions(): SyncOptions {
  return {
    pageSize: Number(getArg("page-size") ?? process.env.GERRIT_PAGE_SIZE ?? "100"),
    maxPages: Number(getArg("max-pages") ?? process.env.GERRIT_MAX_PAGES ?? "0"),
    optionBits: Number(getArg("options") ?? process.env.GERRIT_OPTIONS ?? "81"),
    baseUrl:
      getArg("base-url") ??
      process.env.GERRIT_BASE_URL ??
      "https://chromium-review.googlesource.com",
    initialMergeAfter: process.env.GERRIT_INITIAL_MERGE_AFTER
      ? new Date(process.env.GERRIT_INITIAL_MERGE_AFTER)
      : null,
    fetchRetryCount: Number(
      getArg("fetch-retry-count") ?? process.env.GERRIT_FETCH_RETRY_COUNT ?? "15",
    ),
    fetchRetryDelayMs: Number(
      getArg("fetch-retry-delay-ms") ?? process.env.GERRIT_FETCH_RETRY_DELAY_MS ?? "1500",
    ),
    changeId: getArg("change-id"),
  };
}

function formatGerritQueryDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  const seconds = String(value.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getDefaultInitialMergeAfter(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function buildMergedQueryWindow(
  options: SyncOptions,
  syncState: SyncStateRow,
  now: Date,
): SyncWindow {
  const mergeAfter =
    syncState?.LastStatus === "success" && syncState.MergeBefore
      ? syncState.MergeBefore
      : syncState?.MergeAfter ?? options.initialMergeAfter ?? getDefaultInitialMergeAfter();
  const mergeBefore = now;

  return {
    syncName: syncState.SyncName,
    query: buildMergedQuery(mergeAfter, mergeBefore),
    mergeAfter,
    mergeBefore,
  };
}

function buildOpenQueryWindow(syncState: SyncStateRow): SyncWindow {
  return {
    syncName: syncState.SyncName,
    query: "status:open",
    mergeAfter: null,
    mergeBefore: null,
  };
}

function shouldRunSyncTarget(syncState: SyncStateRow, now: Date): boolean {
  if (syncState.SyncName === "merged_changes") {
    return true;
  }
  if (syncState.SyncName === "open_changes") {
    if (!syncState.LastSyncedAt) {
      return true;
    }
    return now.getTime() - syncState.LastSyncedAt.getTime() >= 60 * 60 * 1000;
  }
  return true;
}

function buildSyncWindow(
  options: SyncOptions,
  syncState: SyncStateRow,
  now: Date,
): SyncWindow {
  if (syncState.SyncName === "merged_changes") {
    return buildMergedQueryWindow(options, syncState, now);
  }
  if (syncState.SyncName === "open_changes") {
    return buildOpenQueryWindow(syncState);
  }
  return {
    syncName: syncState.SyncName,
    query: "status:open",
    mergeAfter: syncState.MergeAfter,
    mergeBefore: syncState.MergeBefore,
  };
}

function stripXssiPrefix(body: string): string {
  return body.replace(/^\)\]\}'\s*/, "");
}

function parseGerritDate(value: string): Date {
  const normalized = value.replace(" ", "T").replace(/\.\d+$/, "Z");
  return new Date(normalized);
}

function getErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = (cause as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

function isIgnorableRollbackError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: unknown }).code;
  return code === "EABORT" || code === "ENOTBEGUN";
}

async function safeRollback(transaction: sql.Transaction, label: string): Promise<void> {
  try {
    await transaction.rollback();
  } catch (error) {
    if (isIgnorableRollbackError(error)) {
      logInfo(
        `[rollback][${label}] Ignoring rollback error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    throw error;
  }
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableFetchError(error: unknown): boolean {
  const status = getHttpStatusFromError(error);
  if (status !== null) {
    return isRetryableHttpStatus(status);
  }

  const code = getErrorCode(error);
  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN"
  );
}

function dedupeChanges(changes: GerritChange[]): GerritChange[] {
  const seen = new Set<number>();
  const deduped: GerritChange[] = [];
  for (const change of changes) {
    if (seen.has(change._number)) {
      continue;
    }
    seen.add(change._number);
    deduped.push(change);
  }
  return deduped;
}

function canSplitMergedWindow(syncWindow: SyncWindow): boolean {
  return (
    syncWindow.syncName === "merged_changes" &&
    syncWindow.mergeAfter instanceof Date &&
    syncWindow.mergeBefore instanceof Date &&
    syncWindow.mergeBefore.getTime() - syncWindow.mergeAfter.getTime() > MERGED_WINDOW_SPLIT_OVERLAP_MS
  );
}

function splitMergedSyncWindow(syncWindow: SyncWindow): [SyncWindow, SyncWindow] {
  if (!canSplitMergedWindow(syncWindow) || !syncWindow.mergeAfter || !syncWindow.mergeBefore) {
    throw new Error(`Cannot split Gerrit merged window: ${syncWindow.query}`);
  }

  const afterMs = syncWindow.mergeAfter.getTime();
  const beforeMs = syncWindow.mergeBefore.getTime();
  const midpointMs = Math.floor((afterMs + beforeMs) / 2);
  if (midpointMs <= afterMs || midpointMs >= beforeMs) {
    throw new Error(`Merged window too small to split safely: ${syncWindow.query}`);
  }

  const midpoint = new Date(midpointMs);
  const secondAfter = new Date(Math.max(afterMs, midpointMs - MERGED_WINDOW_SPLIT_OVERLAP_MS));

  const firstWindow: SyncWindow = {
    syncName: syncWindow.syncName,
    mergeAfter: syncWindow.mergeAfter,
    mergeBefore: midpoint,
    query: buildMergedQuery(syncWindow.mergeAfter, midpoint),
  };
  const secondWindow: SyncWindow = {
    syncName: syncWindow.syncName,
    mergeAfter: secondAfter,
    mergeBefore: syncWindow.mergeBefore,
    query: buildMergedQuery(secondAfter, syncWindow.mergeBefore),
  };

  return [firstWindow, secondWindow];
}

async function fetchText(options: SyncOptions, url: string, label: string): Promise<string> {
  const maxAttempts = Math.max(1, options.fetchRetryCount);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json,text/plain,*/*",
        },
      });
      if (!response.ok) {
        throw new Error(`Gerrit request failed ${response.status}: ${url}`);
      }
      return response.text();
    } catch (error) {
      const retryable = isRetryableFetchError(error);
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }

      const waitMs = Math.max(0, options.fetchRetryDelayMs) * attempt;
      const code = getErrorCode(error) ?? "no_code";
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
      logInfo(
        `[fetch-retry][${label}] attempt ${attempt}/${maxAttempts} failed (${code}): ${message}. Waiting ${waitMs}ms before retry.`,
      );
      await delay(waitMs);
    }
  }

  throw new Error(`Unreachable fetch retry state for ${label}: ${url}`);
}

function getHttpStatusFromError(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const match = /Gerrit request failed (\d+):/.exec(error.message);
  return match ? Number(match[1]) : null;
}

async function fetchChanges(
  options: SyncOptions,
  query: string,
  start: number,
): Promise<GerritChange[]> {
  const url = new URL("/changes/", options.baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("n", String(options.pageSize));
  url.searchParams.set("O", String(options.optionBits));
  if (start > 0) {
    url.searchParams.set("S", String(start));
  }

  const body = await fetchText(options, url.toString(), `changes start=${start}`);
  return JSON.parse(stripXssiPrefix(body)) as GerritChange[];
}

async function fetchPatchBase64(options: SyncOptions, changeNumber: number, revision: number | "current" = "current"): Promise<string> {
  const url = new URL(
    `/changes/${encodeURIComponent(String(changeNumber))}/revisions/${revision}/patch`,
    options.baseUrl,
  );
  return (await fetchText(options, url.toString(), `patch change=${changeNumber}`)).replace(
    /\s+/g,
    "",
  );
}

async function fetchCommitMetadata(
  options: SyncOptions,
  changeNumber: number,
): Promise<GerritCommit> {
  const url = new URL(
    `/changes/${encodeURIComponent(String(changeNumber))}/revisions/current/commit`,
    options.baseUrl,
  );
  const body = await fetchText(options, url.toString(), `commit change=${changeNumber}`);
  return JSON.parse(stripXssiPrefix(body)) as GerritCommit;
}

function decodePatch(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf8");
}

function shouldSkipPatchFetch(change: GerritChange): boolean {
  return change.subject.startsWith("Roll ");
}

async function getChangeProcessingState(
  db: SqlExecutor,
  change: GerritChange,
): Promise<ChangeProcessingState> {
  const result = await db
    .request()
    .input("GerritChangeID", sql.BigInt, change._number)
    .input("ChangeID", sql.VarChar(128), change.change_id)
    .input("RevisionNumber", sql.Int, change.current_revision_number ?? null)
    .query<{
      existing_gerrit_change_id: number | null;
      exists_count: number;
      has_open_pending_409: number;
      has_large_diff_pending: number;
      has_indexed_patch: number;
      patch_cache_path: string | null;
    }>(`
      SELECT
        (
          SELECT TOP 1 [GerritChangeID]
          FROM [dbo].[GerritChange]
          WHERE [GerritChangeID] = @GerritChangeID
             OR [ChangeID] = @ChangeID
          ORDER BY CASE WHEN [GerritChangeID] = @GerritChangeID THEN 0 ELSE 1 END
        ) AS [existing_gerrit_change_id],
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM [dbo].[GerritChange]
            WHERE [GerritChangeID] = @GerritChangeID
               OR [ChangeID] = @ChangeID
          ) THEN 1 ELSE 0
        END AS [exists_count],
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM [dbo].[GerritPendingPatch]
            WHERE [GerritChangeID] = @GerritChangeID
              AND ISNULL([RevisionNumber], -1) = ISNULL(@RevisionNumber, -1)
              AND [Reason] = 'patch_fetch_409'
              AND [ResolvedAt] IS NULL
          ) THEN 1 ELSE 0
        END AS [has_open_pending_409],
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM [dbo].[GerritPendingPatch]
            WHERE [GerritChangeID] = @GerritChangeID
              AND ISNULL([RevisionNumber], -1) = ISNULL(@RevisionNumber, -1)
              AND [Reason] = '${LARGE_DIFF_PENDING_REASON}'
              AND [ResolvedAt] IS NULL
          ) THEN 1 ELSE 0
        END AS [has_large_diff_pending],
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM [dbo].[GerritPatch]
            WHERE [GerritChangeID] = @GerritChangeID
              AND [RevisionNumber] = ISNULL(@RevisionNumber, [RevisionNumber])
              AND [ParsedAt] IS NOT NULL
          ) THEN 1 ELSE 0
        END AS [has_indexed_patch],
        (
          SELECT TOP 1 [PatchCachePath]
          FROM [dbo].[GerritPatch]
          WHERE [GerritChangeID] = @GerritChangeID
            AND [RevisionNumber] = ISNULL(@RevisionNumber, [RevisionNumber])
          ORDER BY [GerritPatchID] DESC
        ) AS [patch_cache_path]
    `);

  const row = result.recordset[0];
  return {
    existingGerritChangeID: row?.existing_gerrit_change_id ?? null,
    exists: (row?.exists_count ?? 0) > 0,
    hasOpenPending409: (row?.has_open_pending_409 ?? 0) > 0,
    hasLargeDiffPending: (row?.has_large_diff_pending ?? 0) > 0,
    hasIndexedPatch: (row?.has_indexed_patch ?? 0) > 0,
    patchCachePath: row?.patch_cache_path ?? null,
  };
}

async function upsertChange(db: SqlExecutor, change: GerritChange): Promise<void> {
  const request = db.request();
  request.input("GerritChangeID", sql.BigInt, change._number);
  request.input("ChangeID", sql.VarChar(128), clampVarChar(change.change_id, 128));
  request.input("Project", sql.VarChar(255), clampVarChar(change.project, 255));
  request.input("Branch", sql.VarChar(255), clampVarChar(change.branch, 255));
  request.input("FullBranch", sql.VarChar(255), clampVarChar(change.full_branch ?? null, 255));
  request.input("Status", sql.VarChar(32), clampVarChar(change.status, 32));
  request.input("Subject", sql.VarChar(1024), clampVarChar(change.subject, 1024) ?? "");
  request.input("OwnerAccountID", sql.Int, change.owner?._account_id ?? null);
  request.input("OwnerName", sql.VarChar(255), clampVarChar(change.owner?.name ?? null, 255));
  request.input("OwnerEmail", sql.VarChar(255), clampVarChar(change.owner?.email ?? null, 255));
  request.input("CreatedAt", sql.DateTime2, parseGerritDate(change.created));
  request.input("UpdatedAt", sql.DateTime2, parseGerritDate(change.updated));
  request.input("MergedAt", sql.DateTime2, change.submitted ? parseGerritDate(change.submitted) : null);
  request.input("SubmitType", sql.VarChar(64), clampVarChar(change.submit_type ?? null, 64));
  request.input("CurrentRevisionNumber", sql.Int, change.current_revision_number ?? null);
  request.input("Insertions", sql.Int, change.insertions ?? 0);
  request.input("Deletions", sql.Int, change.deletions ?? 0);
  request.input("TotalCommentCount", sql.Int, change.total_comment_count ?? 0);
  request.input("UnresolvedCommentCount", sql.Int, change.unresolved_comment_count ?? 0);
  request.input("WorkInProgress", sql.Bit, Boolean(change.work_in_progress));
  request.input("HasReviewStarted", sql.Bit, Boolean(change.has_review_started));
  await request.query(`
    MERGE [dbo].[GerritChange] AS target
    USING (SELECT @GerritChangeID AS [GerritChangeID]) AS source
      ON target.[GerritChangeID] = source.[GerritChangeID]
    WHEN MATCHED THEN
      UPDATE SET
        [ChangeID] = @ChangeID,
        [Project] = @Project,
        [Branch] = @Branch,
        [FullBranch] = @FullBranch,
        [Status] = @Status,
        [Subject] = @Subject,
        [OwnerAccountID] = @OwnerAccountID,
        [OwnerName] = @OwnerName,
        [OwnerEmail] = @OwnerEmail,
        [CreatedAt] = @CreatedAt,
        [UpdatedAt] = @UpdatedAt,
        [MergedAt] = COALESCE(@MergedAt, [MergedAt]),
        [SubmitType] = @SubmitType,
        [CurrentRevisionNumber] = @CurrentRevisionNumber,
        [Insertions] = @Insertions,
        [Deletions] = @Deletions,
        [TotalCommentCount] = @TotalCommentCount,
        [UnresolvedCommentCount] = @UnresolvedCommentCount,
        [WorkInProgress] = @WorkInProgress,
        [HasReviewStarted] = @HasReviewStarted,
        [LastSeenAt] = SYSUTCDATETIME(),
        [LastSyncedAt] = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT
      (
        [GerritChangeID], [ChangeID], [Project], [Branch], [FullBranch], [Status],
        [Subject], [OwnerAccountID], [OwnerName], [OwnerEmail], [CreatedAt],
        [UpdatedAt], [MergedAt], [SubmitType], [CurrentRevisionNumber], [Insertions],
        [Deletions], [TotalCommentCount], [UnresolvedCommentCount],
        [WorkInProgress], [HasReviewStarted]
      )
      VALUES
      (
        @GerritChangeID, @ChangeID, @Project, @Branch, @FullBranch, @Status,
        @Subject, @OwnerAccountID, @OwnerName, @OwnerEmail, @CreatedAt,
        @UpdatedAt, @MergedAt, @SubmitType, @CurrentRevisionNumber, @Insertions,
        @Deletions, @TotalCommentCount, @UnresolvedCommentCount,
        @WorkInProgress, @HasReviewStarted
      );
  `);
}

async function shouldFetchPatch(db: SqlExecutor, change: GerritChange): Promise<boolean> {
  if (!change.current_revision_number) {
    return false;
  }

  const result = await db
    .request()
    .input("GerritChangeID", sql.BigInt, change._number)
    .input("RevisionNumber", sql.Int, change.current_revision_number)
    .query<{ count: number }>(`
      SELECT COUNT(1) AS [count]
      FROM [dbo].[GerritPatch]
      WHERE [GerritChangeID] = @GerritChangeID
        AND [RevisionNumber] = @RevisionNumber
        AND [ParsedAt] IS NOT NULL
    `);

  return result.recordset[0]?.count === 0;
}

async function upsertPatch(
  db: SqlExecutor,
  change: GerritChange,
  commitSha: string | null,
  commitMessage: string | null,
  patchSha256: string,
  patchCachePath: string,
  parsedDiff: ParsedDiff,
): Promise<number> {
  const revisionNumber = change.current_revision_number ?? 0;

  const request = db.request();
  request.input("GerritChangeID", sql.BigInt, change._number);
  request.input("RevisionNumber", sql.Int, revisionNumber);
  request.input("CommitSha", sql.VarChar(64), commitSha);
  request.input("CommitMessage", sql.NVarChar(sql.MAX), commitMessage);
  request.input("PatchSha256", sql.VarChar(64), patchSha256);
  request.input("PatchCachePath", sql.VarChar(512), patchCachePath);
  request.input("FilesChanged", sql.Int, parsedDiff.files.length);
  request.input("AddedLines", sql.Int, parsedDiff.addedLines);
  request.input("RemovedLines", sql.Int, parsedDiff.removedLines);

  await request.query(`
    MERGE [dbo].[GerritPatch] AS target
    USING (
      SELECT @GerritChangeID AS [GerritChangeID], @RevisionNumber AS [RevisionNumber]
    ) AS source
      ON target.[GerritChangeID] = source.[GerritChangeID]
     AND target.[RevisionNumber] = source.[RevisionNumber]
    WHEN MATCHED THEN
      UPDATE SET
        [CommitSha] = COALESCE(@CommitSha, [CommitSha]),
        [CommitMessage] = COALESCE(@CommitMessage, [CommitMessage]),
        [PatchSha256] = @PatchSha256,
        [PatchCachePath] = @PatchCachePath,
        [FilesChanged] = @FilesChanged,
        [AddedLines] = @AddedLines,
        [RemovedLines] = @RemovedLines,
        [FetchedAt] = SYSUTCDATETIME(),
        [ParsedAt] = NULL,
        [FileNamesIndexedAt] = NULL,
        [MatchEvaluatedAt] = NULL
    WHEN NOT MATCHED THEN
      INSERT
      (
        [GerritChangeID], [RevisionNumber], [CommitSha], [CommitMessage], [PatchSha256], [PatchCachePath],
        [FilesChanged], [AddedLines], [RemovedLines], [MatchEvaluatedAt]
      )
      VALUES
      (
        @GerritChangeID, @RevisionNumber, @CommitSha, @CommitMessage, @PatchSha256, @PatchCachePath,
        @FilesChanged, @AddedLines, @RemovedLines, NULL
      );
  `);

  const result = await db
    .request()
    .input("GerritChangeID", sql.BigInt, change._number)
    .input("RevisionNumber", sql.Int, revisionNumber)
    .query<{ GerritPatchID: number }>(`
      SELECT [GerritPatchID]
      FROM [dbo].[GerritPatch]
      WHERE [GerritChangeID] = @GerritChangeID
        AND [RevisionNumber] = @RevisionNumber
    `);

  return result.recordset[0].GerritPatchID;
}

async function replacePatchBugIds(
  db: SqlExecutor,
  gerritPatchId: number,
  bugIds: string[],
): Promise<void> {
  await db
    .request()
    .input("GerritPatchID", sql.BigInt, gerritPatchId)
    .query(`
      DELETE FROM [dbo].[GerritPatchBug]
      WHERE [GerritPatchID] = @GerritPatchID;
    `);

  for (const [index, bugId] of bugIds.entries()) {
    await db
      .request()
      .input("GerritPatchID", sql.BigInt, gerritPatchId)
      .input("BugID", sql.VarChar(255), bugId)
      .input("BugOrder", sql.Int, index + 1)
      .query(`
        INSERT INTO [dbo].[GerritPatchBug]
          ([GerritPatchID], [BugID], [BugOrder])
        VALUES
          (@GerritPatchID, @BugID, @BugOrder);
      `);
  }
}

async function clearPatchParse(db: SqlExecutor, gerritPatchId: number): Promise<void> {
  await db.request().input("GerritPatchID", sql.BigInt, gerritPatchId).query(`
    DELETE match
    FROM [dbo].[GerritFlagMatch] match
    WHERE match.[GerritPatchID] = @GerritPatchID;
  `);
}

async function listPendingPatches(
  db: SqlExecutor,
  syncName: string,
  gerritChangeId: number | null = null,
): Promise<PendingPatch[]> {
  const statusFilter =
    syncName === "merged_changes"
      ? "c.[Status] = 'MERGED'"
      : syncName === "open_changes"
        ? "c.[Status] = 'NEW'"
        : "1 = 1";
  const result = await db
    .request()
    .input("GerritChangeID", sql.BigInt, gerritChangeId)
    .query<PendingPatch>(`
    SELECT
      p.[GerritPatchID],
      p.[GerritChangeID],
      c.[ChangeID],
      p.[RevisionNumber],
      p.[PatchCachePath],
      c.[Insertions]
    FROM [dbo].[GerritPatch] p
    INNER JOIN [dbo].[GerritChange] c
      ON c.[GerritChangeID] = p.[GerritChangeID]
    WHERE p.[ParsedAt] IS NULL
      AND p.[PatchCachePath] IS NOT NULL
      AND ${statusFilter}
      AND (@GerritChangeID IS NULL OR p.[GerritChangeID] = @GerritChangeID)
      AND NOT EXISTS (
        SELECT 1
        FROM [dbo].[GerritPendingPatch] pending
        WHERE pending.[GerritChangeID] = p.[GerritChangeID]
          AND ISNULL(pending.[RevisionNumber], -1) = ISNULL(p.[RevisionNumber], -1)
          AND pending.[Reason] = '${LARGE_DIFF_PENDING_REASON}'
          AND pending.[ResolvedAt] IS NULL
      )
    ORDER BY p.[GerritPatchID] ASC
  `);

  return result.recordset;
}

async function listPendingFileNamePatches(
  db: SqlExecutor,
  syncName: string,
  gerritChangeId: number | null = null,
): Promise<PendingFileNamePatch[]> {
  const statusFilter =
    syncName === "merged_changes"
      ? "c.[Status] = 'MERGED'"
      : syncName === "open_changes"
        ? "c.[Status] = 'NEW'"
        : "1 = 1";

  const result = await db
    .request()
    .input("GerritChangeID", sql.BigInt, gerritChangeId)
    .query<PendingFileNamePatch>(`
    SELECT p.[GerritPatchID], p.[GerritChangeID], p.[RevisionNumber],
           p.[PatchSha256], c.[ChangeID], p.[PatchCachePath]
    FROM [dbo].[GerritPatch] p
    INNER JOIN [dbo].[GerritChange] c
      ON c.[GerritChangeID] = p.[GerritChangeID]
    WHERE p.[FileNamesIndexedAt] IS NULL
      AND p.[PatchCachePath] IS NOT NULL
      AND REPLACE(p.[PatchCachePath], CHAR(92), '/') LIKE 'tools/gerrit/cache/patches/%.patch.diff'
      AND ${statusFilter}
      AND (@GerritChangeID IS NULL OR p.[GerritChangeID] = @GerritChangeID)
    ORDER BY p.[GerritPatchID] DESC
  `);
  return result.recordset;
}

async function replacePatchFileNames(
  db: SqlExecutor,
  gerritPatchId: number,
  filePaths: string[],
): Promise<void> {
  await db
    .request()
    .input("GerritPatchID", sql.BigInt, gerritPatchId)
    .input("FilePathsJson", sql.NVarChar(sql.MAX), JSON.stringify(filePaths))
    .query(`
      DECLARE @Files TABLE
      (
        [FilePath] nvarchar(1024) COLLATE Latin1_General_100_BIN2 NOT NULL
          PRIMARY KEY
      );

      INSERT INTO @Files ([FilePath])
      SELECT DISTINCT [FilePath] COLLATE Latin1_General_100_BIN2
      FROM OPENJSON(@FilePathsJson)
      WITH ([FilePath] nvarchar(1024) '$')
      WHERE [FilePath] IS NOT NULL
        AND [FilePath] <> N'';

      MERGE [dbo].[GerritFile] WITH (HOLDLOCK) AS target
      USING @Files AS source
        ON target.[FilePath] = source.[FilePath]
      WHEN NOT MATCHED THEN
        INSERT ([FilePath]) VALUES (source.[FilePath]);

      DELETE FROM [dbo].[GerritPatchFile]
      WHERE [GerritPatchID] = @GerritPatchID;

      INSERT INTO [dbo].[GerritPatchFile] ([GerritPatchID], [GerritFileID])
      SELECT @GerritPatchID, lookup.[GerritFileID]
      FROM @Files source
      INNER JOIN [dbo].[GerritFile] lookup
        ON lookup.[FilePath] = source.[FilePath];

      UPDATE [dbo].[GerritPatch]
      SET [FileNamesIndexedAt] = SYSUTCDATETIME()
      WHERE [GerritPatchID] = @GerritPatchID;
    `);
}

async function finalizePatchParse(
  db: SqlExecutor,
  gerritPatchId: number,
  parsedDiff: ParsedDiff,
): Promise<void> {
  await db
    .request()
    .input("GerritPatchID", sql.BigInt, gerritPatchId)
    .input("FilesChanged", sql.Int, parsedDiff.files.length)
    .input("AddedLines", sql.Int, parsedDiff.addedLines)
    .input("RemovedLines", sql.Int, parsedDiff.removedLines)
    .query(`
      UPDATE [dbo].[GerritPatch]
      SET
        [FilesChanged] = @FilesChanged,
        [AddedLines] = @AddedLines,
        [RemovedLines] = @RemovedLines,
        [ParsedAt] = SYSUTCDATETIME()
      WHERE [GerritPatchID] = @GerritPatchID;
    `);
}

async function loadSyncState(
  db: SqlExecutor,
  syncName: string,
): Promise<SyncStateRow | null> {
  const result = await db
    .request()
    .input("SyncName", sql.VarChar(128), syncName)
    .query<SyncStateRow>(`
      SELECT
        [SyncName],
        [Active],
        [MergeAfter],
        [MergeBefore],
        [LastUpdatedAt],
        [LastChangeNumber],
        [LastSyncedAt],
        [LastStatus],
        [LastError]
      FROM [dbo].[GerritSyncState]
      WHERE [SyncName] = @SyncName
    `);

  return result.recordset[0] ?? null;
}

async function loadActiveSyncStates(db: SqlExecutor): Promise<SyncStateRow[]> {
  const result = await db.request().query<SyncStateRow>(`
    SELECT
      [SyncName],
      [Active],
      [MergeAfter],
      [MergeBefore],
      [LastUpdatedAt],
      [LastChangeNumber],
      [LastSyncedAt],
      [LastStatus],
      [LastError]
    FROM [dbo].[GerritSyncState]
    WHERE [Active] = 1
    ORDER BY CASE [SyncName]
      WHEN 'merged_changes' THEN 1
      WHEN 'open_changes' THEN 2
      ELSE 10
    END, [SyncName]
  `);

  return result.recordset;
}

async function upsertPendingPatch(
  db: SqlExecutor,
  change: GerritChange,
  reason: string,
  httpStatus: number | null,
  errorMessage: string | null,
): Promise<void> {
  await db
    .request()
    .input("GerritChangeID", sql.BigInt, change._number)
    .input("ChangeID", sql.VarChar(128), change.change_id)
    .input("RevisionNumber", sql.Int, change.current_revision_number ?? null)
    .input("Reason", sql.VarChar(64), reason)
    .input("HttpStatus", sql.Int, httpStatus)
    .input("ErrorMessage", sql.NVarChar(2000), errorMessage)
    .query(`
      MERGE [dbo].[GerritPendingPatch] AS target
      USING (
        SELECT
          @GerritChangeID AS [GerritChangeID],
          @RevisionNumber AS [RevisionNumber],
          @Reason AS [Reason]
      ) AS source
        ON target.[GerritChangeID] = source.[GerritChangeID]
       AND ISNULL(target.[RevisionNumber], -1) = ISNULL(source.[RevisionNumber], -1)
       AND target.[Reason] = source.[Reason]
      WHEN MATCHED THEN
        UPDATE SET
          [ChangeID] = @ChangeID,
          [HttpStatus] = @HttpStatus,
          [ErrorMessage] = @ErrorMessage,
          [LastSeenAt] = SYSUTCDATETIME(),
          [ResolvedAt] = NULL
      WHEN NOT MATCHED THEN
        INSERT
        (
          [GerritChangeID], [ChangeID], [RevisionNumber], [Reason], [HttpStatus], [ErrorMessage]
        )
        VALUES
        (
          @GerritChangeID, @ChangeID, @RevisionNumber, @Reason, @HttpStatus, @ErrorMessage
        );
    `);
}

async function resolvePendingPatch(
  db: SqlExecutor,
  change: GerritChange,
  reason: string,
): Promise<void> {
  await db
    .request()
    .input("GerritChangeID", sql.BigInt, change._number)
    .input("RevisionNumber", sql.Int, change.current_revision_number ?? null)
    .input("Reason", sql.VarChar(64), reason)
    .query(`
      UPDATE [dbo].[GerritPendingPatch]
      SET [ResolvedAt] = SYSUTCDATETIME(),
          [LastSeenAt] = SYSUTCDATETIME()
      WHERE [GerritChangeID] = @GerritChangeID
        AND ISNULL([RevisionNumber], -1) = ISNULL(@RevisionNumber, -1)
        AND [Reason] = @Reason
        AND [ResolvedAt] IS NULL;
    `);
}

async function upsertSyncState(
  db: SqlExecutor,
  syncName: string,
  syncWindow: SyncWindow,
  changes: GerritChange[],
  status: string,
  error: string | null = null,
): Promise<void> {
  const newestUpdatedAt = changes
    .map((change) => parseGerritDate(change.updated))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const newestChangeNumber = changes.reduce(
    (max, change) => Math.max(max, change._number),
    0,
  );

  await db
    .request()
    .input("SyncName", sql.VarChar(128), syncName)
    .input("MergeAfter", sql.DateTime2, syncWindow.mergeAfter)
    .input("MergeBefore", sql.DateTime2, syncWindow.mergeBefore)
    .input("LastUpdatedAt", sql.DateTime2, newestUpdatedAt)
    .input("LastChangeNumber", sql.BigInt, newestChangeNumber || null)
    .input("LastStatus", sql.VarChar(32), status)
    .input("LastError", sql.NVarChar(2000), error)
    .query(`
      MERGE [dbo].[GerritSyncState] AS target
      USING (SELECT @SyncName AS [SyncName]) AS source
        ON target.[SyncName] = source.[SyncName]
      WHEN MATCHED THEN
        UPDATE SET
          [MergeAfter] = @MergeAfter,
          [MergeBefore] = @MergeBefore,
          [LastUpdatedAt] = COALESCE(@LastUpdatedAt, [LastUpdatedAt]),
          [LastChangeNumber] = COALESCE(@LastChangeNumber, [LastChangeNumber]),
          [LastSyncedAt] = SYSUTCDATETIME(),
          [LastStatus] = @LastStatus,
          [LastError] = @LastError
      WHEN NOT MATCHED THEN
        INSERT ([SyncName], [MergeAfter], [MergeBefore], [LastUpdatedAt], [LastChangeNumber], [LastSyncedAt], [LastStatus], [LastError])
        VALUES (@SyncName, @MergeAfter, @MergeBefore, @LastUpdatedAt, @LastChangeNumber, SYSUTCDATETIME(), @LastStatus, @LastError);
    `);
}

async function processSyncTarget(
  pool: sql.ConnectionPool,
  options: SyncOptions,
  syncState: SyncStateRow,
  syncWindow: SyncWindow,
): Promise<SyncTargetResult> {
  const allChanges: GerritChange[] = [];
  let fetchedPatches = 0;
  let pendingPatches = 0;
  let truncated = false;

  logInfo(
    `[${syncState.SyncName}] query="${syncWindow.query}" pageSize=${options.pageSize} maxPages=${options.maxPages} options=${options.optionBits}`,
  );

  const splitAndRecurse = async (
    reason: string,
  ): Promise<SyncTargetResult> => {
    const [firstWindow, secondWindow] = splitMergedSyncWindow(syncWindow);
    logInfo(
      `[${syncState.SyncName}] Splitting merged window because ${reason}. First="${firstWindow.query}" Second="${secondWindow.query}"`,
    );
    const firstResult = await processSyncTarget(pool, options, syncState, firstWindow);
    const secondResult = await processSyncTarget(pool, options, syncState, secondWindow);
    return {
      changes: dedupeChanges([
        ...allChanges,
        ...firstResult.changes,
        ...secondResult.changes,
      ]),
      fetchedPatches:
        fetchedPatches + firstResult.fetchedPatches + secondResult.fetchedPatches,
      pendingPatches:
        pendingPatches + firstResult.pendingPatches + secondResult.pendingPatches,
      truncated: truncated || firstResult.truncated || secondResult.truncated,
    };
  };

  for (let pageIndex = 0; options.maxPages <= 0 || pageIndex < options.maxPages; pageIndex += 1) {
    const start = pageIndex * options.pageSize;
    const pageStartedAt = Date.now();
    let changes: GerritChange[];
    try {
      changes = await fetchChanges(options, syncWindow.query, start);
    } catch (error) {
      const httpStatus = getHttpStatusFromError(error);
      if (httpStatus === 400 && start >= GERRIT_START_SPLIT_THRESHOLD && canSplitMergedWindow(syncWindow)) {
        return splitAndRecurse(`Gerrit rejected deep pagination at start=${start}`);
      }
      throw error;
    }
    logInfo(
      `[${syncState.SyncName}] Fetched page ${pageIndex + 1}: ${changes.length} changes in ${formatDuration(pageStartedAt)}.`,
    );
    allChanges.push(...changes);

    for (const [changeIndex, change] of changes.entries()) {
      const changeLogPrefix = formatChangeLogPrefix(
        syncState.SyncName,
        change,
        changeIndex + 1,
        changes.length,
      );
      const changeStartedAt = Date.now();
      const existenceStartedAt = Date.now();
      const state = await getChangeProcessingState(pool, change);
      const dbChange = withEffectiveGerritChangeID(change, state.existingGerritChangeID);
      if (dbChange._number !== change._number) {
        logInfo(
          `${changeLogPrefix} Reusing existing GerritChangeID ${dbChange._number} instead of incoming ${change._number}.`,
        );
      }
      const hasCachedDiff =
        state.patchCachePath !== null && (await diffCacheExists(state.patchCachePath));
      if (state.exists && !state.hasOpenPending409 && state.hasIndexedPatch && hasCachedDiff) {
        logInfo(
          `${changeLogPrefix} Skipping completed change ${change._number} after ${formatDuration(existenceStartedAt)} state check.`,
        );
        continue;
      }
      if (state.hasLargeDiffPending) {
        logInfo(
          `${changeLogPrefix} Skipping large-diff pending change ${change._number} after ${formatDuration(existenceStartedAt)} state check.`,
        );
        continue;
      }
      if (state.exists && !state.hasOpenPending409 && hasCachedDiff) {
        logInfo(
          `${changeLogPrefix} Skipping cached change ${change._number} after ${formatDuration(existenceStartedAt)} state check.`,
        );
        continue;
      }
      if (state.hasOpenPending409) {
        logInfo(
          `${changeLogPrefix} Retrying pending change ${change._number} after ${formatDuration(existenceStartedAt)} state check.`,
        );
      } else if (state.exists) {
        logInfo(
          `${changeLogPrefix} Reprocessing incomplete change ${change._number} after ${formatDuration(existenceStartedAt)} state check.`,
        );
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      let transactionCommitted = false;

      try {
        const metadataStartedAt = Date.now();
        await upsertChange(transaction, dbChange);
        logInfo(
          `${changeLogPrefix} Saved change ${change._number} metadata in ${formatDuration(metadataStartedAt)}.`,
        );

        if (shouldSkipPatchFetch(change)) {
          logInfo(
            `${changeLogPrefix} Skipping patch for change ${change._number}: subject starts with "Roll ". Total ${formatDuration(changeStartedAt)}.`,
          );
          await transaction.commit();
          transactionCommitted = true;
          continue;
        }

        const patchDecisionStartedAt = Date.now();
        if (!(await shouldFetchPatch(transaction, dbChange))) {
          logInfo(
            `${changeLogPrefix} Skipping patch for change ${change._number}: revision already indexed in ${formatDuration(patchDecisionStartedAt)}.`,
          );
          await transaction.commit();
          transactionCommitted = true;
          continue;
        }

        const expectedCachePath = getPatchCacheRelativePath(
          change._number,
          change.current_revision_number ?? 0,
        );
        const expectedCacheExists = await diffCacheExists(expectedCachePath);
        if (expectedCacheExists) {
          const cacheReuseStartedAt = Date.now();
          const cachedDiffText = await readDiffCache(expectedCachePath);
          const cachedPatchSha256 = crypto.createHash("sha256").update(cachedDiffText).digest("hex");
          const gerritPatchId = await upsertPatch(
            transaction,
            dbChange,
            null,
            null,
            cachedPatchSha256,
            expectedCachePath,
            {
              files: [],
              addedLines: 0,
              removedLines: 0,
            },
          );
          await resolvePendingPatch(transaction, dbChange, "patch_fetch_409");
          await transaction.commit();
          transactionCommitted = true;
          if (patchUploader) {
            await patchUploader.enqueue({
              gerritChangeId: change._number,
              revisionNumber: change.current_revision_number ?? 0,
              patchSha256: cachedPatchSha256,
              body: Buffer.from(cachedDiffText, "utf8"),
            });
          }
          logInfo(
            `${changeLogPrefix} Reused cached diff for change ${change._number} as patch ${gerritPatchId} in ${formatDuration(cacheReuseStartedAt)} without network fetch.`,
          );
          fetchedPatches += 1;
          continue;
        }

        const fetchStartedAt = Date.now();
        logInfo(`${changeLogPrefix} Fetching patch for change ${change._number}.`);
        let patchBase64: string;
        try {
          patchBase64 = await fetchPatchBase64(options, change._number);
        } catch (error) {
          const httpStatus = getHttpStatusFromError(error);
          if (httpStatus === 409) {
            const pendingStartedAt = Date.now();
              await upsertPendingPatch(
                transaction,
                dbChange,
                "patch_fetch_409",
                httpStatus,
              error instanceof Error ? error.message : String(error),
            );
            pendingPatches += 1;
            logInfo(
              `${changeLogPrefix} Marked change ${change._number} as pending after Gerrit 409 in ${formatDuration(pendingStartedAt)}.`,
            );
            await transaction.commit();
            transactionCommitted = true;
            continue;
          }
          throw error;
        }
        logInfo(
          `${changeLogPrefix} Fetched patch for change ${change._number}: ${patchBase64.length} base64 chars in ${formatDuration(fetchStartedAt)}.`,
        );

        const decodeStartedAt = Date.now();
        const diffText = decodePatch(patchBase64);
        const patchSha256 = crypto.createHash("sha256").update(diffText).digest("hex");
        logInfo(
          `${changeLogPrefix} Decoded patch for change ${change._number}: ${diffText.length} diff chars in ${formatDuration(decodeStartedAt)}.`,
        );

        const commitStartedAt = Date.now();
        const commitMetadata = await fetchCommitMetadata(options, change._number);
        const bugIds = extractBugIdsFromCommitMessage(commitMetadata.message ?? null);
        logInfo(
          `${changeLogPrefix} Fetched commit metadata for change ${change._number} in ${formatDuration(commitStartedAt)}. BugIDs=${bugIds.length > 0 ? bugIds.join("|") : "none"}.`,
        );

        const cacheStartedAt = Date.now();
        const patchCachePath = await writeDiffCache(
          change._number,
          change.current_revision_number ?? 0,
          diffText,
        );
        logInfo(
          `${changeLogPrefix} Stored diff cache for change ${change._number} at ${patchCachePath} in ${formatDuration(cacheStartedAt)}.`,
        );

        const isLargeDiff = (change.insertions ?? 0) > LARGE_DIFF_INSERTIONS_THRESHOLD;
        const patchPersistStartedAt = Date.now();
        const gerritPatchId = await upsertPatch(
          transaction,
          dbChange,
          commitMetadata.commit ?? null,
          commitMetadata.message ?? null,
          patchSha256,
          patchCachePath,
          {
            files: [],
            addedLines: 0,
            removedLines: 0,
          },
        );
        logInfo(
          `${changeLogPrefix} Saved patch row for change ${change._number} as patch ${gerritPatchId} in ${formatDuration(patchPersistStartedAt)}. Marked for deferred parse.`,
        );
        await replacePatchBugIds(transaction, gerritPatchId, bugIds);
        await resolvePendingPatch(transaction, dbChange, "patch_fetch_409");

        if (isLargeDiff) {
          const largeDiffStartedAt = Date.now();
          await upsertPendingPatch(
            transaction,
            dbChange,
            LARGE_DIFF_PENDING_REASON,
            null,
            `Automatic diff parse disabled because insertions=${change.insertions ?? 0} exceeds threshold=${LARGE_DIFF_INSERTIONS_THRESHOLD}. Patch cached but not parsed.`,
          );
          logInfo(
            `${changeLogPrefix} Marked change ${change._number} as large-diff pending after patch storage in ${formatDuration(largeDiffStartedAt)}.`,
          );
        }

        await transaction.commit();
        transactionCommitted = true;

        if (patchUploader) {
          await patchUploader.enqueue({
            gerritChangeId: change._number,
            revisionNumber: change.current_revision_number ?? 0,
            patchSha256,
            body: Buffer.from(diffText, "utf8"),
          });
        }

        fetchedPatches += 1;
        logInfo(
          `${changeLogPrefix} Stored patch for change ${change._number}, total ${formatDuration(changeStartedAt)}.`,
        );
      } catch (error) {
        if (!transactionCommitted) {
          await safeRollback(transaction, `${syncState.SyncName}:${change._number}`);
        }
        throw error;
      }


    }

    const hasMoreChanges = changes.some((change) => change._more_changes);
    if (!hasMoreChanges) {
      break;
    }

    if (start + options.pageSize >= GERRIT_START_SPLIT_THRESHOLD && canSplitMergedWindow(syncWindow)) {
      return splitAndRecurse(`window exceeded Gerrit pagination threshold at start=${start}`);
    }

    if (options.maxPages > 0 && pageIndex + 1 >= options.maxPages) {
      truncated = true;
      logInfo(
        `[${syncState.SyncName}] Truncated after reaching maxPages=${options.maxPages} with _more_changes=true.`,
      );
      break;
    }
  }

  return {
    changes: allChanges,
    fetchedPatches,
    pendingPatches,
    truncated,
  };
}

async function processPendingPatchesForSyncTarget(
  pool: sql.ConnectionPool,
  syncName: string,
  gerritChangeId: number | null = null,
): Promise<{
  parsedPatches: number;
  parsedFiles: number;
  parsedAddedLines: number;
}> {
  let parsedPatches = 0;
  let parsedFiles = 0;
  let parsedAddedLines = 0;

  const pendingStartedAt = Date.now();
  const pendingPatchQueue = await listPendingPatches(pool, syncName, gerritChangeId);
  logInfo(
    `[${syncName}] Pending parse queue: ${pendingPatchQueue.length} patches loaded in ${formatDuration(pendingStartedAt)}.`,
  );

  for (const [patchIndex, patch] of pendingPatchQueue.entries()) {
    const patchLogPrefix = formatDeferredPatchLogPrefix(
      patch,
      patchIndex + 1,
      pendingPatchQueue.length,
    );
    const patchStartedAt = Date.now();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    let transactionCommitted = false;

    try {
      if ((patch.Insertions ?? 0) > LARGE_DIFF_INSERTIONS_THRESHOLD) {
        const largeDiffStartedAt = Date.now();
        await upsertPendingPatch(
          transaction,
          {
            _number: patch.GerritChangeID,
            change_id: patch.ChangeID,
            project: "",
            branch: "",
            status: "",
            subject: "",
            created: "",
            updated: "",
            current_revision_number: patch.RevisionNumber,
          },
          LARGE_DIFF_PENDING_REASON,
          null,
          `Deferred parse disabled because insertions=${patch.Insertions} exceeds threshold=${LARGE_DIFF_INSERTIONS_THRESHOLD}.`,
        );
        await transaction.commit();
        transactionCommitted = true;
        logInfo(
          `${patchLogPrefix} Marked deferred patch ${patch.GerritPatchID} for change ${patch.GerritChangeID} as large-diff pending in ${formatDuration(largeDiffStartedAt)}.`,
        );
        continue;
      }

      const cacheReadStartedAt = Date.now();
      const diffText = await readDiffCache(patch.PatchCachePath!);
      logInfo(
        `${patchLogPrefix} Loaded cached diff for patch ${patch.GerritPatchID} from ${patch.PatchCachePath} in ${formatDuration(cacheReadStartedAt)}.`,
      );

      const parseStartedAt = Date.now();
      const parsedDiff = parseDiff(diffText);
      logInfo(
        `${patchLogPrefix} Parsed deferred patch ${patch.GerritPatchID} for change ${patch.GerritChangeID}: ${parsedDiff.files.length} files, ${parsedDiff.addedLines} added lines, ${parsedDiff.removedLines} removed lines in ${formatDuration(parseStartedAt)}.`,
      );

      const clearStartedAt = Date.now();
      await clearPatchParse(transaction, patch.GerritPatchID);
      logInfo(
        `${patchLogPrefix} Cleared prior diff rows for deferred patch ${patch.GerritPatchID} in ${formatDuration(clearStartedAt)}.`,
      );

      const finalizeStartedAt = Date.now();
      await finalizePatchParse(transaction, patch.GerritPatchID, parsedDiff);
      logInfo(
        `${patchLogPrefix} Finalized deferred patch ${patch.GerritPatchID} stats in ${formatDuration(finalizeStartedAt)}.`,
      );

      await transaction.commit();
      transactionCommitted = true;

      parsedPatches += 1;
      parsedFiles += parsedDiff.files.length;
      parsedAddedLines += parsedDiff.addedLines;
      logInfo(
        `${patchLogPrefix} Indexed deferred patch ${patch.GerritPatchID} for change ${patch.GerritChangeID}, total ${formatDuration(patchStartedAt)}.`,
      );
    } catch (error) {
      if (!transactionCommitted) {
        await safeRollback(transaction, `deferred:${patch.GerritPatchID}`);
      }
      throw error;
    }
  }

  return {
    parsedPatches,
    parsedFiles,
    parsedAddedLines,
  };
}

async function preparePendingFileNameCache(
  pool: sql.ConnectionPool,
  options: SyncOptions,
  syncName: string,
  gerritChangeId: number | null = null,
): Promise<Set<number>> {
  const skippedPatchIds = new Set<number>();
  const queue = await listPendingFileNamePatches(pool, syncName, gerritChangeId);
  logInfo(`[${syncName}] Preparing file-name cache: ${queue.length} pending patches.`);
  for (const patch of queue) {
    const absolutePath = getPatchCacheAbsolutePath(patch.PatchCachePath);
    if (await diffCacheExists(patch.PatchCachePath)) continue;
    const prefix = `[${syncName}][cache-recovery][change=${patch.GerritChangeID} revision=${patch.RevisionNumber}]`;
    if (!Number.isInteger(patch.RevisionNumber) || patch.RevisionNumber <= 0) {
      throw new Error(`${prefix} Invalid recorded revision.`);
    }
    logInfo(`${prefix} Downloading missing diff for file-name indexing.`);
    const diffText = decodePatch(await fetchPatchBase64(options, patch.GerritChangeID, patch.RevisionNumber));
    const actualHash = crypto.createHash("sha256").update(diffText).digest("hex");
    if (actualHash !== patch.PatchSha256) {
      logInfo(`${prefix} Skipping patch=${patch.GerritPatchID}: SHA-256 mismatch: expected ${patch.PatchSha256}, got ${actualHash}. File-name indexing remains pending.`);
      skippedPatchIds.add(patch.GerritPatchID);
      continue;
    }
    // Resolve the recorded path without changing its historical representation in SQL.
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, diffText, "utf8");
    logInfo(`${prefix} Restored verified diff to ${patch.PatchCachePath}.`);
  }
  return skippedPatchIds;
}

async function processPendingFileNamesForSyncTarget(
  pool: sql.ConnectionPool,
  syncName: string,
  gerritChangeId: number | null = null,
  skippedPatchIds: ReadonlySet<number> = new Set(),
): Promise<{ indexedPatches: number; indexedFileNames: number }> {
  let indexedPatches = 0;
  let indexedFileNames = 0;
  const queue = await listPendingFileNamePatches(pool, syncName, gerritChangeId);
  logInfo(`[${syncName}] Pending file-name queue: ${queue.length} patches.`);

  for (const [patchIndex, patch] of queue.entries()) {
    if (skippedPatchIds.has(patch.GerritPatchID)) continue;
    const prefix = `[file-names][${patch.ChangeID}][${patchIndex + 1}/${queue.length}]`;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    let transactionCommitted = false;
    try {
      if (!isPatchCacheRelativePath(patch.PatchCachePath)) {
        throw new Error(
          `Invalid patch cache path for patch ${patch.GerritPatchID}: ${patch.PatchCachePath}`,
        );
      }
      const diffText = await readDiffCache(patch.PatchCachePath);
      const filePaths = extractDiffFilePaths(diffText);
      await replacePatchFileNames(transaction, patch.GerritPatchID, filePaths);
      await transaction.commit();
      transactionCommitted = true;
      indexedPatches += 1;
      indexedFileNames += filePaths.length;
      logInfo(`${prefix} Indexed ${filePaths.length} file names for patch ${patch.GerritPatchID}.`);
    } catch (error) {
      if (!transactionCommitted) {
        await safeRollback(transaction, `file-names:${patch.GerritPatchID}`);
      }
      throw error;
    }
  }
  return { indexedPatches, indexedFileNames };
}
function validateTargetedChangeId(value: string): void {
  if (!/^\d+$/.test(value) && !/^I[0-9a-f]{40}$/i.test(value)) {
    throw new Error(
      `Invalid --change-id value "${value}". Expected a numeric Gerrit ID or an I-prefixed 40-hex Change-Id.`,
    );
  }
}

async function processTargetedChange(
  pool: sql.ConnectionPool,
  options: SyncOptions,
): Promise<void> {
  const requestedId = options.changeId!;
  validateTargetedChangeId(requestedId);
  const query = `change:${requestedId}`;
  const preflight = await fetchChanges(options, query, 0);
  const hasMore = preflight.some((change) => change._more_changes);
  if (preflight.length !== 1 || hasMore) {
    throw new Error(
      `Targeted query "${query}" returned ${preflight.length}${hasMore ? "+" : ""} changes; expected exactly one.`,
    );
  }

  const selected = preflight[0];
  const syncState: SyncStateRow = {
    SyncName: "targeted_change", Active: true, MergeAfter: null, MergeBefore: null,
    LastUpdatedAt: null, LastChangeNumber: null, LastSyncedAt: null,
    LastStatus: null, LastError: null,
  };
  const syncWindow: SyncWindow = {
    syncName: syncState.SyncName, query, mergeAfter: null, mergeBefore: null,
  };
  const result = await processSyncTarget(pool, options, syncState, syncWindow);
  if (result.truncated || result.changes.length !== 1) {
    throw new Error(`Targeted import for ${requestedId} did not complete exactly one change.`);
  }

  const skippedPatchIds = await preparePendingFileNameCache(pool, options, syncState.SyncName, selected._number);
  const fileNames = await processPendingFileNamesForSyncTarget(
    pool, syncState.SyncName, selected._number, skippedPatchIds,
  );
  logInfo(
    `[targeted_change] Done. GerritChangeID=${selected._number} ChangeID=${selected.change_id} fetched_patches=${result.fetchedPatches} pending_patches=${result.pendingPatches} file_name_indexed_patches=${fileNames.indexedPatches} indexed_file_names=${fileNames.indexedFileNames}. GerritSyncState was not modified.`,
  );
}

async function main(): Promise<void> {
  const options = getSyncOptions();
  const uploadConfig = await loadUploadConfig(false);
  const pool = new sql.ConnectionPool(getSqlConfig());
  const startedAt = Date.now();
  await pool.connect();
  const syncStates = await loadActiveSyncStates(pool);
  if (uploadConfig) {
    patchUploader = new ConcurrentPatchUploader(
      uploadConfig,
      Number(process.env.GERRIT_PATCH_UPLOAD_CONCURRENCY ?? "4"),
      (message) => logInfo(`[patch-upload] ${message}`),
      async (result) => {
        await persistUploadResults(pool, [result]);
        if (result.Uploaded) {
          logInfo(`[patch-upload] change=${result.GerritChangeID} revision=${result.RevisionNumber} persisted object_key=${result.ObjectKey}.`);
        } else {
          logInfo(`[patch-upload] change=${result.GerritChangeID} revision=${result.RevisionNumber} persisted error=${result.Error ?? "unknown error"}.`);
        }
      },
    );
    logInfo("Concurrent patch upload enabled.");
  } else {
    logInfo("Concurrent patch upload disabled: GERRIT_PATCH_UPLOAD_SECRET is not configured.");
  }

  let totalTargets = 0;
  let totalChanges = 0;
  let fetchedPatches = 0;
  let pendingPatches = 0;
  let fileNameIndexedPatches = 0;
  let indexedFileNames = 0;

  try {
    if (options.changeId) {
      await processTargetedChange(pool, options);
      return;
    }

    logInfo(`Active sync targets loaded: ${syncStates.length}.`);

    for (const syncState of syncStates) {
      const now = new Date();
      if (!shouldRunSyncTarget(syncState, now)) {
        logInfo(
          `[${syncState.SyncName}] Skipped by schedule. LastSyncedAt=${syncState.LastSyncedAt?.toISOString() ?? "null"}.`,
        );
        continue;
      }

      totalTargets += 1;
      const syncWindow = buildSyncWindow(options, syncState, now);

      try {
        const result = await processSyncTarget(pool, options, syncState, syncWindow);
        if (result.truncated) {
          throw new Error(
            `Sync target ${syncState.SyncName} truncated: reached maxPages=${options.maxPages} while Gerrit still reported _more_changes=true.`,
          );
        }
        totalChanges += result.changes.length;
        fetchedPatches += result.fetchedPatches;
        pendingPatches += result.pendingPatches;


        const syncStateTx = new sql.Transaction(pool);
        await syncStateTx.begin();
        try {
          await upsertSyncState(
            syncStateTx,
            syncState.SyncName,
            syncWindow,
            result.changes,
            "success",
          );
          await syncStateTx.commit();
        } catch (error) {
          await safeRollback(syncStateTx, `${syncState.SyncName}:success_state`);
          throw error;
        }
      } catch (error) {
        const syncStateTx = new sql.Transaction(pool);
        await syncStateTx.begin();
        try {
          await upsertSyncState(
            syncStateTx,
            syncState.SyncName,
            syncWindow,
            [],
            "failed",
            error instanceof Error ? error.message : String(error),
          );
          await syncStateTx.commit();
        } catch (syncError) {
          await safeRollback(syncStateTx, `${syncState.SyncName}:failed_state`);
          logInfo(
            `[${syncState.SyncName}] Failed to persist sync state after error: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
          );
        }
        throw error;
      }

      const skippedPatchIds = await preparePendingFileNameCache(pool, options, syncState.SyncName);
      const fileNameResult = await processPendingFileNamesForSyncTarget(
        pool,
        syncState.SyncName,
        null,
        skippedPatchIds,
      );
      fileNameIndexedPatches += fileNameResult.indexedPatches;
      indexedFileNames += fileNameResult.indexedFileNames;

    }

    logInfo(
      `Done in ${formatDuration(startedAt)}. targets=${totalTargets} changes=${totalChanges} fetched_patches=${fetchedPatches} pending_patches=${pendingPatches} file_name_indexed_patches=${fileNameIndexedPatches} indexed_file_names=${indexedFileNames}`,
    );
  } catch (error) {
    throw error;
  } finally {
    if (patchUploader) {
      try {
        const uploadResults = await patchUploader.drain();
        await persistUploadResults(pool, uploadResults);
        logInfo(`Patch upload queue drained: uploaded=${uploadResults.filter((result) => result.Uploaded).length} failed=${uploadResults.filter((result) => !result.Uploaded).length}.`);
      } catch (uploadError) {
        console.error("[gerrit-sync] Failed to finalize patch upload results:", uploadError);
      }
    }
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
