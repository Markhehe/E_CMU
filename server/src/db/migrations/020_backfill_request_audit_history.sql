INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT
    history.changed_by,
    CASE
        WHEN history.from_status IS NULL THEN 'request.created'
        ELSE 'request.status_changed'
    END,
    'request',
    history.request_id::text,
    jsonb_build_object(
        'fromStatus', history.from_status,
        'toStatus', history.to_status,
        'displayCode', request.display_code,
        'source', 'history_backfill'
    ),
    history.created_at
FROM request_status_history AS history
INNER JOIN requests AS request ON request.id = history.request_id
WHERE (
    history.from_status IS NULL
    OR history.from_status IS DISTINCT FROM history.to_status
)
AND NOT EXISTS (
    SELECT 1
    FROM audit_logs AS existing
    WHERE existing.entity_type = 'request'
      AND existing.entity_id = history.request_id::text
      AND existing.actor_id IS NOT DISTINCT FROM history.changed_by
      AND existing.action = CASE
          WHEN history.from_status IS NULL THEN 'request.created'
          ELSE 'request.status_changed'
      END
      AND existing.created_at BETWEEN
          history.created_at - INTERVAL '5 seconds'
          AND history.created_at + INTERVAL '5 seconds'
      AND (
          history.from_status IS NULL
          OR (
              existing.metadata->>'fromStatus' IS NOT DISTINCT FROM history.from_status
              AND existing.metadata->>'toStatus' = history.to_status
          )
      )
);
