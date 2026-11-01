function TableSkeleton({ columns = 6, rows = 5 }) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: columns });

  return (
    <>
      {rowArray.map((_, rowIndex) => (
        <tr key={`skel-row-${rowIndex}`} className="skeleton-row" aria-hidden="true">
          {colArray.map((_, colIndex) => {
            // 1. Math safely fixed to identify columns accurately
            const isFirst = colIndex === 0;
            const isSecond = colIndex === 1;
            const isLast = colIndex === columns - 1;
            
            // Assuming the status badge is usually in the second-to-last column
            const isBadgeCol = colIndex === columns - 2;

            return (
              <td 
                key={`skel-col-${colIndex}`} 
                style={{ textAlign: isLast ? 'right' : (isBadgeCol ? 'center' : 'left') }}
              >
                {isSecond ? (
                  /* Double Line for Student Details (Name + ID) */
                  <div className="skeleton-stack">
                    <div
                      className="skeleton-block"
                      style={{ width: '120px', height: '14px', marginBottom: '5px' }}
                    />
                    <div
                      className="skeleton-block"
                      style={{ width: '65px', height: '10px', opacity: 0.6 }}
                    />
                  </div>
                ) : isLast ? (
                  /* Action Button Dot / Workflow Actions */
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <div className="skeleton-block" style={{ width: '80px', height: '28px', borderRadius: '4px' }} />
                    <div className="skeleton-block" style={{ width: '28px', height: '28px', borderRadius: '4px' }} />
                  </div>
                ) : isFirst ? (
                  /* ID / Code Column */
                  <div className="skeleton-block" style={{ width: '65px', height: '15px' }} />
                ) : (
                  /* Standard Data or Badge Pills */
                  <div
                    className="skeleton-block"
                    style={{
                      width: isBadgeCol ? '100px' : '110px',
                      height: isBadgeCol ? '24px' : '18px',
                      borderRadius: isBadgeCol ? '12px' : '4px',
                      margin: isBadgeCol ? '0 auto' : '0' // Center the badge
                    }}
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export default TableSkeleton;