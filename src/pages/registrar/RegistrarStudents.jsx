import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOverlayScrollbars } from 'overlayscrollbars-react';
import { useServerEvents } from '../../hooks/useServerEvents';
import { ClearanceService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ClearancePreviewModal from '../../components/ui/ClearancePreviewModal';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge'; // Added StatusBadge
import { scrollbarOptions } from '../../utils/scrollbarOptions';
import '../../styles/dashboard.css';
import '../../styles/registrarStudents.css';

// Replaced raw displayStatus with our standardized StatusBadge component below.

function RegistrarStudents() {
  const location = useLocation();
  const navigate = useNavigate(); // Added for state cleanup
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [previewingClearance, setPreviewingClearance] = useState(null);
  const [clearanceToInvalidate, setClearanceToInvalidate] = useState(null);
  const [invalidationReason, setInvalidationReason] = useState('');
  const invalidationLimitNotified = useRef(false);
  const [isInvalidating, setIsInvalidating] = useState(false);
  
  const { addToast } = useToast();
  const latestSearchId = useRef(0);
  const latestProfileId = useRef(0);
  const tableWrapperRef = useRef(null);
  
  const [initializeScrollbars] = useOverlayScrollbars({
    options: {
      ...scrollbarOptions,
      overflow: { x: 'scroll', y: 'scroll' },
    },
    defer: true,
  });

  const clearSelectedStudent = useCallback(() => {
    latestProfileId.current += 1;
    setSelectedStudent(null);
    setIsLoadingProfile(false);
  }, []);

  // --- REPLACED WINDOW LISTENER WITH ROUTER STATE ---
  useEffect(() => {
    if (location.state?.action === 'show-list') {
      clearSelectedStudent();
      
      // Clean up the location state so a simple page reload doesn't keep triggering this
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, clearSelectedStudent]);
  // --------------------------------------------------

  const loadStudents = useCallback(async (searchTerm) => {
    const searchId = ++latestSearchId.current;
    setIsSearching(true);
    setStudents([]);
    setActiveSearchTerm(searchTerm);
    setSearchError('');
    clearSelectedStudent();
    try {
      const results = await ClearanceService.searchStudents(searchTerm);
      if (searchId === latestSearchId.current) setStudents(results);
    } catch (error) {
      if (searchId === latestSearchId.current) {
        const message = error.message || 'Failed to search students.';
        setSearchError(message);
        addToast(message, 'error');
      }
    } finally {
      if (searchId === latestSearchId.current) setIsSearching(false);
    }
  }, [addToast, clearSelectedStudent]);

  useEffect(() => {
    const searchId = ++latestSearchId.current;
    const loadInitialStudents = async () => {
      try {
        const results = await ClearanceService.searchStudents('');
        if (searchId === latestSearchId.current) setStudents(results);
      } catch (error) {
        if (searchId === latestSearchId.current) {
          const message = error.message || 'Failed to load student records.';
          setSearchError(message);
          addToast(message, 'error');
        }
      } finally {
        if (searchId === latestSearchId.current) setIsSearching(false);
      }
    };
    loadInitialStudents();
    return () => {
      latestSearchId.current += 1;
    };
  }, [addToast]);

  const searchStudents = async (event) => {
    event.preventDefault();
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      addToast('Enter at least 2 characters to search by student name or ID.', 'error');
      return;
    }
    await loadStudents(searchTerm);
  };

  const openStudent = useCallback(async (studentId, { showLoading = true } = {}) => {
    const profileId = ++latestProfileId.current;
    if (showLoading) {
      setIsLoadingProfile(true);
      setSelectedStudent(null);
    }
    try {
      const profile = await ClearanceService.getStudentProfile(studentId);
      if (profileId === latestProfileId.current) setSelectedStudent(profile);
    } catch (error) {
      if (profileId === latestProfileId.current) {
        addToast(error.message || 'Failed to load student details.', 'error');
      }
    } finally {
      if (showLoading && profileId === latestProfileId.current) setIsLoadingProfile(false);
    }
  }, [addToast]);

  useEffect(() => {
    const studentIdentifier = location.state?.studentRecordIdentifier;
    if (!studentIdentifier) return undefined;

    const timeoutId = window.setTimeout(() => openStudent(studentIdentifier), 0);
    return () => window.clearTimeout(timeoutId);
  }, [location.key, location.state, openStudent]);

  const student = selectedStudent?.student;
  const refreshSelectedStudent = useCallback(() => {
    const studentIdentifier = student?.student_id || student?.email;
    if (studentIdentifier) openStudent(studentIdentifier, { showLoading: false });
  }, [openStudent, student?.email, student?.student_id]);
  
  useServerEvents(['requests', 'clearances'], refreshSelectedStudent, Boolean(student));

  const currentClearance = selectedStudent?.clearances.find((clearance) => clearance.is_current);
  const fullName = student
    ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
    : '';

  useEffect(() => {
    if (tableWrapperRef.current) initializeScrollbars(tableWrapperRef.current);
  }, [initializeScrollbars]);

  const closeInvalidationDialog = () => {
    if (isInvalidating) return;
    setClearanceToInvalidate(null);
    setInvalidationReason('');
  };

  const confirmInvalidation = async (event) => {
    event.preventDefault();
    const reason = invalidationReason.trim();
    if (!clearanceToInvalidate || !reason) return;

    setIsInvalidating(true);
    try {
      const result = await ClearanceService.invalidate(clearanceToInvalidate.id, reason);
      setSelectedStudent((current) => current && ({
        ...current,
        clearances: current.clearances.map((clearance) => (
          clearance.id === result.clearance.id
            ? {
              ...clearance,
              status: result.clearance.status,
              comment: result.clearance.comment,
              reviewed_at: result.clearance.reviewed_at,
            }
            : clearance
        )),
      }));
      addToast('Current clearance invalidated. The student must submit an updated copy.', 'success');
      setClearanceToInvalidate(null);
      setInvalidationReason('');
    } catch (error) {
      addToast(error.message || 'Failed to invalidate clearance.', 'error');
    } finally {
      setIsInvalidating(false);
    }
  };

  return (
    <div className="dashboard-page student-records-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Student Records</h1>
        <p className="dashboard-subtext">
          Browse the first 25 student records or search by name, ID, or university email to review student details, clearance history, and document requests.
        </p>
      </header>

      {!selectedStudent && !isLoadingProfile && (
        <>
          <form onSubmit={searchStudents} className="table-toolbar student-records-toolbar" role="search">
            <input
              type="search"
              className="toolbar-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name (typos supported), student ID, or email"
              aria-label="Search students by name with typo tolerance, ID, or university email"
              minLength={2}
              maxLength={100}
              disabled={isSearching}
            />
            <button type="submit" className="btn-primary" disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <section className="student-records-section" aria-labelledby="student-list-heading">
            <div className="student-records-section-heading">
              <div>
                <h2 id="student-list-heading" className="settings-section-title">
                  {activeSearchTerm ? 'Search Results' : 'Students'}
                </h2>
                <p className="dashboard-subtext">
                  {activeSearchTerm
                    ? `${students.length} ${students.length === 1 ? 'student' : 'students'} found`
                    : 'Showing up to 25 student records'}
                </p>
              </div>
            </div>
            <div
              ref={tableWrapperRef}
              className="request-table-wrapper student-records-table"
              role="region"
              aria-label="Student records"
              aria-busy={isSearching}
              tabIndex={0}
            >
              <table className="request-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student ID</th>
                    <th>Email</th>
                    <th className="student-records-action-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isSearching ? (
                    <tr><td colSpan={4}>Loading student records...</td></tr>
                  ) : searchError ? (
                    <tr><td colSpan={4} role="alert">{searchError}</td></tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        {activeSearchTerm.length >= 2
                          ? 'No students found matching that name, ID, or email.'
                          : 'No student records are available.'}
                      </td>
                    </tr>
                  ) : students.map((result) => (
                    <tr key={result.id}>
                      <td><strong>{result.full_name}</strong></td>
                      <td>{result.student_id || '—'}</td>
                      <td>{result.email}</td>
                      <td className="student-records-action-cell">
                        <button
                          type="button"
                          className="workflow-step-button workflow-action-button student-records-view-button"
                          disabled={isLoadingProfile}
                          onClick={() => openStudent(result.student_id || result.email)}
                          aria-label={`View ${result.full_name}'s student record`}
                        >
                          View record
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {isLoadingProfile && <p className="student-records-loading" role="status">Loading student record...</p>}

      {student && (
        <>
          <button
            type="button"
            className="student-records-back-button"
            onClick={clearSelectedStudent}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
              <path d="M20 12H9" />
            </svg>
            <span>Back to dashboard</span>
          </button>
          <section className="card-ui student-records-profile" aria-labelledby="student-profile-heading">
            <div className="student-records-section-heading">
              <div>
                <h2 id="student-profile-heading" className="settings-section-title">{fullName || student.full_name}</h2>
                <p className="dashboard-subtext">Student profile</p>
              </div>
            </div>
            <dl className="student-records-profile-grid">
              <div><dt>Student ID</dt><dd>{student.student_id || '—'}</dd></div>
              <div><dt>Email</dt><dd>{student.email || '—'}</dd></div>
              <div><dt>Birthdate</dt><dd>{student.birthdate ? new Date(`${student.birthdate}T00:00:00`).toLocaleDateString() : '—'}</dd></div>
              <div><dt>Contact phone</dt><dd>{student.contact_phone || '—'}</dd></div>
              <div><dt>Contact address</dt><dd>{student.contact_address || '—'}</dd></div>
              <div><dt>Account created</dt><dd>{student.created_at ? new Date(student.created_at).toLocaleString() : '—'}</dd></div>
              <div><dt>Account status</dt><dd>{student.active ? 'Active' : 'Inactive'}</dd></div>
              <div><dt>Email verified</dt><dd>{student.email_verified ? 'Yes' : 'No'}</dd></div>
            </dl>
          </section>

          <section className="card-ui student-records-history">
            <h2 className="settings-section-title">Current Clearance</h2>
            {currentClearance ? (
              <div className="student-current-clearance">
                <div className="student-current-clearance-details">
                  <span className="student-current-clearance-label">Status</span>
                  {/* UX Upgrade: Replaced raw text with our semantic StatusBadge */}
                  <StatusBadge status={currentClearance.status} />
                  
                  <span className="doc-meta" style={{ marginLeft: '8px' }}>
                    Submitted {new Date(currentClearance.submitted_at).toLocaleString()}
                  </span>
                  {currentClearance.comment && (
                    <p className="student-current-clearance-comment">
                      Registrar note: {currentClearance.comment}
                    </p>
                  )}
                </div>
                <div className="student-current-clearance-actions">
                  <button
                    type="button"
                    className="workflow-step-button student-records-view-button"
                    onClick={() => setPreviewingClearance(currentClearance)}
                  >
                    View clearance
                  </button>
                  {currentClearance.status === 'verified' && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        setInvalidationReason('');
                        setClearanceToInvalidate(currentClearance);
                      }}
                    >
                      Invalidate clearance
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="student-records-empty">No clearance has been submitted by this student.</p>
            )}
          </section>

          <section className="card-ui student-records-history">
            <h2 className="settings-section-title">Document Requests</h2>
            {selectedStudent.requests.length === 0 ? (
              <p>No document requests found.</p>
            ) : (
              <div className="request-table-wrapper">
                <table className="request-table">
                  <thead>
                    <tr><th>Tracking code</th><th>Document</th><th>Status</th><th>Purpose</th><th>Submitted</th><th>Fulfilled</th><th>Fee</th></tr>
                  </thead>
                  <tbody>
                    {selectedStudent.requests.map((request) => (
                      <tr key={request.id}>
                        <td>{request.display_code}</td>
                        <td>{request.document_name}</td>
                        
                        {/* UX Upgrade: Replaced displayStatus with StatusBadge */}
                        <td><StatusBadge status={request.status} /></td>
                        
                        <td>{request.purpose || '—'}</td>
                        <td>{request.submitted_at ? new Date(request.submitted_at).toLocaleDateString() : '—'}</td>
                        <td>{request.completed_at ? new Date(request.completed_at).toLocaleDateString() : '—'}</td>
                        <td>{request.fee_amount == null ? '—' : new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: request.fee_currency || 'PHP',
                        }).format(Number(request.fee_amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        isOpen={Boolean(clearanceToInvalidate)}
        onClose={closeInvalidationDialog}
        title="Invalidate current clearance"
        maxWidth="540px"
      >
        <form className="auth-form student-invalidation-form" onSubmit={confirmInvalidation}>
          <p className="student-invalidation-warning">
            This will invalidate the student’s current verified clearance. The student will need to submit an updated copy before making document requests.
          </p>
          <label className="auth-label" htmlFor="student-clearance-invalidation-reason">
            Reason for invalidation
          </label>
          <textarea
            id="student-clearance-invalidation-reason"
            className="auth-input"
            value={invalidationReason}
            onChange={(event) => {
              const value = event.target.value;
              if (value.length > 240) {
                if (!invalidationLimitNotified.current) {
                  addToast('Comments cannot exceed 240 characters.', 'error');
                  invalidationLimitNotified.current = true;
                }
                setInvalidationReason(value.slice(0, 240));
                return;
              }
              invalidationLimitNotified.current = false;
              setInvalidationReason(value);
            }}
            onFocus={() => {
              invalidationLimitNotified.current = false;
            }}
            rows={4}
            required
            disabled={isInvalidating}
            autoFocus
          />
          <div className="student-invalidation-actions">
            <button
              type="button"
              className="student-invalidation-cancel"
              onClick={closeInvalidationDialog}
              disabled={isInvalidating}
            >
              Cancel — keep clearance
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={isInvalidating || !invalidationReason.trim()}
            >
              {isInvalidating ? 'Invalidating...' : 'Confirm invalidation'}
            </button>
          </div>
        </form>
      </Modal>

      <ClearancePreviewModal
        clearance={previewingClearance}
        onClose={() => setPreviewingClearance(null)}
      />
    </div>
  );
}

export default RegistrarStudents;