<?php

declare(strict_types=1);

/*
 * Public Gerrit patch storage.
 *
 * Public reads:
 *   GET|HEAD /api/gerrit-patches.php?change=7910401&revision=3
 *
 * Authenticated upload:
 *   PUT /api/gerrit-patches.php?change=7910401&revision=3
 *   X-Timestamp: <unix timestamp in seconds>
 *   X-Patch-SHA256: <lowercase SHA-256 of the request body>
 *   X-Signature: HMAC-SHA256 of the canonical request below
 *
 * Canonical request:
 *   PUT\n<change>\n<revision>\n<timestamp>\n<sha256>
 */

const GERRIT_PATCH_UPLOAD_SECRET = '<secret>';
const GERRIT_PATCH_MAX_BYTES = 64 * 1024 * 1024;
const GERRIT_PATCH_TIMESTAMP_TOLERANCE_SECONDS = 300;
const GERRIT_PATCH_PUBLIC_CACHE_SECONDS = 31536000;

// At runtime: <site-root>/api -> <site-root>/gerrit-patches.
// This source file is intentionally outside web/public and is not deployed by the Astro build.
const GERRIT_PATCH_STORAGE_DIRECTORY_NAME = 'gerrit-patches';

function respond(int $status, ?string $message = null): void
{
    http_response_code($status);
    header('X-Content-Type-Options: nosniff');

    if ($message !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            ['status' => $status, 'message' => $message],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
    }

    exit;
}

function request_header(string $name): string
{
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    $value = $_SERVER[$serverName] ?? '';
    return is_string($value) ? trim($value) : '';
}

function validated_identifiers(): array
{
    $changeId = isset($_GET['change']) ? (string) $_GET['change'] : '';
    $revision = isset($_GET['revision']) ? (string) $_GET['revision'] : '';

    if (!preg_match('/^[1-9][0-9]{0,11}$/D', $changeId)) {
        respond(400, 'Invalid Gerrit change number.');
    }
    if (!preg_match('/^[1-9][0-9]{0,5}$/D', $revision)) {
        respond(400, 'Invalid Gerrit revision number.');
    }

    return [$changeId, $revision];
}

function storage_root(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . GERRIT_PATCH_STORAGE_DIRECTORY_NAME;
}

function patch_location(string $changeId, string $revision): array
{
    $padded = str_pad($changeId, 4, '0', STR_PAD_LEFT);
    $firstShard = substr($padded, 0, 2);
    $secondShard = substr($padded, 2, 2);
    $directory = storage_root()
        . DIRECTORY_SEPARATOR . $firstShard
        . DIRECTORY_SEPARATOR . $secondShard;
    $fileName = $changeId . '.' . $revision . '.patch.diff';

    return [$directory, $directory . DIRECTORY_SEPARATOR . $fileName];
}

function ensure_storage_directory(string $directory): void
{
    if (is_dir($directory)) {
        return;
    }

    if (!mkdir($directory, 0755, true) && !is_dir($directory)) {
        respond(500, 'Unable to create the patch storage directory.');
    }
}

function authenticate_upload(
    string $changeId,
    string $revision
): string {
    $timestamp = request_header('X-Timestamp');
    $contentSha256 = strtolower(request_header('X-Patch-SHA256'));
    $signature = strtolower(request_header('X-Signature'));

    if (!preg_match('/^[0-9]{10,12}$/D', $timestamp)) {
        respond(401, 'Invalid upload authentication.');
    }
    if (abs(time() - (int) $timestamp) > GERRIT_PATCH_TIMESTAMP_TOLERANCE_SECONDS) {
        respond(401, 'Expired upload authentication.');
    }
    if (!preg_match('/^[a-f0-9]{64}$/D', $contentSha256)
        || !preg_match('/^[a-f0-9]{64}$/D', $signature)) {
        respond(401, 'Invalid upload authentication.');
    }

    $canonicalRequest = implode("\n", [
        'PUT',
        $changeId,
        $revision,
        $timestamp,
        $contentSha256,
    ]);
    $expectedSignature = hash_hmac(
        'sha256',
        $canonicalRequest,
        GERRIT_PATCH_UPLOAD_SECRET
    );

    if (!hash_equals($expectedSignature, $signature)) {
        respond(401, 'Invalid upload authentication.');
    }

    return $contentSha256;
}

function receive_body_to_file(string $temporaryPath, string $expectedSha256): int
{
    $declaredLength = $_SERVER['CONTENT_LENGTH'] ?? null;
    if ($declaredLength !== null
        && (!ctype_digit((string) $declaredLength)
            || (int) $declaredLength > GERRIT_PATCH_MAX_BYTES)) {
        respond(413, 'Patch exceeds the maximum allowed size.');
    }

    $input = fopen('php://input', 'rb');
    $output = fopen($temporaryPath, 'wb');
    if ($input === false || $output === false) {
        if (is_resource($input)) {
            fclose($input);
        }
        respond(500, 'Unable to open the upload streams.');
    }

    $hash = hash_init('sha256');
    $totalBytes = 0;

    try {
        while (!feof($input)) {
            $chunk = fread($input, 1024 * 1024);
            if ($chunk === false) {
                respond(500, 'Unable to read the upload body.');
            }
            if ($chunk === '') {
                continue;
            }

            $totalBytes += strlen($chunk);
            if ($totalBytes > GERRIT_PATCH_MAX_BYTES) {
                respond(413, 'Patch exceeds the maximum allowed size.');
            }
            if (fwrite($output, $chunk) !== strlen($chunk)) {
                respond(500, 'Unable to write the uploaded patch.');
            }
            hash_update($hash, $chunk);
        }
    } finally {
        fclose($input);
        fclose($output);
    }

    $actualSha256 = hash_final($hash);
    if (!hash_equals($expectedSha256, $actualSha256)) {
        @unlink($temporaryPath);
        respond(422, 'Patch SHA-256 does not match the signed value.');
    }

    return $totalBytes;
}

function upload_patch(string $changeId, string $revision): void
{
    $expectedSha256 = authenticate_upload($changeId, $revision);
    [$directory, $destination] = patch_location($changeId, $revision);
    ensure_storage_directory($directory);

    // A persistent lock per shard avoids both races and one lock file per patch.
    $lockPath = $directory . DIRECTORY_SEPARATOR . '.upload.lock';
    $lock = fopen($lockPath, 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) {
            fclose($lock);
        }
        respond(503, 'Unable to lock the patch destination.');
    }

    try {
        if (is_file($destination)) {
            $storedSha256 = hash_file('sha256', $destination);
            if (is_string($storedSha256)
                && hash_equals($storedSha256, $expectedSha256)) {
                respond(204);
            }
            respond(409, 'The patch key already exists with different content.');
        }

        $temporaryPath = tempnam($directory, '.upload-');
        if ($temporaryPath === false) {
            respond(500, 'Unable to create a temporary upload file.');
        }

        try {
            receive_body_to_file($temporaryPath, $expectedSha256);
            if (!rename($temporaryPath, $destination)) {
                respond(500, 'Unable to publish the uploaded patch.');
            }
        } finally {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }

    header('Location: /' . GERRIT_PATCH_STORAGE_DIRECTORY_NAME . '/'
        . substr(str_pad($changeId, 4, '0', STR_PAD_LEFT), 0, 2) . '/'
        . substr(str_pad($changeId, 4, '0', STR_PAD_LEFT), 2, 2) . '/'
        . $changeId . '.' . $revision . '.patch.diff');
    header('ETag: "' . $expectedSha256 . '"');
    respond(201);
}

function download_patch(string $changeId, string $revision, bool $includeBody): void
{
    [, $path] = patch_location($changeId, $revision);
    if (!is_file($path)) {
        respond(404, 'Patch not found.');
    }

    $size = filesize($path);
    $sha256 = hash_file('sha256', $path);
    if ($size === false || !is_string($sha256)) {
        respond(500, 'Unable to read the stored patch.');
    }

    http_response_code(200);
    header('Content-Type: text/x-diff; charset=utf-8');
    header('Content-Length: ' . $size);
    header('ETag: "' . $sha256 . '"');
    header('Cache-Control: public, max-age=' . GERRIT_PATCH_PUBLIC_CACHE_SECONDS . ', immutable');
    header('X-Content-Type-Options: nosniff');

    if ($includeBody) {
        readfile($path);
    }
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? '');
[$changeId, $revision] = validated_identifiers();

if ($method === 'PUT') {
    upload_patch($changeId, $revision);
}
if ($method === 'GET') {
    download_patch($changeId, $revision, true);
}
if ($method === 'HEAD') {
    download_patch($changeId, $revision, false);
}

header('Allow: GET, HEAD, PUT');
respond(405, 'Method not allowed.');
