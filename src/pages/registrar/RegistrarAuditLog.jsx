import { useCallback, useEffect, useRef, useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { AuditLogService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import RequestPagination from '../../components/ui/RequestPagination';
import '../../styles/auditLog.css';

const PAGE_SIZE = 25;

const INITIAL_FILTERS = {
  from: '',
  to: '',
  actor: '',
  action: '',
  entityType: '',
  entityId: '',
};

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

function getExportTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date;
}

const ACTION_LABELS = {
  'request.created': 'Request submitted',
  'request.deleted': 'Request deleted',
  'request.status_changed': 'Request status updated',
  'request.reviewed': 'Request reviewed',
  'request.assigned': 'Request assigned',
  'request.payment_method_changed': 'Payment method changed',
  'request.comment_added': 'Comment added',
  'request.comment_deleted': 'Comment deleted',
  'payment_proof.submitted': 'Payment documents submitted',
  'payment_proof.rejected': 'Payment documents rejected',
  'payment.recorded': 'Payment recorded',
  'clearance.submitted': 'Clearance submitted',
  'clearance.reviewed': 'Clearance reviewed',
  'clearance.invalidated': 'Clearance invalidated',
  'registrar_staff.created': 'Registrar account created',
  'registrar_staff.suspended': 'Registrar account suspended',
  'registrar_staff.restored': 'Registrar account restored',
  'student_account.suspended': 'Student account suspended',
  'student_account.restored': 'Student account restored',
  'student_accounts.bulk_suspended': 'Student accounts suspended in bulk',
  'student_directory.imported': 'Student records imported',
};

const METADATA_LABELS = {
  active: 'Account status',
  amount: 'Amount',
  assignedTo: 'Assigned staff ID',
  count: 'Number of accounts',
  currency: 'Currency',
  decision: 'Decision',
  displayCode: 'Request number',
  fromStatus: 'Previous status',
  inserted: 'Records added',
  method: 'Payment method',
  skipped: 'Records skipped',
  source: 'Submitted via',
  stage: 'Review stage',
  status: 'Status',
  toStatus: 'New status',
  visibility: 'Comment visibility',
};

const STATUS_LABELS = {
  clearance_review: 'Awaiting clearance review',
  fulfilled: 'Completed',
  needs_information: 'More information needed',
  overdue: 'Overdue',
  on_hold: 'On hold',
  paid: 'Paid',
  pending_payment: 'Awaiting payment',
  pending_review: 'Awaiting review',
  processing: 'Being processed',
  ready_for_pickup: 'Ready for pickup',
  rejected: 'Rejected',
  submitted: 'Submitted',
  verified: 'Verified',
};

function humanize(value) {
  const text = String(value).replaceAll('_', ' ').replaceAll('.', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatValue(key, value, metadata = {}) {
  if (key === 'fromStatus' && value === null) return 'New request';
  if (key === 'active') return value ? 'Active' : 'Suspended';
  if (key === 'source') {
    if (value === 'history_backfill') return 'Recovered from request history';
    return value === 'walk_in' ? 'Registrar walk-in' : 'Student portal';
  }
  if (key === 'visibility') {
    return value === 'requester' ? 'Visible to student' : 'Staff only';
  }
  if (key === 'amount' && Number.isFinite(Number(value))) {
    return `${metadata.currency || 'PHP'} ${Number(value).toFixed(2)}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    return STATUS_LABELS[value] || humanize(value);
  }
  if (value === null) return 'None';
  return String(value);
}

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
    return '—';
  }
  const details = [];
  const fromStatus = metadata.fromStatus;
  const toStatus = metadata.toStatus;

  if (fromStatus !== undefined || toStatus !== undefined) {
    details.push(
      fromStatus === null || fromStatus === undefined
        ? `Initial status: ${formatValue('toStatus', toStatus)}`
        : `Status: ${formatValue('fromStatus', fromStatus)} → ${formatValue('toStatus', toStatus)}`,
    );
  }

  Object.entries(metadata).forEach(([key, value]) => {
    if (['fromStatus', 'toStatus', 'displayCode', 'source'].includes(key)) return;
    const label = METADATA_LABELS[key] || humanize(key);
    details.push(`${label}: ${formatValue(key, value, metadata)}`);
  });

  if (metadata.source) {
    details.push(formatValue('source', metadata.source));
  }

  return details.length ? details.join(' · ') : '—';
}

function createAuditLogWorkbook(entries, filters, pagination) {
  const exportDate = new Date();
  const filterSummary = [
    filters.from && `From: ${filters.from}`,
    filters.to && `To: ${filters.to}`,
    filters.actor && `Performed by: ${filters.actor}`,
    filters.action && `Action: ${filters.action}`,
    filters.entityType && `Record: ${filters.entityType}`,
    filters.entityId && `Record ID: ${filters.entityId}`,
  ].filter(Boolean).join('  |  ') || 'No filters applied';
  const titleStyle = {
    backgroundColor: '#17365d',
    textColor: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    height: 38,
    alignVertical: 'center',
  };
  const headerStyle = {
    backgroundColor: '#24476b',
    textColor: '#ffffff',
    fontWeight: 'bold',
    wrap: true,
    height: 30,
    alignVertical: 'center',
    bottomBorderColor: '#17365d',
    bottomBorderStyle: 'medium',
  };
  const rows = [
    [{ value: 'ECMU | AUDIT LOG REPORT', columnSpan: 5, ...titleStyle }],
    [{
      value: `Page ${pagination.page} of ${pagination.totalPages}  •  ${entries.length} records  •  Exported ${exportDate.toLocaleString()}`,
      columnSpan: 5,
      backgroundColor: '#eaf0f6',
      textColor: '#44546a',
      fontSize: 10,
      height: 24,
      alignVertical: 'center',
    }],
    [{ value: '', columnSpan: 5, height: 8 }],
    [{
      value: `Applied filters: ${filterSummary}`,
      columnSpan: 5,
      textColor: '#596579',
      fontSize: 10,
      fontStyle: 'italic',
      wrap: true,
      height: 30,
      alignVertical: 'center',
    }],
    [{ value: '', columnSpan: 5, height: 8 }],
    [
      { value: 'Date and time', ...headerStyle },
      { value: 'Performed by', ...headerStyle },
      { value: 'What happened', ...headerStyle },
      { value: 'Record', ...headerStyle },
      { value: 'Details', ...headerStyle },
    ],
    ...entries.map((entry, index) => {
      const backgroundColor = index % 2 === 0 ? '#f3f6fa' : '#ffffff';
      const cellStyle = {
        backgroundColor,
        textColor: '#263445',
        wrap: true,
        alignVertical: 'top',
        height: 30,
        bottomBorderColor: '#d9e1ea',
        bottomBorderStyle: 'thin',
      };
      return [
        { value: getExportTimestamp(entry.createdAt), format: 'yyyy-mm-dd hh:mm', ...cellStyle },
        {
          value: [entry.actorName || 'Automatic system action', entry.actorEmail].filter(Boolean).join('\n'),
          ...cellStyle,
        },
        { value: ACTION_LABELS[entry.action] || humanize(entry.action), ...cellStyle },
        {
          value: `${humanize(entry.entityType)}\n${entry.displayCode || entry.entityId}`,
          ...cellStyle,
        },
        { value: formatMetadata(entry.metadata), ...cellStyle },
      ];
    }),
  ];

  return writeExcelFile(rows, {
    sheet: 'Audit Log',
    orientation: 'landscape',
    showGridLines: false,
    stickyRowsCount: 6,
    columns: [
      { width: 22 },
      { width: 32 },
      { width: 30 },
      { width: 26 },
      { width: 58 },
    ],
  }, {
    fontFamily: 'Aptos',
    fontSize: 10,
  });
}

export default function RegistrarAuditLog() {
  const { addToast } = useToast();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const requestSequence = useRef(0);

  const loadEntries = useCallback(async (page) => {
    const sequence = ++requestSequence.current;
    try {
      const result = await AuditLogService.list({
        ...appliedFilters,
        page,
        pageSize: PAGE_SIZE,
      });
      if (sequence !== requestSequence.current) return;
      setEntries(result.entries || []);
      setPagination(result.pagination);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      addToast(error.message || 'Failed to load audit logs.', 'error');
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [addToast, appliedFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadEntries(pagination.page), 0);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [loadEntries, pagination.page]);

  const updateFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      addToast('Start date must not be after end date.', 'error');
      return;
    }
    setIsLoading(true);
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters({ ...filters });
  };

  const changePage = (page) => {
    setIsLoading(true);
    setPagination((current) => ({ ...current, page }));
  };

  const downloadExcel = async () => {
    try {
      const blob = await createAuditLogWorkbook(entries, appliedFilters, pagination).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-page-${pagination.page}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      addToast(error.message || 'Failed to export audit logs.', 'error');
    }
  };

  return (
    <div className="dashboard-page audit-log-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Audit Log</h1>
        <p className="dashboard-subtext">
          Review account, clearance, and document-request submissions and changes.
          Sensitive credentials and uploaded files are not included.
        </p>
      </header>

      <form className="audit-log-filters" onSubmit={applyFilters}>
        <label>
          <span>From</span>
          <input type="date" value={filters.from} onChange={updateFilter('from')} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={filters.to} onChange={updateFilter('to')} />
        </label>
        <label>
          <span>Performed by</span>
          <input
            type="search"
            value={filters.actor}
            onChange={updateFilter('actor')}
            placeholder="Name or email"
            maxLength={120}
          />
        </label>
        <label>
          <span>Action</span>
          <input
            type="search"
            value={filters.action}
            onChange={updateFilter('action')}
            placeholder="Search actions"
            maxLength={120}
          />
        </label>
        <label>
          <span>Record</span>
          <input
            type="search"
            value={filters.entityType}
            onChange={updateFilter('entityType')}
            placeholder="e.g. Request"
            maxLength={80}
          />
        </label>
        <label>
          <span>Record ID</span>
          <input
            type="search"
            value={filters.entityId}
            onChange={updateFilter('entityId')}
            placeholder="Request or account ID"
            maxLength={120}
          />
        </label>
        <div className="audit-log-filter-actions">
          <button type="submit" className="btn-primary">Apply filters</button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFilters(INITIAL_FILTERS);
              setIsLoading(true);
              setPagination((current) => ({ ...current, page: 1 }));
              setAppliedFilters(INITIAL_FILTERS);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      <div className="audit-log-results-summary">
        <div className="audit-log-summary" aria-live="polite">
          {isLoading
            ? 'Loading audit entries…'
            : `${pagination.total} audit entries · Page ${pagination.page} of ${pagination.totalPages}`}
        </div>
        <button
          type="button"
          className="btn-secondary audit-log-export"
          onClick={downloadExcel}
          disabled={isLoading || entries.length === 0}
        >
          Download current page (.xlsx)
        </button>
      </div>

      <div className="audit-log-table-wrapper">
        <table className="audit-log-table">
          <thead>
            <tr>
              <th>Date and time</th>
              <th>Performed by</th>
              <th>What happened</th>
              <th>Record</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="audit-log-empty">Loading audit entries…</td></tr>
            ) : entries.length ? entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatTimestamp(entry.createdAt)}</td>
                <td>
                  <strong>{entry.actorName || 'Automatic system action'}</strong>
                  {entry.actorEmail && <small>{entry.actorEmail}</small>}
                </td>
                <td>{ACTION_LABELS[entry.action] || humanize(entry.action)}</td>
                <td>
                  <strong>{humanize(entry.entityType)}</strong>
                  <small>{entry.displayCode || entry.entityId}</small>
                </td>
                <td className="audit-log-metadata">{formatMetadata(entry.metadata)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="audit-log-empty">
                  No audit entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && pagination.total > 0 && (
        <RequestPagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          requestsPerPage={pagination.pageSize}
          totalRequests={pagination.total}
          onPageChange={changePage}
        />
      )}
    </div>
  );
}
