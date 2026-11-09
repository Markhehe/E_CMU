import { useEffect, useRef, useState } from 'react';
import { StudentDirectoryService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/dashboard.css';
import '../../styles/registrarStudents.css';

const PAGE_SIZE = 50;

export default function RegistrarStudentDirectory() {
  const [records, setRecords] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [studentIdPrefix, setStudentIdPrefix] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyStudentId, setBusyStudentId] = useState(null);
  const [isSuspendingPrefix, setIsSuspendingPrefix] = useState(false);
  const latestRequestId = useRef(0);
  const { addToast } = useToast();

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    StudentDirectoryService.list({ search, page })
      .then((result) => {
        if (requestId !== latestRequestId.current) return;
        setRecords(result.records);
        setTotal(result.total);
      })
      .catch((error) => {
        if (requestId !== latestRequestId.current) return;
        setErrorMessage(error.message || 'Unable to load the student directory.');
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });

    return () => {
      latestRequestId.current += 1;
    };
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRecord = Math.min(page * PAGE_SIZE, total);

  const submitSearch = (event) => {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    if (nextSearch === search && page === 1) return;
    setIsLoading(true);
    setErrorMessage('');
    setPage(1);
    setSearch(nextSearch);
  };

  const changePage = (nextPage) => {
    setIsLoading(true);
    setErrorMessage('');
    setPage(nextPage);
  };

  const setStudentAccountActive = async (record) => {
    const active = !record.accountActive;
    setBusyStudentId(record.studentId);
    try {
      const { account } = await StudentDirectoryService.setAccountActive(record.studentId, active);
      setRecords((current) => current.map((item) => (
        item.studentId === record.studentId
          ? { ...item, ...account }
          : item
      )));
      addToast(
        active ? 'Student account restored.' : 'Student account suspended.',
        'success',
      );
    } catch (error) {
      addToast(error.message || 'Unable to update the student account.', 'error');
    } finally {
      setBusyStudentId(null);
    }
  };

  const suspendAccountsByPrefix = async (event) => {
    event.preventDefault();
    const prefix = studentIdPrefix.trim();
    if (!/^\d{4}$/.test(prefix) || isSuspendingPrefix) return;
    if (!window.confirm(
      `Suspend all active, verified student accounts whose IDs start with ${prefix}?`,
    )) return;

    setIsSuspendingPrefix(true);
    try {
      const result = await StudentDirectoryService.suspendAccountsByPrefix(prefix);
      setRecords((current) => current.map((record) => (
        record.studentId.startsWith(prefix) && record.hasAccount && record.emailVerified
          ? { ...record, accountActive: false }
          : record
      )));
      addToast(
        `Suspended ${result.suspended} student ${result.suspended === 1 ? 'account' : 'accounts'} starting with ${prefix}.`,
        'success',
      );
    } catch (error) {
      addToast(error.message || 'Unable to suspend student accounts.', 'error');
    } finally {
      setIsSuspendingPrefix(false);
    }
  };

  return (
    <div className="dashboard-page student-records-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Student Directory</h1>
        <p className="dashboard-subtext">
          Browse the directory used to verify student registrations.
        </p>
      </header>

      <form className="table-toolbar student-records-toolbar" role="search" onSubmit={submitSearch}>
        <input
          type="search"
          className="toolbar-input"
          value={searchInput}
          maxLength={120}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by student ID or name"
          aria-label="Search student directory"
        />
        <button type="submit" className="btn-primary">Search</button>
      </form>

      <form className="student-directory-prefix-form" onSubmit={suspendAccountsByPrefix}>
        <label htmlFor="student-id-prefix">Suspend accounts by ID prefix</label>
        <input
          id="student-id-prefix"
          className="toolbar-input"
          value={studentIdPrefix}
          onChange={(event) => setStudentIdPrefix(event.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="First 4 digits"
          aria-describedby="student-id-prefix-help"
        />
        <span id="student-id-prefix-help" className="dashboard-subtext">
          Suspends all active, verified student accounts whose IDs start with these four digits.
        </span>
        <button
          type="submit"
          className="btn-secondary"
          disabled={!/^\d{4}$/.test(studentIdPrefix) || isSuspendingPrefix}
        >
          {isSuspendingPrefix ? 'Suspending...' : 'Suspend matching accounts'}
        </button>
      </form>

      <section className="student-records-section" aria-labelledby="student-directory-heading">
        <div className="student-records-section-heading">
          <div>
            <h2 id="student-directory-heading" className="settings-section-title">
              Directory Records
            </h2>
            <p className="dashboard-subtext">
              {isLoading ? 'Loading records…' : `${total.toLocaleString()} students`}
            </p>
          </div>
        </div>

        <div
          className="request-table-wrapper student-records-table student-directory-table"
          role="region"
          aria-label="Student directory records"
          aria-busy={isLoading}
          tabIndex={0}
        >
          <table className="request-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Birthdate</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}>Loading student directory...</td></tr>
              ) : errorMessage ? (
                <tr><td colSpan={7} role="alert">{errorMessage}</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    {search ? 'No directory records match your search.' : 'The student directory is empty.'}
                  </td>
                </tr>
              ) : records.map((record) => (
                <tr key={record.studentId}>
                  <td>{record.studentId}</td>
                  <td>{record.firstName}</td>
                  <td>{record.middleName || '—'}</td>
                  <td>{record.lastName}</td>
                  <td>{record.birthdate}</td>
                  <td className="student-directory-account-status">
                    {!record.hasAccount
                      ? 'No account'
                      : !record.emailVerified
                        ? 'Pending verification'
                        : record.accountActive
                          ? 'Active'
                          : 'Suspended'}
                  </td>
                  <td>
                    {record.hasAccount && record.emailVerified && (
                      <button
                        type="button"
                        className={`workflow-step-button${record.accountActive ? ' workflow-action-button-danger text-danger' : ''}`}
                        disabled={busyStudentId === record.studentId}
                        onClick={() => void setStudentAccountActive(record)}
                      >
                        {busyStudentId === record.studentId
                          ? 'Saving...'
                          : record.accountActive
                            ? 'Suspend account'
                            : 'Restore account'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="student-records-section-heading" aria-label="Directory pagination">
          <p className="dashboard-subtext">
            Showing {firstRecord}–{lastRecord} of {total.toLocaleString()}
          </p>
          <div className="student-directory-pagination">
            <button
              type="button"
              className="btn-secondary"
              disabled={isLoading || page <= 1}
              onClick={() => changePage(Math.max(1, page - 1))}
            >
              Previous
            </button>
            <span className="dashboard-subtext">Page {page} of {totalPages}</span>
            <button
              type="button"
              className="btn-secondary"
              disabled={isLoading || page >= totalPages}
              onClick={() => changePage(Math.min(totalPages, page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
