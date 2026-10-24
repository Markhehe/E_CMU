import { useState } from 'react';
import Modal from './Modal';

function ClearancePreviewModal({ clearance, onClose }) {
  const [imageState, setImageState] = useState({ source: null, status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  if (!clearance) return null;

  const isPdf = clearance.file_data?.startsWith('data:application/pdf;');
  const imageStatus = imageState.source === clearance.file_data ? imageState.status : 'loading';

  return (
    <Modal
      isOpen={Boolean(clearance)}
      onClose={onClose}
      title={clearance.original_name || 'Clearance copy'}
      maxWidth="1000px"
    >
      {isPdf ? (
        <iframe
          title={`Preview of ${clearance.original_name || 'clearance copy'}`}
          src={clearance.file_data}
          style={{ width: '100%', height: '70vh', border: 0 }}
        />
      ) : (
        <>
          {imageStatus === 'loading' && (
            <p role="status" aria-live="polite" style={{ textAlign: 'center' }}>
              Loading clearance image...
            </p>
          )}
          {imageStatus === 'error' ? (
            <div role="alert" style={{ textAlign: 'center' }}>
              <p>Unable to display the clearance image.</p>
              <button
                type="button"
                className="workflow-step-button"
                onClick={() => {
                  setImageState({ source: clearance.file_data, status: 'loading' });
                  setReloadKey((key) => key + 1);
                }}
              >
                Try again
              </button>
              <p>If it still does not appear, reload the page and try viewing it again.</p>
            </div>
          ) : (
            <img
              key={`${clearance.id}-${reloadKey}`}
              src={clearance.file_data}
              alt={clearance.original_name || 'Student clearance copy'}
              onLoad={() => setImageState({ source: clearance.file_data, status: 'loaded' })}
              onError={() => setImageState({ source: clearance.file_data, status: 'error' })}
              style={{
                display: imageStatus === 'loaded' ? 'block' : 'none',
                maxWidth: '100%',
                maxHeight: '70vh',
                margin: '0 auto',
                objectFit: 'contain',
              }}
            />
          )}
        </>
      )}
    </Modal>
  );
}

export default ClearancePreviewModal;
