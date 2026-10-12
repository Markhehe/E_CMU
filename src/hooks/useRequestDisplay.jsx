/**
 * Custom Hook: useRequestDisplay
 * Manages view display mode ('scroll' | 'pagination') and active pagination state.
 * Syncs user preferences to localStorage per role.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

export function useRequestDisplay(requests = [], role = 'default', initialPageSize = 5, defaultMode = 'pagination') {
  const storageKey = `cmu_request_display_${role}`;
  const tableWrapperRef = useRef(null);

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

  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper || mode !== 'pagination') return undefined;

    const updatePageSize = () => {
      wrapper.style.removeProperty('--request-row-height');
      const tableHeader = wrapper.querySelector('.request-table thead');
      const tableRows = Array.from(
        wrapper.querySelectorAll('.request-table tbody tr:not(.empty-state-row)')
      );
      const rowHeights = tableRows
        .map((row) => row.getBoundingClientRect().height)
        .filter((height) => height > 0);

      if (!tableHeader || rowHeights.length === 0) return;

      const availableRowsHeight = wrapper.clientHeight - tableHeader.getBoundingClientRect().height;
      if (availableRowsHeight <= 0) return;

      const tallestRowHeight = Math.max(...rowHeights);
      const nextPageSize = Math.max(1, Math.floor(availableRowsHeight / tallestRowHeight));

      wrapper.style.setProperty(
        '--request-row-height',
        `${availableRowsHeight / nextPageSize}px`,
      );

      setPageSize((currentPageSize) => (
        currentPageSize === nextPageSize ? currentPageSize : nextPageSize
      ));
    };

    const resizeObserver = new ResizeObserver(updatePageSize);
    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, [mode, requests, currentPage, pageSize]);

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
    tableWrapperRef,
  };
}