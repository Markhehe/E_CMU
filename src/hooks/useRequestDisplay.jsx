/**
 * Custom Hook: useRequestDisplay
 * Manages view display mode ('scroll' | 'pagination') and active pagination state.
 * Syncs user preferences to localStorage per role.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

export function useRequestDisplay(requests = [], role = 'default', initialPageSize = 5, defaultMode = 'pagination') {
  const storageKey = `cmu_request_display_${role}`;

  const [mode, setModeState] = useState(() => {
    try {
      const savedMode = localStorage.getItem(storageKey);
      return savedMode === 'scroll' || savedMode === 'pagination' ? savedMode : defaultMode;
    } catch {
      return defaultMode;
    }
  });

  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  // Persist preference changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, mode);
    } catch (err) {
      console.warn('Failed to save display preference:', err);
    }
  }, [mode, storageKey]);

  // Calculate pages dynamically
  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));

  // Auto-clamp page index if filtering reduces items below current page
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [requests.length, totalPages, currentPage]);

  const changeMode = useCallback((nextMode) => {
    setModeState(nextMode);
    setCurrentPage(1);
  }, []);

  const visibleRequests = useMemo(() => {
    if (mode === 'scroll') return requests;

    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (validPage - 1) * pageSize;
    return requests.slice(start, start + pageSize);
  }, [requests, mode, currentPage, totalPages, pageSize]);

  return {
    mode,
    setMode: changeMode,
    visibleRequests,
    currentPage: Math.min(Math.max(1, currentPage), totalPages),
    totalPages,
    requestsPerPage: pageSize,
    setPageSize,
    setCurrentPage,
    totalRecords: requests.length,
  };
}