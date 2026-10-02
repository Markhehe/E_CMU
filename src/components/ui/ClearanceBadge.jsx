import React from 'react';
import './StatusBadge.css';

function ClearanceBadge({ isCleared }) {
  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '6px', 
      color: isCleared ? '#12b886' : '#f08c00', 
      fontSize: '0.75rem', 
      fontWeight: '700', 
      textTransform: 'uppercase', 
      letterSpacing: '0.5px' 
    }}>
      <span style={{ 
        width: '8px', 
        height: '8px', 
        borderRadius: '50%', 
        backgroundColor: isCleared ? '#12b886' : '#f08c00' 
      }}></span>
      {isCleared ? 'Cleared' : 'Pending Hold'}
    </span>
  );
}

export default ClearanceBadge;