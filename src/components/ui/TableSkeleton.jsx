function TableSkeleton({ columns = 6, rows = 5 }) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: columns });

  return (
    <>
      {rowArray.map((_, rowIndex) => (
        <tr key={`skel-row-${rowIndex}`} className="skeleton-row">
          {colArray.map((_, colIndex) => {
            const isFirst = colIndex === 0;
            const isSecond = colIndex === 1;
            const isLast = colIndex === columns - 1;
            const isBadgeCol = colIndex >= columns - 3 && !isLast;

            return (
              <td key={`skel-col-${colIndex}`} style={{ textAlign: isLast ? 'right' : 'left' }}>
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
                  /* Action Button Dot */
                  <div
                    className="skeleton-block"
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      marginLeft: 'auto',
                    }}
                  />
                ) : isFirst ? (
                  /* ID / Code Column */
                  <div className="skeleton-block" style={{ width: '65px', height: '15px' }} />
                ) : (
                  /* Standard Data or Badge Pills */
                  <div
                    className="skeleton-block"
                    style={{
                      width: isBadgeCol ? '90px' : '110px',
                      height: '18px',
                      borderRadius: isBadgeCol ? '12px' : '4px',
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