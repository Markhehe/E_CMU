/**
 * Custom Hook: useRequests
 * Manages request fetching, sorting, multi-field searching, status filtering,
 * and server actions with automatic toast notifications.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { DocumentService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useServerEvents } from './useServerEvents';

const STATUS_WEIGHTS = {
  'PENDING PAYMENT': 1,
  'PROCESSING': 2,
  'OVERDUE': 3,
  'READY FOR PICKUP': 4,
  'FULFILLED': 5,
  'REJECTED': 6,
};

export function useRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Initial mount load
  const [isFetching, setIsFetching] = useState(false); // Background syncs
  const [error, setError] = useState(null);

  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('DATE_DESC');
  const [showFulfilledRequests, setShowFulfilledRequests] = useState(true);
  const [showRejectedRequests, setShowRejectedRequests] = useState(true);

  // Fetch with explicit options for initial loads vs background syncs
  const fetchRequests = useCallback(async (options = { background: false }) => {
    if (!options.background) setIsLoading(true);
    setIsFetching(true);
    setError(null);

    try {
      const data = await DocumentService.getAllRequests();
      const formattedData = data.map((req) => ({
        ...req,
        date: req.dateRequested || req.rawDate || req.date || '',
      }));
      setRequests(formattedData);
    } catch (err) {
      const msg = err.message || 'Failed to load document requests.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [addToast]);

  const refreshRequests = useCallback(() => fetchRequests({ background: true }), [fetchRequests]);

  useServerEvents(['requests', 'comments'], refreshRequests);

  // Initial mount load
  useEffect(() => {
    const timeoutId = window.setTimeout(() => fetchRequests({ background: false }), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchRequests]);

  // --- Workflow Actions ---
  const toggleClearance = useCallback(
    async (id, isCleared, notes = '') => {
      try {
        await DocumentService.updateClearance(id, isCleared, notes);
        addToast(isCleared ? 'Clearance verified.' : 'Clearance requires follow-up.', isCleared ? 'success' : 'error');
        await refreshRequests();
      } catch (err) {
        addToast(err.message || 'Failed to update clearance.', 'error');
        throw err;
      }
    },
    [refreshRequests, addToast]
  );

  const runWorkflowAction = useCallback(
    async (action, successMessage) => {
      try {
        const result = await action();
        addToast(result?.message || successMessage, 'success');
        await refreshRequests();
        return result;
      } catch (err) {
        addToast(err.message || 'Failed to update the request workflow.', 'error');
        return null;
      }
    },
    [refreshRequests, addToast]
  );

  const reviewAsRegistrar = useCallback(
    (id, decision, comment = '') => runWorkflowAction(() => DocumentService.submitRegistrarReview(id, decision, comment), `Registrar review recorded: ${decision}.`),
    [runWorkflowAction]
  );

  const changeRequestStatus = useCallback(
    (id, status) => runWorkflowAction(() => DocumentService.changeRequestStatus(id, status), 'Request status updated.'),
    [runWorkflowAction]
  );

  const confirmPayment = useCallback(
    (id, payment) => runWorkflowAction(() => DocumentService.confirmRequestPayment(id, payment), 'Payment confirmed.'),
    [runWorkflowAction]
  );

  const markReadyForPickup = useCallback(
    (id) => runWorkflowAction(() => DocumentService.markRequestReadyForPickup(id), 'Request marked ready for pickup.'),
    [runWorkflowAction]
  );

  const startRequestProcessing = useCallback(
    (id, etaAt) => runWorkflowAction(() => DocumentService.startRequestProcessing(id, etaAt), 'Document processing started.'),
    [runWorkflowAction]
  );

  const updateRequestEta = useCallback(
    (id, etaAt) => runWorkflowAction(() => DocumentService.updateRequestEta(id, etaAt), 'Estimated availability time updated.'),
    [runWorkflowAction]
  );

  const requestEtaUpdate = useCallback(
    (id) => runWorkflowAction(() => DocumentService.requestEtaUpdate(id), 'Your ETA update request was sent to the Registrar.'),
    [runWorkflowAction]
  );

  const markPickedUp = useCallback(
    (id) => runWorkflowAction(() => DocumentService.markRequestPickedUp(id), 'Document pickup recorded.'),
    [runWorkflowAction]
  );

  const markCommentsRead = useCallback(async (requestId) => {
    await DocumentService.markRequestCommentsRead(requestId);
    setRequests((currentRequests) =>
      currentRequests.map((req) => (req.id === requestId ? { ...req, hasUnreadComments: false } : req))
    );
  }, []);

  // --- Declarative Filter and Sort Pipeline ---
  const processedRequests = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    const filtered = requests.filter((req) => {
      const matchesSearch =
        !searchLower ||
        req.studentName?.toLowerCase().includes(searchLower) ||
        req.displayId?.toLowerCase().includes(searchLower) ||
        req.id?.toLowerCase().includes(searchLower) ||
        req.docType?.toLowerCase().includes(searchLower) ||
        req.studentId?.toLowerCase().includes(searchLower) ||
        req.purpose?.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === 'ALL' || 
                            req.status?.toUpperCase() === statusFilter.toUpperCase() || 
                            req.rawStatus?.toUpperCase() === statusFilter.toUpperCase();

      const isFulfilled = req.status?.toUpperCase() === 'FULFILLED' || req.rawStatus?.toUpperCase() === 'FULFILLED';
      const isRejected = req.status?.toUpperCase() === 'REJECTED' || req.rawStatus?.toUpperCase() === 'REJECTED';

      // Declarative visibility logic replaces the messy useRef side-effects.
      // If the user explicitly filters by FULFILLED, show them regardless of the toggle.
      const matchesFulfilledVisibility = statusFilter === 'FULFILLED' || showFulfilledRequests || !isFulfilled;
      const matchesRejectedVisibility = statusFilter === 'REJECTED' || showRejectedRequests || !isRejected;

      return matchesSearch && matchesStatus && matchesFulfilledVisibility && matchesRejectedVisibility;
    });

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'DATE_DESC': return new Date(b.date || 0) - new Date(a.date || 0);
        case 'DATE_ASC': return new Date(a.date || 0) - new Date(b.date || 0);
        case 'STATUS_ASC': return (STATUS_WEIGHTS[a.status] || 99) - (STATUS_WEIGHTS[b.status] || 99);
        case 'STATUS_DESC': return (STATUS_WEIGHTS[b.status] || 99) - (STATUS_WEIGHTS[a.status] || 99);
        default: return 0;
      }
    });
  }, [requests, searchTerm, statusFilter, sortOption, showFulfilledRequests, showRejectedRequests]);

  return {
    requests: processedRequests,
    allRequests: requests,
    rawCount: requests.length,
    isLoading,
    isFetching,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    showFulfilledRequests,
    setShowFulfilledRequests,
    showRejectedRequests,
    setShowRejectedRequests,
    sortOption,
    setSortOption,
    refreshRequests,
    toggleClearance,
    reviewAsRegistrar,
    changeRequestStatus,
    confirmPayment,
    startRequestProcessing,
    updateRequestEta,
    requestEtaUpdate,
    markReadyForPickup,
    markPickedUp,
    markCommentsRead,
  };
}