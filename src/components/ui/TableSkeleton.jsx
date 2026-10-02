import React from 'react';

function TableSkeleton({ columns = 6, rows = 5 }) {
  // Create an array of N rows to map over
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: columns });

  return (
    <>
      {rowArray.map((_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-row">
          {colArray.map((_, colIndex) => {
            // Randomize the width slightly so it looks like real text data
            const isLast = colIndex === columns - 1;
            const width = isLast ? '30px' : `${Math.floor(Math.random() * (90 - 40 + 1) + 40)}%`;
            
            return (
              <td key={colIndex}>
                <div 
                  className="skeleton-block" 
                  style={{ 
                    width: width, 
                    marginLeft: isLast ? 'auto' : '0' // Pushes the action menu skeleton to the right
                  }} 
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export default TableSkeleton;