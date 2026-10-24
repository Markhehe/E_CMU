/**
 * Custom Hook: useRequests
 * Manages request fetching, sorting, multi-field searching, status filtering,
 * and server actions with automatic toast notifications.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DocumentService } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const STATUS_WEIGHTS = {
  'PENDING PAYMENT': 1,
  'PROCESSING': 2,
  'READY FOR PICKUP': 3,
  'FULFILLED': 4,
  'REJECTED': 5,
};

export function useRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilterState] = useState('ALL');
  const [sortOption, setSortOption] = useState('DATE_DESC');
  const [showFulfilledRequests, setShowFulfilledRequests] = useState(true);
  const fulfilledVisibilityBeforeFilter = useRef(null);
  const [showRejectedRequests, setShowRejectedRequests] = useState(true);
  const rejectedVisibilityBeforeFilter = useRef(null);

  const setStatusFilter = useCallback((nextStatusFilter) => {
    if (nextStatusFilter === 'FULFILLED' && statusFilter !== 'FULFILLED') {
      fulfilledVisibilityBeforeFilter.current = showFulfilledRequests;
      setShowFulfilledRequests(true);
    } else if (statusFilter === 'FULFILLED' && nextStatusFilter !== 'FULFILLED') {
      if (fulfilledVisibilityBeforeFilter.current !== null) {
        setShowFulfilledRequests(fulfilledVisibilityBeforeFilter.current);
      }
      fulfilledVisibilityBeforeFilter.current = null;
    }

    if (nextStatusFilter === 'REJECTED' && statusFilter !== 'REJECTED') {
      rejectedVisibilityBeforeFilter.current = showRejectedRequests;
      setShowRejectedRequests(true);
    } else if (statusFilter === 'REJECTED' && nextStatusFilter !== 'REJECTED') {
      if (rejectedVisibilityBeforeFilter.current !== null) {
        setShowRejectedRequests(rejectedVisibilityBeforeFilter.current);
      }
      rejectedVisibilityBeforeFilter.current = null;
    }

    setStatusFilterState(nextStatusFilter);
  }, [showFulfilledRequests, showRejectedRequests, statusFilter]);

  // Fetch / Refresh request list from server
  const fetchRequests = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setIsLoading(true);
    else setIsRefreshing(true);
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
      setIsRefreshing(false);
    }
  }, [addToast]);

  // Initial mount load
  useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      fetchRequests(true);
    }

    return () => {
      isMounted = false;
    };
  }, [fetchRequests]);

  // Registrar clearance verification
  const toggleClearance = useCallback(
    async (id, isCleared, notes = '') => {
      try {
        await DocumentService.updateClearance(id, isCleared, notes);
        addToast(
          isCleared ? 'Clearance verified.' : 'Clearance requires follow-up.',
          isCleared ? 'success' : 'error'
        );
        await fetchRequests(false);
      } catch (err) {
        addToast(err.message || 'Failed to update clearance.', 'error');
        throw err;
      }
    },
    [fetchRequests, addToast]
  );

  const runWorkflowAction = useCallback(
    async (action, successMessage) => {
      try {
        const result = await action();
        addToast(result?.message || successMessage, 'success');
        await fetchRequests(false);
        return result;
      } catch (err) {
        addToast(err.message || 'Failed to update the request workflow.', 'error');
        return null;
      }
    },
    [fetchRequests, addToast]
  );

  const reviewAsRegistrar = useCallback(
    (id, decision, comment = '') =>
      runWorkflowAction(
        () => DocumentService.submitRegistrarReview(id, decision, comment),
        `Registrar review recorded: ${decision}.`
      ),
    [runWorkflowAction]
  );

  const confirmPayment = useCallback(
    (id, payment) =>
      runWorkflowAction(
        () => DocumentService.confirmRequestPayment(id, payment),
        'Payment confirmed.'
      ),
    [runWorkflowAction]
  );

  const markReadyForPickup = useCallback(
    (id) =>
      runWorkflowAction(
        () => DocumentService.markRequestReadyForPickup(id),
        'Request marked ready for pickup.'
      ),
    [runWorkflowAction]
  );

  const startRequestProcessing = useCallback(
    (id) =>
      runWorkflowAction(
        () => DocumentService.startRequestProcessing(id),
        'Document processing started.'
      ),
    [runWorkflowAction]
  );

  const markPickedUp = useCallback(
    (id) =>
      runWorkflowAction(
        () => DocumentService.markRequestPickedUp(id),
        'Document pickup recorded.'
      ),
    [runWorkflowAction]
  );

  const markCommentsRead = useCallback(async (requestId) => {
    await DocumentService.markRequestCommentsRead(requestId);
    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId
          ? { ...request, hasUnreadComments: false }
          : request
      )
    );
  }, []);

  // Filter and Sort Processing Pipeline
  const processedRequests = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    // 1. Filter
    const filtered = requests.filter((req) => {
      const matchesSearch =
        !searchLower ||
        req.studentName?.toLowerCase().includes(searchLower) ||
        req.displayId?.toLowerCase().includes(searchLower) ||
        req.id?.toLowerCase().includes(searchLower) ||
        req.docType?.toLowerCase().includes(searchLower) ||
        req.studentId?.toLowerCase().includes(searchLower) ||
        req.purpose?.toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === 'ALL' ||
        req.status?.toUpperCase() === statusFilter.toUpperCase() ||
        req.rawStatus?.toUpperCase() === statusFilter.toUpperCase();

      const isFulfilled =
        req.status?.toUpperCase() === 'FULFILLED' ||
        req.rawStatus?.toUpperCase() === 'FULFILLED';
      const matchesFulfilledVisibility = showFulfilledRequests || !isFulfilled;
      const isRejected =
        req.status?.toUpperCase() === 'REJECTED' ||
        ['REJECTED', 'CANCELLED', 'REGISTRAR_REJECTED', 'SASO_REJECTED']
          .includes(req.rawStatus?.toUpperCase());
      const matchesRejectedVisibility = showRejectedRequests || !isRejected;

      return matchesSearch && matchesStatus &&
        matchesFulfilledVisibility && matchesRejectedVisibility;
    });

    // 2. Immutably Sort
    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'DATE_DESC':
          return new Date(b.date || 0) - new Date(a.date || 0);
        case 'DATE_ASC':
          return new Date(a.date || 0) - new Date(b.date || 0);
        case 'ID_ASC':
          return (a.displayId || a.id).localeCompare(b.displayId || b.id);
        case 'ID_DESC':
          return (b.displayId || b.id).localeCompare(a.displayId || a.id);
        case 'NAME_ASC':
          return (a.studentName || '').localeCompare(b.studentName || '');
        case 'NAME_DESC':
          return (b.studentName || '').localeCompare(a.studentName || '');
        case 'STATUS_ASC':
          return (STATUS_WEIGHTS[a.status] || 99) - (STATUS_WEIGHTS[b.status] || 99);
        case 'STATUS_DESC':
          return (STATUS_WEIGHTS[b.status] || 99) - (STATUS_WEIGHTS[a.status] || 99);
        default:
          return 0;
      }
    });
  }, [
    requests,
    searchTerm,
    statusFilter,
    sortOption,
    showFulfilledRequests,
    showRejectedRequests,
  ]);

  return {
    requests: processedRequests,
    rawCount: requests.length,
    isLoading,
    isRefreshing,
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
    refreshRequests: () => fetchRequests(false),
    toggleClearance,
    reviewAsRegistrar,
    confirmPayment,
    startRequestProcessing,
    markReadyForPickup,
    markPickedUp,
    markCommentsRead,
  };
}