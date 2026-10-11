function RequestPagination({
  currentPage,
  totalPages,
  requestsPerPage,
  totalRequests,
  onPageChange
}) {
  if (totalPages <= 1) return null;

  const firstRequest = (currentPage - 1) * requestsPerPage + 1;
  const lastRequest = Math.min(currentPage * requestsPerPage, totalRequests);
  const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 4);
  const visiblePages = Array.from(
    { length: lastVisiblePage - firstVisiblePage + 1 },
    (_, index) => firstVisiblePage + index
  );

  return (
    <nav className="request-pagination" aria-label="Request pages">
      <span className="request-pagination-summary">
        Showing {firstRequest}-{lastRequest} of {totalRequests} requests
      </span>
      <div className="request-pagination-controls">
        <button
          type="button"
          className="request-pagination-button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          {'<<'}
        </button>
        <button
          type="button"
          className="request-pagination-button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          {'<'}
        </button>
        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            className={`request-pagination-button${page === currentPage ? ' is-current' : ''}`}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className="request-pagination-button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          {'>'}
        </button>
        <button
          type="button"
          className="request-pagination-button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          {'>>'}
        </button>
      </div>
    </nav>
  );
}

export default RequestPagination;
