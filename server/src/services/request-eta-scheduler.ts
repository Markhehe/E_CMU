import { pool } from "../db/index.js";

const overdueCheckIntervalMs = 60_000;

async function markOverdueRequests() {
  try {
    await pool.query(`
      WITH overdue_requests AS (
        UPDATE requests
        SET status = 'overdue', updated_at = NOW()
        WHERE status = 'processing'
          AND eta_at IS NOT NULL
          AND eta_at <= NOW()
        RETURNING id, requester_id, display_code
      ),
      inserted_history AS (
        INSERT INTO request_status_history
          (request_id, from_status, to_status, changed_by, comment)
        SELECT id, 'processing', 'overdue', NULL,
               'Estimated availability time passed before request was marked ready'
        FROM overdue_requests
        RETURNING request_id
      )
      INSERT INTO notifications
        (user_id, request_id, channel, type, title, message)
      SELECT requester_id, id, 'in_app', 'document_overdue',
             'Document is overdue',
             'Your document request ' || display_code ||
               ' is overdue. Open your dashboard to request an ETA update.'
      FROM overdue_requests
    `);
  } catch (error) {
    console.error("Unable to mark overdue document requests.", error);
  } finally {
    setTimeout(markOverdueRequests, overdueCheckIntervalMs);
  }
}

export function startRequestEtaScheduler() {
  void markOverdueRequests();
}
