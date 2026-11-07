import StatusBadge from './StatusBadge';

function formatEta(etaAt) {
  if (!etaAt) return null;
  const date = new Date(etaAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function StudentActiveDocumentsPanel({ requests, onViewDetails, onViewOverdue }) {
  const activeRequests = requests.filter(
    (request) => !['fulfilled', 'rejected'].includes(request.rawStatus),
  );

  return (
    <section className="student-active-documents card-ui" aria-labelledby="student-active-documents-title">
      <div className="student-active-documents-heading">
        <h2 id="student-active-documents-title" className="settings-section-title">
          Active Documents
        </h2>
        <span className="student-active-documents-count">{activeRequests.length}</span>
      </div>
      {activeRequests.length === 0 ? (
        <p className="dashboard-subtext">Your active document requests will appear here.</p>
      ) : (
        <ul className="student-active-documents-list">
          {activeRequests.map((request) => {
            const showEta = !['ready_for_pickup', 'ready_for_retrieval', 'ready']
              .includes(request.rawStatus);

            return (
              <li
                key={request.id}
                className={`student-active-document${request.rawStatus === 'overdue' ? ' is-overdue' : ''}`}
              >
                <button
                  type="button"
                  className="student-active-document-main"
                  onClick={() => request.rawStatus === 'overdue'
                    ? onViewOverdue(request)
                    : onViewDetails(request)}
                >
                  <strong>{request.docType}</strong>
                  <StatusBadge status={request.status} />
                  {showEta && request.etaAt && (
                    <span className="student-active-document-eta">
                      Estimated availability: {formatEta(request.etaAt)}
                    </span>
                  )}
                  {showEta && request.etaUpdateRequestedAt && (
                    <span className="student-active-document-eta">
                      ETA update requested
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="student-active-document-details"
                  aria-label={`View details for ${request.docType}, request ${request.displayId}`}
                  title="View request details"
                  onClick={() => onViewDetails(request)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5m0-8h.01" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default StudentActiveDocumentsPanel;
