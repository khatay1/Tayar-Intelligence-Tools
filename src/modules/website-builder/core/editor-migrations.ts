import { parseEditorSnapshot, serializeEditorSnapshot, type EditorPersistenceResult } from './editor-persistence';

export interface EditorMigration<T> {
  fromVersion: number;
  toVersion: number;
  migrate: (value: unknown) => T;
}

export interface EditorMigrationResult<T> extends EditorPersistenceResult<T> {
  sourceVersion?: number;
  migrated?: boolean;
  serialized?: string;
}

function readSchemaVersion(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
    const version = Number(parsed?.schemaVersion);
    return Number.isInteger(version) && version > 0 ? version : undefined;
  } catch {
    return undefined;
  }
}

export function migrateEditorSnapshot<T>(
  raw: string | null | undefined,
  targetVersion: number,
  migrations: EditorMigration<T>[],
): EditorMigrationResult<T> {
  if (!raw) return { ok: false, error: 'No saved editor snapshot' };
  const sourceVersion = readSchemaVersion(raw);
  if (!sourceVersion) return { ok: false, error: 'Editor snapshot schema is invalid' };

  if (sourceVersion === targetVersion) {
    const direct = parseEditorSnapshot<T>(raw, targetVersion);
    return { ...direct, sourceVersion, migrated: false };
  }

  const source = parseEditorSnapshot<unknown>(raw, sourceVersion);
  if (!source.ok) {
    return {
      ok: false,
      error: source.error || 'Editor snapshot could not be read',
      savedAt: source.savedAt,
      sourceVersion,
      migrated: false,
    };
  }
  if (sourceVersion > targetVersion) {
    return {
      ok: false,
      error: `Editor snapshot is newer than this editor (${sourceVersion} > ${targetVersion})`,
      sourceVersion,
      migrated: false,
    };
  }

  let currentVersion = sourceVersion;
  let value: unknown = source.value;
  const ordered = migrations.slice().sort((left, right) => left.fromVersion - right.fromVersion);

  while (currentVersion < targetVersion) {
    const migration = ordered.find((candidate) => candidate.fromVersion === currentVersion);
    if (!migration || migration.toVersion <= currentVersion) {
      return {
        ok: false,
        error: `Missing editor migration from schema ${currentVersion}`,
        sourceVersion,
        migrated: false,
      };
    }
    try {
      value = migration.migrate(value);
      currentVersion = migration.toVersion;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : `Editor migration ${currentVersion} failed`,
        sourceVersion,
        migrated: false,
      };
    }
  }

  if (currentVersion !== targetVersion) {
    return {
      ok: false,
      error: `Editor migrations ended at schema ${currentVersion}, expected ${targetVersion}`,
      sourceVersion,
      migrated: false,
    };
  }

  const serialized = serializeEditorSnapshot(value as T, targetVersion);
  return {
    ok: true,
    value: value as T,
    sourceVersion,
    migrated: true,
    serialized,
  };
}
