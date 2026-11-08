import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { db, pool } from "./index.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const legacyMigrationsDirectory = path.join(currentDirectory, "migrations");
const drizzleMigrationsDirectory = path.resolve(currentDirectory, "../../drizzle");

async function tableExists(qualifiedName) {
    const result = await pool.query("SELECT to_regclass($1) IS NOT NULL AS exists", [
        qualifiedName,
    ]);
    return result.rows[0].exists;
}

async function applyPendingLegacyMigrations() {
    const files = (await fs.readdir(legacyMigrationsDirectory))
        .filter((file) => file.endsWith(".sql"))
        .sort();

    for (const file of files) {
        const alreadyExecuted = await pool.query(
            "SELECT 1 FROM public.migrations WHERE name = $1",
            [file],
        );
        if (alreadyExecuted.rowCount > 0) continue;

        const sql = await fs.readFile(
            path.join(legacyMigrationsDirectory, file),
            "utf8",
        );
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query("INSERT INTO public.migrations (name) VALUES ($1)", [
                file,
            ]);
            await client.query("COMMIT");
            console.log(`Completed legacy migration ${file}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    const applied = await pool.query("SELECT name FROM public.migrations");
    const appliedNames = new Set(applied.rows.map(({ name }) => name));
    const unapplied = files.filter((file) => !appliedNames.has(file));
    if (unapplied.length > 0) {
        throw new Error(`Legacy migration history is incomplete: ${unapplied.join(", ")}`);
    }
}

async function validateExistingDrizzleHistory(
    migrations,
    { allowLegacyBaselineAdoption = false } = {},
) {
    if (!(await tableExists("drizzle.__drizzle_migrations"))) {
        return { exists: false, rows: [] };
    }

    const result = await pool.query(
        "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
    );
    const knownHashes = new Set(migrations.map(({ hash }) => hash));
    const unknownRows = result.rows.filter(({ hash }) => !knownHashes.has(hash));
    const baseline = migrations[0];
    const hasCurrentBaseline = result.rows.some(({ hash }) => hash === baseline?.hash);
    const canAdoptLegacyBaseline =
        allowLegacyBaselineAdoption &&
        migrations.length === 1 &&
        baseline &&
        (
            (result.rows.length === 1 &&
                unknownRows.length === 1 &&
                Number(unknownRows[0].created_at) < baseline.folderMillis) ||
            (result.rows.length === 2 &&
                hasCurrentBaseline &&
                unknownRows.length === 1 &&
                Number(unknownRows[0].created_at) < baseline.folderMillis)
        );

    if (unknownRows.length > 0) {
        if (!canAdoptLegacyBaseline) {
            throw new Error(
                "The Drizzle migration ledger contains an unrecognized history; refusing to alter it automatically.",
            );
        }
    }

    if (result.rows.length > 0 && !hasCurrentBaseline) {
        if (canAdoptLegacyBaseline) {
            return { exists: true, rows: result.rows, canAdoptLegacyBaseline: true };
        }
        throw new Error(
            "The database has a separate Drizzle history; inspect it before adopting the current baseline.",
        );
    }

    return { exists: true, rows: result.rows };
}

async function adoptLegacyDatabase(migrations) {
    const baseline = migrations[0];
    if (!baseline) throw new Error("Drizzle migration journal is empty");

    await pool.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
        )
    `);

    const applied = await validateExistingDrizzleHistory(migrations, {
        allowLegacyBaselineAdoption: true,
    });

    if (applied.rows.length === 0) {
        await pool.query(
            `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
             VALUES ($1, $2)`,
            [baseline.hash, baseline.folderMillis],
        );
    } else if (!applied.rows.some(({ hash }) => hash === baseline.hash)) {
        if (!applied.canAdoptLegacyBaseline) {
            throw new Error(
                "The legacy database has a separate Drizzle history; inspect it before adopting the current baseline.",
            );
        }
        await pool.query(
            `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
             VALUES ($1, $2)`,
            [baseline.hash, baseline.folderMillis],
        );
        console.log(
            "Adopted the current Drizzle baseline after validating the legacy migration history.",
        );
    }
}

async function runMigrations() {
    const migrations = readMigrationFiles({
        migrationsFolder: drizzleMigrationsDirectory,
    });
    const legacyHistoryExists = await tableExists("public.migrations");
    const applicationSchemaExists = await tableExists("public.users");
    const drizzleHistory = await validateExistingDrizzleHistory(migrations, {
        allowLegacyBaselineAdoption: legacyHistoryExists && applicationSchemaExists,
    });

    if (legacyHistoryExists) {
        if (drizzleHistory.exists && drizzleHistory.rows.length === 0) {
            throw new Error(
                "The legacy database has an empty Drizzle ledger; inspect it before migration.",
            );
        }
        await applyPendingLegacyMigrations();
        await adoptLegacyDatabase(migrations);
    } else if (applicationSchemaExists) {
        if (!drizzleHistory.exists || drizzleHistory.rows.length === 0) {
            throw new Error(
                "An existing application schema has no applied migration history; refusing to replay the Drizzle baseline.",
            );
        }
    }

    await migrate(db, { migrationsFolder: drizzleMigrationsDirectory });
    console.log("Drizzle migrations are up to date.");
}

try {
    await runMigrations();
} catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
