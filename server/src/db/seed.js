import { pool } from "./pool.js";

await pool.query(`
    INSERT INTO roles (name) VALUES
    ('requester'), ('processor'), ('finance'), ('administrator')
    ON CONFLICT (name) DO NOTHING;
    INSERT INTO document_types (name, description, base_fee, currency, processing_
    VALUES
    ('Transcript', 'Official academic transcript', 10.00, 'USD', 5),
    ('Certificate', 'Official certificate of enrollment or completion', 8.00, 'U
    ON CONFLICT (name) DO NOTHING;
`);
await pool.end();
