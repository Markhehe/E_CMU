import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOverlayScrollbars } from 'overlayscrollbars-react';
import { useServerEvents } from '../../hooks/useServerEvents';
import { ClearanceService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ClearancePreviewModal from '../../components/ui/ClearancePreviewModal';
import Modal from '../../components/ui/Modal';
import { scrollbarOptions } from '../../utils/scrollbarOptions';
import '../../styles/dashboard.css';

function RegistrarClearanceDashboard() {
  const navigate = useNavigate();
  const tableWrapperRef = useRef(null);
  const [initializeScrollbars] = useOverlayScrollbars({
    options: {
      ...scrollbarOptions,
      overflow: { x: 'scroll', y: 'scroll' },
    },
    defer: true,
  });
  const [clearances, setClearances] = useState([]);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [activeArchiveSearch, setActiveArchiveSearch] = useState('');
  const [commentDialog, setCommentDialog] = useState(null);
  const [verificationDialog, setVerificationDialog] = useState(null);
  const [verificationImageError, setVerificationImageError] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const commentLimitNotified = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [invalidatingId, setInvalidatingId] = useState(null);
  const [previewingClearance, setPreviewingClearance] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const { addToast } = useToast();
  const { isRegistrarAdmin } = useAuth();

  useEffect(() => {
    if (tableWrapperRef.current) initializeScrollbars(tableWrapperRef.current);
  }, [initializeScrollbars]);

  const loadClearances = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      setClearances(
        activeTab === 'archive'
          ? await ClearanceService.getArchive(activeArchiveSearch)
          : await ClearanceService.getPending(),
      );
    } catch (error) {
      addToast(error.message || 'Failed to load clearance submissions.', 'error');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [activeTab, activeArchiveSearch, addToast]);

  const refreshClearances = useCallback(() => loadClearances(false), [loadClearances]);
  useServerEvents(['clearances', 'requests'], refreshClearances);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      try {
        const archived = activeTab === 'archive';
        const submissions = archived
          ? await ClearanceService.getArchive(activeArchiveSearch)
          : await ClearanceService.getPending();
        if (isCurrent) setClearances(submissions);
      } catch (error) {
        if (isCurrent) {
          addToast(error.message || 'Failed to load clearance submissions.', 'error');
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    load();
    return () => {
      isCurrent = false;
    };
  }, [activeTab, activeArchiveSearch, addToast]);

  const searchArchivedClearances = async (event) => {
    event.preventDefault();
    const searchTerm = archiveSearchQuery.trim();
    if (searchTerm.length === 1) {
      addToast('Enter at least 2 characters to search by student name or ID.', 'error');
      return;
    }
    if (searchTerm === activeArchiveSearch) {
      await loadClearances();
      return;
    }
    setIsLoading(true);
    setActiveArchiveSearch(searchTerm);
  };

  const reviewClearance = async (submission, decision, comment = '') => {
    if (decision === 'needs_update' && !comment) {
      addToast('Add a comment explaining what the student needs to update.', 'error');
      return false;
    }
    setReviewingId(submission.id);
    try {
      await ClearanceService.review(submission.id, decision, comment);
      addToast(
        decision === 'verified' ? 'Student clearance verified.' : 'Clearance returned for update.',
        'success',
      );
      await loadClearances();
      return true;
    } catch (error) {
      addToast(error.message || 'Failed to review clearance.', 'error');
      return false;
    } finally {
      setReviewingId(null);
    }
  };

  const invalidateClearance = async (submission, comment) => {
    if (!comment) {
      addToast('Add a reason for invalidating this verified clearance.', 'error');
      return false;
    }
    setInvalidatingId(submission.id);
    try {
      await ClearanceService.invalidate(submission.id, comment);
      addToast('Verified clearance invalidated. The student must submit an updated copy.', 'success');
      await loadClearances();
      return true;
    } catch (error) {
      addToast(error.message || 'Failed to invalidate clearance.', 'error');
      return false;
    } finally {
      setInvalidatingId(null);
    }
  };

  const openCommentDialog = (submission, decision) => {
    setCommentDraft('');
    setCommentDialog({ submission, decision });
  };

  const openVerificationDialog = (submission) => {
    setVerificationImageError(false);
    setVerificationDialog(submission);
  };

  const openStudentRecord = (submission) => {
    const studentIdentifier = submission.student_id || submission.email;
    if (!studentIdentifier) return;
    navigate('/registrar/students', {
      state: { studentRecordIdentifier: studentIdentifier },
    });
  };

  const confirmVerification = async () => {
    if (!verificationDialog) return;
    const succeeded = await reviewClearance(verificationDialog, 'verified');
    if (succeeded) setVerificationDialog(null);
  };

  const closeCommentDialog = () => {
    if (reviewingId || invalidatingId) return;
    setCommentDialog(null);
    setCommentDraft('');
  };

  const submitCommentAction = async (event) => {
    event.preventDefault();
    if (!commentDialog) return;
    const comment = commentDraft.trim();
    if (!comment) return;

    const { submission, decision } = commentDialog;
    const succeeded = decision === 'invalidate'
      ? await invalidateClearance(submission, comment)
      : await reviewClearance(submission, 'needs_update', comment);

    if (!succeeded) return;
    setCommentDialog(null);
    setCommentDraft('');
  };

  return (
    <div className="dashboard-page clearance-verification-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Clearance Verification</h1>
        <p className="dashboard-subtext">
          {activeTab === 'archive'
            ? 'Verified clearance submissions are retained here for reference.'
            : 'Review student clearance copies before accepting online or walk-in document requests.'}
        </p>
      </header>
      <div className="workflow-inline-actions clearance-tabs" role="tablist" aria-label="Clearance submissions">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pending'}
          className={`workflow-step-button clearance-tab-button${activeTab === 'pending' ? ' is-active' : ''}`}
          onClick={() => {
            setIsLoading(true);
            setActiveTab('pending');
          }}
        >
          Pending verification
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'archive'}
          className={`workflow-step-button clearance-tab-button${activeTab === 'archive' ? ' is-active' : ''}`}
          onClick={() => {
            setIsLoading(true);
            setActiveTab('archive');
          }}
        >
          Verified archive
        </button>
      </div>
      {activeTab === 'archive' && (
        <form
          onSubmit={searchArchivedClearances}
          className="table-toolbar clearance-archive-toolbar"
          role="search"
        >
          <input
            type="search"
            className="toolbar-input"
            value={archiveSearchQuery}
            onChange={(event) => setArchiveSearchQuery(event.target.value)}
            placeholder="Search name (typos supported), student ID, or email"
            aria-label="Search archived clearances by student name with typo tolerance, ID, or email"
            minLength={2}
            maxLength={100}
            disabled={isLoading}
          />
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
      )}
      <div ref={tableWrapperRef} className="request-table-wrapper clearance-verification-table">
        <table className="request-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Student ID</th>
              <th>Submitted</th>
              <th>Clearance Copy</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6}>Loading clearance submissions...</td></tr>
            ) : clearances.length === 0 ? (
              <tr><td colSpan={6}>
                {activeTab === 'archive'
                  ? activeArchiveSearch
                    ? 'No verified clearance submissions match that name, ID, or email.'
                    : 'No verified clearance submissions have been archived yet.'
                  : 'No clearance submissions are awaiting verification.'}
              </td></tr>
            ) : clearances.map((submission) => (
              <tr key={submission.id}>
                <td>
                  <button
                    type="button"
                    className="student-record-link"
                    onClick={() => openStudentRecord(submission)}
                  >
                    <strong>{submission.full_name}</strong>
                  </button>
                  <br />
                  <span className="doc-meta">{submission.email}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="student-record-link"
                    onClick={() => openStudentRecord(submission)}
                  >
                    {submission.student_id || '—'}
                  </button>
                </td>
                <td>{new Date(submission.submitted_at).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    className="workflow-step-button workflow-action-button clearance-view-button"
                    onClick={() => setPreviewingClearance(submission)}
                  >
                    View Clearance
                  </button>
                </td>
                <td>{activeTab === 'archive' ? 'Verified' : 'Awaiting verification'}</td>
                <td>
                  {activeTab === 'archive' ? (
                    submission.is_current && isRegistrarAdmin ? (
                      <button
                        type="button"
                        className="workflow-step-button workflow-action-button workflow-action-button-danger text-danger"
                        disabled={Boolean(invalidatingId)}
                        onClick={() => openCommentDialog(submission, 'invalidate')}
                      >
                        Invalidate Clearance
                      </button>
                    ) : submission.is_current ? (
                      <span className="doc-meta">Admin action only</span>
                    ) : (
                      <span className="doc-meta">Historical record</span>
                    )
                  ) : (
                    <div className="workflow-inline-actions">
                      <button
                        type="button"
                        className="workflow-step-button clearance-review-button clearance-review-verify"
                        disabled={Boolean(reviewingId)}
                        onClick={() => openVerificationDialog(submission)}
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        className="workflow-step-button clearance-review-button clearance-review-update"
                        disabled={Boolean(reviewingId)}
                        onClick={() => openCommentDialog(submission, 'needs_update')}
                      >
                        Request update
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        isOpen={Boolean(verificationDialog)}
        onClose={() => {
          if (!reviewingId) setVerificationDialog(null);
        }}
        title="Confirm clearance verification"
        maxWidth="760px"
      >
        {verificationDialog && (
          <div className="clearance-verification-confirm">
            <p className="clearance-comment-context">
              Are you sure you want to verify {verificationDialog.full_name}&apos;s clearance?
            </p>
            <div className="clearance-verification-confirm-preview">
              {verificationDialog.file_data?.startsWith('data:application/pdf;') ? (
                <iframe
                  title={`Clearance copy for ${verificationDialog.full_name}`}
                  src={verificationDialog.file_data}
                />
              ) : verificationDialog.file_data?.startsWith('data:image/') ? (
                verificationImageError ? (
                  <p role="alert">Unable to display this clearance image.</p>
                ) : (
                  <img
                    src={verificationDialog.file_data}
                    alt={`Clearance copy for ${verificationDialog.full_name}`}
                    onError={() => setVerificationImageError(true)}
                  />
                )
              ) : (
                <p role="alert">No clearance preview is available for this submission.</p>
              )}
            </div>
            <p className="clearance-verification-confirm-filename">
              {verificationDialog.original_name}
            </p>
            <div className="clearance-comment-actions">
              <button
                type="button"
                className="clearance-comment-cancel"
                onClick={() => setVerificationDialog(null)}
                disabled={Boolean(reviewingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmVerification}
                disabled={Boolean(reviewingId)}
              >
                {reviewingId === verificationDialog.id ? 'Verifying...' : 'Confirm verification'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(commentDialog)}
        onClose={closeCommentDialog}
        title={commentDialog?.decision === 'invalidate' ? 'Invalidate current clearance' : 'Request clearance update'}
        maxWidth="540px"
      >
        <form className="clearance-comment-form" onSubmit={submitCommentAction}>
          <p className="clearance-comment-context">
            {commentDialog?.decision === 'invalidate'
              ? `Enter the reason for invalidating ${commentDialog.submission.full_name}'s verified clearance.`
              : `Explain what ${commentDialog?.submission.full_name} needs to correct before the clearance can be verified.`}
          </p>
          <label className="auth-label" htmlFor="clearance-review-comment">
            {commentDialog?.decision === 'invalidate' ? 'Reason for invalidation' : 'Update instructions'}
          </label>
          <textarea
            id="clearance-review-comment"
            className="auth-input clearance-comment-input"
            value={commentDraft}
            onChange={(event) => {
              const value = event.target.value;
              if (value.length > 240) {
                if (!commentLimitNotified.current) {
                  addToast('Comments cannot exceed 240 characters.', 'error');
                  commentLimitNotified.current = true;
                }
                setCommentDraft(value.slice(0, 240));
                return;
              }
              commentLimitNotified.current = false;
              setCommentDraft(value);
            }}
            onFocus={() => {
              commentLimitNotified.current = false;
            }}
            rows={4}
            required
            disabled={Boolean(reviewingId || invalidatingId)}
            autoFocus
          />
          <div className="clearance-comment-actions">
            <button
              type="button"
              className="clearance-comment-cancel"
              onClick={closeCommentDialog}
              disabled={Boolean(reviewingId || invalidatingId)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={commentDialog?.decision === 'invalidate' ? 'clearance-comment-confirm-danger' : 'btn-primary'}
              disabled={Boolean(reviewingId || invalidatingId) || !commentDraft.trim()}
            >
              {reviewingId || invalidatingId
                ? 'Saving...'
                : commentDialog?.decision === 'invalidate'
                  ? 'Confirm invalidation'
                  : 'Send update request'}
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

export default RegistrarClearanceDashboard;
