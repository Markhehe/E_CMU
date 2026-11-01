import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const migrationsDirectory = path.join(currentDirectory, "migrations");

await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`);

const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

for (const file of files) {
    const alreadyExecuted = await pool.query(
        "SELECT 1 FROM migrations WHERE name = $1",
        [file]
    );
<<<<<<< HEAD
    
    if (alreadyExecuted.rowCount > 0) continue;
    
    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    const client = await pool.connect();
    
=======

    if (alreadyExecuted.rowCount > 0) continue;

    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    const client = await pool.connect();

>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Executed ${file}`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
await pool.end();
