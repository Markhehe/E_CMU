import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DocumentService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import Modal from './Modal';

function RequestCommentsModal({
  isOpen,
  onClose,
  request,
  onCommentsRead,
  focusCommentId,
}) {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [visibility, setVisibility] = useState('requester');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const commentLimitNotified = useRef(false);
  const isStaff = currentUser?.rawRoles?.some((role) =>
    String(role).toLowerCase() === 'registrar'
  );

  useEffect(() => {
    if (!isOpen || !request) return undefined;

    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setIsLoading(true);
      const loadComments = async () => {
        try {
          const items = await DocumentService.getRequestComments(request.id);
          if (!active) return;
          setComments(items);
          try {
            await onCommentsRead(request.id);
          } catch (error) {
            addToast(error.message || 'Could not mark request comments as read.', 'error');
          }
        } catch (error) {
          if (active) {
            setComments([]);
            addToast(error.message || 'Could not load request comments.', 'error');
          }
        } finally {
          if (active) setIsLoading(false);
        }
      };
      loadComments();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, request, onCommentsRead, addToast]);

  useEffect(() => {
    if (!isOpen || isLoading || !focusCommentId) return undefined;
    const timeoutId = window.setTimeout(() => {
      document.getElementById(`request-comment-${focusCommentId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [focusCommentId, isLoading, isOpen, comments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!request || isSaving) return;
    setIsSaving(true);
    try {
      const result = await DocumentService.addRequestComment(request.id, { comment, visibility });
      setComment('');
      setComments(await DocumentService.getRequestComments(request.id));
      addToast(
        result.emailNotificationQueued
          ? 'Comment added. The email notification is being sent in the background.'
          : 'Comment added to the request.',
        'success'
      );
    } catch (error) {
      addToast(error.message || 'Could not add the comment.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComment = async () => {
    const item = commentToDelete;
    if (!request || isDeletingComment) return;
    if (!item) return;

    setIsDeletingComment(true);
    try {
      await DocumentService.deleteRequestComment(request.id, item.id);
      setComments((currentComments) => currentComments.filter((commentItem) => commentItem.id !== item.id));
      setCommentToDelete(null);
      addToast('Comment deleted.', 'success');
    } catch (error) {
      addToast(error.message || 'Could not delete the comment.', 'error');
    } finally {
      setIsDeletingComment(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Request Comments${request?.displayId ? ` — ${request.displayId}` : ''}`}
        maxWidth="560px"
      >
        {isLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading comments...</p>
        ) : comments.length ? (
          <div style={{ display: 'grid', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto' }}>
            {comments.map((item) => (
              <article
                key={item.id}
                id={`request-comment-${item.id}`}
                className={String(item.id) === String(focusCommentId) ? 'request-comment-highlight' : undefined}
                style={{
                  padding: '0.7rem 0.8rem',
                  backgroundColor: item.visibility === 'staff' ? '#fff8e1' : '#f8f9fa',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
                  <strong style={{ fontSize: '0.82rem' }}>{item.author_name}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {isStaff && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {item.visibility === 'staff' ? 'Staff only' : 'Visible to student'}
                      </span>
                    )}
                    {isStaff && String(item.author_id) === currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => setCommentToDelete(item)}
                        data-action-cooldown="protected"
                        disabled={isDeletingComment}
                        aria-label={`Delete your comment from ${formatDate(item.created_at)}`}
                        style={{
                          border: 0,
                          padding: 0,
                          background: 'none',
                          color: 'var(--danger, #b42318)',
                          cursor: isDeletingComment ? 'wait' : 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        {isDeletingComment ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {item.comment}
                </p>
                <time
                  dateTime={item.created_at}
                  style={{ display: 'block', marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}
                >
                  {formatDate(item.created_at)}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No comments yet.</p>
        )}

        {isStaff && (
          <form
            onSubmit={handleSubmit}
            data-action-cooldown="protected"
            style={{ display: 'grid', gap: '0.55rem', marginTop: '0.8rem' }}
          >
            <label htmlFor="requestComment" className="auth-label">Add a comment</label>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="auth-input"
              aria-label="Comment visibility"
              disabled={isSaving}
            >
              <option value="requester">Visible to student</option>
              <option value="staff">Internal staff note</option>
            </select>
            <textarea
              id="requestComment"
              value={comment}
              onChange={(event) => {
                const value = event.target.value;
                if (value.length > 240) {
                  if (!commentLimitNotified.current) {
                    addToast('Comments cannot exceed 240 characters.', 'error');
                    commentLimitNotified.current = true;
                  }
                  setComment(value.slice(0, 240));
                  return;
                }
                commentLimitNotified.current = false;
                setComment(value);
              }}
              onFocus={() => {
                commentLimitNotified.current = false;
              }}
              className="auth-input"
              rows={3}
              placeholder="Write a comment about this request"
              required
              disabled={isSaving}
            />
            <button type="submit" className="auth-button" disabled={isSaving || !comment.trim()}>
              {isSaving ? 'ADDING...' : 'ADD COMMENT'}
            </button>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={!!commentToDelete}
        onClose={() => {
          if (!isDeletingComment) setCommentToDelete(null);
        }}
        title="Delete Comment?"
        maxWidth="420px"
        zIndex={10000}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Are you sure you want to permanently delete this comment? This action cannot be undone.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCommentToDelete(null)}
            disabled={isDeletingComment}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleDeleteComment}
            data-action-cooldown="protected"
            disabled={isDeletingComment}
            style={{ backgroundColor: 'var(--danger, #b42318)' }}
          >
            {isDeletingComment ? 'Deleting...' : 'Delete Comment'}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default RequestCommentsModal;
