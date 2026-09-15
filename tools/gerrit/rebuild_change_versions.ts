import sql from "mssql";

type MarkerRow = {
  GerritChangeID: number;
  Project: string;
  Branch: string;
  Subject: string;
  MergedAt: Date;
};

type VersionRow = {
  Project: string;
  Branch: string;
  Version: string;
  Major: number;
  Minor: number;
  Build: number;
  Patch: number;
  VersionSequence: number;
  StartMergedAt: string;
  StartGerritChangeID: number;
};

const RELEASE_VERSION_PATTERN = /\bIncrementing VERSION to (\d+)\.(\d+)\.(\d+)\.(\d+)\b/i;
const TRUNK_VERSION_PATTERN =
  /\bUpdating trunk VERSION from (\d+)\.(\d+) to (\d+)\.(\d+)(?: and incrementing major version to (\d+))?\b/i;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSqlConfig(): sql.config {
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
  };
}

function buildVersions(markers: MarkerRow[]): VersionRow[] {
  const markersByStream = new Map<string, MarkerRow[]>();

  for (const marker of markers) {
    const streamKey = `${marker.Project}\u0000${marker.Branch}`;
    const streamMarkers = markersByStream.get(streamKey) ?? [];
    streamMarkers.push(marker);
    markersByStream.set(streamKey, streamMarkers);
  }

  const result: VersionRow[] = [];
  for (const streamMarkers of markersByStream.values()) {
    const versions = new Map<string, VersionRow>();
    const firstExplicitTrunkMajor = streamMarkers
      .map((marker) => TRUNK_VERSION_PATTERN.exec(marker.Subject)?.[5])
      .find((major): major is string => Boolean(major));
    let currentTrunkMajor = firstExplicitTrunkMajor
      ? Number(firstExplicitTrunkMajor) - 1
      : null;

    for (const marker of streamMarkers) {
      const releaseMatch = RELEASE_VERSION_PATTERN.exec(marker.Subject);
      const trunkMatch = TRUNK_VERSION_PATTERN.exec(marker.Subject);
      let major: number;
      let minor: number;
      let build: number;
      let patch: number;

      if (releaseMatch) {
        major = Number(releaseMatch[1]);
        minor = Number(releaseMatch[2]);
        build = Number(releaseMatch[3]);
        patch = Number(releaseMatch[4]);
      } else if (trunkMatch) {
        if (trunkMatch[5]) {
          currentTrunkMajor = Number(trunkMatch[5]);
        }
        if (currentTrunkMajor === null) {
          continue;
        }
        major = currentTrunkMajor;
        minor = 0;
        build = Number(trunkMatch[3]);
        patch = Number(trunkMatch[4]);
      } else {
        continue;
      }

      const version = `${major}.${minor}.${build}.${patch}`;
      // In caso di marker duplicato conserva il primo in ordine di merge.
      if (!versions.has(version)) {
        versions.set(version, {
          Project: marker.Project,
          Branch: marker.Branch,
          Version: version,
          Major: major,
          Minor: minor,
          Build: build,
          Patch: patch,
          VersionSequence: 0,
          StartMergedAt: marker.MergedAt.toISOString(),
          StartGerritChangeID: marker.GerritChangeID,
        });
      }
    }

    let sequence = 0;
    for (const version of versions.values()) {
      sequence += 1;
      version.VersionSequence = sequence;
      result.push(version);
    }
  }

  return result;
}

async function rebuildVersions(
  transaction: sql.Transaction,
  versions: VersionRow[],
): Promise<{ VersionCount: number; AssignedChanges: number }> {
  const result = await transaction
    .request()
    .input("VersionsJson", sql.NVarChar(sql.MAX), JSON.stringify(versions))
    .query<{ VersionCount: number; AssignedChanges: number }>(`
      DECLARE @Versions TABLE
      (
        [Project] varchar(255) NOT NULL,
        [Branch] varchar(255) NOT NULL,
        [Version] varchar(64) NOT NULL,
        [Major] int NOT NULL,
        [Minor] int NOT NULL,
        [Build] int NOT NULL,
        [Patch] int NOT NULL,
        [VersionSequence] int NOT NULL,
        [StartMergedAt] datetime2(0) NOT NULL,
        [StartGerritChangeID] bigint NOT NULL,
        PRIMARY KEY ([Project], [Branch], [Version])
      );

      INSERT INTO @Versions
      (
        [Project], [Branch], [Version], [Major], [Minor], [Build], [Patch],
        [VersionSequence], [StartMergedAt], [StartGerritChangeID]
      )
      SELECT
        [Project], [Branch], [Version], [Major], [Minor], [Build], [Patch],
        [VersionSequence], [StartMergedAt], [StartGerritChangeID]
      FROM OPENJSON(@VersionsJson)
      WITH
      (
        [Project] varchar(255) '$.Project',
        [Branch] varchar(255) '$.Branch',
        [Version] varchar(64) '$.Version',
        [Major] int '$.Major',
        [Minor] int '$.Minor',
        [Build] int '$.Build',
        [Patch] int '$.Patch',
        [VersionSequence] int '$.VersionSequence',
        [StartMergedAt] datetime2(0) '$.StartMergedAt',
        [StartGerritChangeID] bigint '$.StartGerritChangeID'
      );

      UPDATE change_row
      SET [GerritVersionID] = NULL
      FROM [dbo].[GerritChange] change_row
      INNER JOIN [dbo].[GerritVersion] existing
        ON existing.[GerritVersionID] = change_row.[GerritVersionID]
      WHERE NOT EXISTS
      (
        SELECT 1
        FROM @Versions source
        WHERE source.[Project] = existing.[Project]
          AND source.[Branch] = existing.[Branch]
          AND source.[Version] = existing.[Version]
      );

      DELETE existing
      FROM [dbo].[GerritVersion] existing
      WHERE NOT EXISTS
      (
        SELECT 1
        FROM @Versions source
        WHERE source.[Project] = existing.[Project]
          AND source.[Branch] = existing.[Branch]
          AND source.[Version] = existing.[Version]
      );

      MERGE [dbo].[GerritVersion] WITH (HOLDLOCK) AS target
      USING @Versions AS source
        ON target.[Project] = source.[Project]
       AND target.[Branch] = source.[Branch]
       AND target.[Version] = source.[Version]
      WHEN MATCHED THEN UPDATE SET
        [Major] = source.[Major],
        [Minor] = source.[Minor],
        [Build] = source.[Build],
        [Patch] = source.[Patch],
        [VersionSequence] = source.[VersionSequence],
        [StartMergedAt] = source.[StartMergedAt],
        [StartGerritChangeID] = source.[StartGerritChangeID]
      WHEN NOT MATCHED THEN INSERT
      (
        [Project], [Branch], [Version], [Major], [Minor], [Build], [Patch],
        [VersionSequence], [StartMergedAt], [StartGerritChangeID]
      )
      VALUES
      (
        source.[Project], source.[Branch], source.[Version], source.[Major],
        source.[Minor], source.[Build], source.[Patch], source.[VersionSequence],
        source.[StartMergedAt], source.[StartGerritChangeID]
      );

      UPDATE change_row
      SET [GerritVersionID] = effective.[GerritVersionID]
      FROM [dbo].[GerritChange] change_row
      OUTER APPLY
      (
        SELECT TOP 1 version_row.[GerritVersionID]
        FROM [dbo].[GerritVersion] version_row
        WHERE version_row.[Project] = change_row.[Project]
          AND version_row.[Branch] = change_row.[Branch]
          AND
          (
            version_row.[StartMergedAt] < change_row.[MergedAt]
            OR
            (
              version_row.[StartMergedAt] = change_row.[MergedAt]
              AND version_row.[StartGerritChangeID] <= change_row.[GerritChangeID]
            )
          )
        ORDER BY
          version_row.[StartMergedAt] DESC,
          version_row.[StartGerritChangeID] DESC
      ) effective
      WHERE change_row.[Status] = 'MERGED'
        AND change_row.[MergedAt] IS NOT NULL
        AND ISNULL(change_row.[GerritVersionID], -1) <>
            ISNULL(effective.[GerritVersionID], -1);

      DECLARE @AssignedChanges int = @@ROWCOUNT;

      UPDATE [dbo].[GerritChange]
      SET [GerritVersionID] = NULL
      WHERE ([Status] <> 'MERGED' OR [MergedAt] IS NULL)
        AND [GerritVersionID] IS NOT NULL;

      SELECT
        (SELECT COUNT(1) FROM [dbo].[GerritVersion]) AS [VersionCount],
        @AssignedChanges AS [AssignedChanges];
    `);

  return result.recordset[0];
}

async function main(): Promise<void> {
  const pool = await new sql.ConnectionPool(getSqlConfig()).connect();
  try {
    const markerResult = await pool.request().query<MarkerRow>(`
      SELECT
        [GerritChangeID], [Project], [Branch], [Subject], [MergedAt]
      FROM [dbo].[GerritChange]
      WHERE [Status] = 'MERGED'
        AND [MergedAt] IS NOT NULL
        AND (
          [Subject] LIKE '%Incrementing VERSION to %'
          OR [Subject] LIKE 'Updating trunk VERSION from % to %'
        )
      ORDER BY [Project], [Branch], [MergedAt], [GerritChangeID];
    `);

    const versions = buildVersions(markerResult.recordset);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await rebuildVersions(transaction, versions);
      await transaction.commit();
      console.log(
        `[gerrit-versions] markers=${markerResult.recordset.length} versions=${result.VersionCount} reassigned_changes=${result.AssignedChanges}`,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});