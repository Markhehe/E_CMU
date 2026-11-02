import { useEffect, useId, useRef, useState } from 'react';
import ClearancePreviewModal from './ClearancePreviewModal';

function StudentClearancePanel({
  clearance,
  isLoading,
  isUploading,
  isDeleting,
  onSubmit,
  onDelete,
  selectedFile: sharedSelectedFile,
  selectedImagePreview: sharedImagePreview,
  fileInputKey: sharedFileInputKey,
  onSelectedFileChange,
}) {
  const clearanceFileInputId = useId();
  const [localSelectedFile, setLocalSelectedFile] = useState(null);
  const [localImagePreview, setLocalImagePreview] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const selectedImagePreviewRef = useRef(null);
  const isFileSelectionControlled = Boolean(onSelectedFileChange);
  const selectedFile = isFileSelectionControlled ? sharedSelectedFile : localSelectedFile;
  const selectedImagePreview = isFileSelectionControlled ? sharedImagePreview : localImagePreview;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [renderedImageData, setRenderedImageData] = useState(null);
  const [failedImageData, setFailedImageData] = useState(null);
  const imageData = clearance?.file_data?.startsWith('data:image/')
    ? clearance.file_data
    : null;
  const isPdf = clearance?.file_data?.startsWith('data:application/pdf;');
  const isImageReady = imageData && renderedImageData === imageData;
  const canViewClearance = Boolean(isPdf || isImageReady);
  const hasClearanceFile = Boolean(clearance?.file_data);
  const canViewReturnedClearance = ['needs_update', 'rejected', 'invalidated'].includes(clearance?.status);

  const handleViewClearance = () => {
    if (canViewClearance) setIsPreviewOpen(true);
  };

  const handleViewReturnedClearance = () => {
    if (hasClearanceFile) setIsPreviewOpen(true);
  };

  const previewMessage = failedImageData === imageData && imageData
    ? 'The clearance image could not be rendered. Reload the page and try again.'
    : imageData
      ? 'Loading clearance image... The View Clearance button will be available when the image is ready.'
      : 'Clearance preview is not available yet. Reload the page and try again.';

  useEffect(() => () => {
    if (selectedImagePreviewRef.current) {
      URL.revokeObjectURL(selectedImagePreviewRef.current);
    }
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (isFileSelectionControlled) {
      onSelectedFileChange(file);
      return;
    }

    setLocalSelectedFile(file);

    if (selectedImagePreviewRef.current) {
      URL.revokeObjectURL(selectedImagePreviewRef.current);
      selectedImagePreviewRef.current = null;
    }

    if (file?.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      selectedImagePreviewRef.current = previewUrl;
      setLocalImagePreview(previewUrl);
    } else {
      setLocalImagePreview(null);
    }
  };

  const handleRemoveSelectedFile = () => {
    if (isUploading) return;
    if (isFileSelectionControlled) {
      onSelectedFileChange(null);
      setFileInputKey((key) => key + 1);
      return;
    }

    setLocalSelectedFile(null);
    setLocalImagePreview(null);
    if (selectedImagePreviewRef.current) {
      URL.revokeObjectURL(selectedImagePreviewRef.current);
      selectedImagePreviewRef.current = null;
    }
    setFileInputKey((key) => key + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submitted = await onSubmit(selectedFile);
    if (submitted) {
      if (isFileSelectionControlled) {
        onSelectedFileChange(null);
      } else {
        setLocalSelectedFile(null);
        setLocalImagePreview(null);
      }
      if (selectedImagePreviewRef.current) {
        URL.revokeObjectURL(selectedImagePreviewRef.current);
        selectedImagePreviewRef.current = null;
      }
      setFileInputKey((key) => key + 1);
    }
  };

  return (
    <section id="student-clearance" className="card-ui student-clearance-panel" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <div className="student-clearance-heading">
        <h2 className="settings-section-title" style={{ marginTop: 0 }}>Student Clearance</h2>
        {canViewReturnedClearance && (
          <button
            type="button"
            className="workflow-step-button workflow-action-button student-clearance-view-button"
            disabled={!hasClearanceFile}
            onClick={handleViewReturnedClearance}
          >
            View invalid clearance
          </button>
        )}
      </div>
      {isLoading ? (
        <p className="dashboard-subtext">Loading your clearance status...</p>
      ) : clearance?.status === 'verified' ? (
        <div role="status">
          <p>Your clearance is verified. You can submit online and walk-in document requests.</p>
          <button type="button" className="workflow-step-button workflow-action-button" disabled={!canViewClearance} onClick={handleViewClearance}>
            View  Clearance
          </button>
          {!canViewClearance && (
            <p role="status" aria-live="polite">{previewMessage}</p>
          )}
        </div>
      ) : clearance?.status === 'submitted' ? (
        <div role="status">
          <p><strong>Your clearance copy is awaiting Registrar verification. Document requests are unavailable until verification is complete.</strong></p>
          {imageData && (
            <div className="student-clearance-saved-file">
              <img
                src={imageData}
                alt={clearance.original_name || 'Uploaded clearance'}
              />
              <span>{clearance.original_name || 'Uploaded clearance'}</span>
            </div>
          )}
          <button type="button" className="workflow-step-button workflow-action-button" disabled={!canViewClearance} onClick={handleViewClearance}>
            View Clearance
          </button>
          {!canViewClearance && (
            <p role="status" aria-live="polite">{previewMessage}</p>
          )}
          <button
            type="button"
            className="workflow-step-button workflow-action-button workflow-action-button-danger text-danger"
            disabled={isDeleting}
            onClick={() => {
              if (window.confirm('Delete this clearance submission while it is awaiting verification?')) {
                onDelete();
              }
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Clearance'}
          </button>
        </div>
      ) : (
        <>
          {['needs_update', 'rejected', 'invalidated'].includes(clearance?.status) && (
            <p className="student-clearance-invalid" role="status">
              Clearance invalid.
            </p>
          )}
          {clearance?.comment && (
            <p className="status-alert student-clearance-feedback">
              Registrar feedback: {clearance.comment}
            </p>
          )}
          <p className="dashboard-subtext">
            Upload your current clearance copy. Requests are available after the Registrar verifies it.
          </p>
          <form onSubmit={handleSubmit}>
            <label className="settings-label" htmlFor={clearanceFileInputId}>
              Clearance copy (PDF, PNG, JPG, or WebP; up to 3 MB)
            </label>
            <input
              id={clearanceFileInputId}
              key={isFileSelectionControlled ? sharedFileInputKey : fileInputKey}
              type="file"
              className="receipt-file-input"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={isUploading}
              required={!selectedFile}
            />
            {selectedImagePreview ? (
              <div className="student-clearance-preview-stage">
                <img
                  className="student-clearance-selected-preview"
                  src={selectedImagePreview}
                  alt={`Preview of ${selectedFile.name}`}
                />
                <label
                  className={`student-clearance-preview-change${isUploading ? ' is-disabled' : ''}`}
                  htmlFor={clearanceFileInputId}
                  aria-disabled={isUploading}
                >
                  Change file
                </label>
                <button
                  type="button"
                  className="student-clearance-preview-remove"
                  aria-label="Remove selected clearance file"
                  title="Remove selected file"
                  onClick={handleRemoveSelectedFile}
                  disabled={isUploading}
                >
                  &times;
                </button>
              </div>
            ) : (
              <label
                className={`receipt-upload-zone student-clearance-upload-zone${isUploading ? ' is-disabled' : ''}`}
                htmlFor={clearanceFileInputId}
                aria-disabled={isUploading}
              >
                <span className="receipt-upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 14v5h14v-5" />
                  </svg>
                </span>
                <strong>Choose your clearance file</strong>
                <span>Click below to browse files on your device</span>
                <span className="receipt-upload-browse">Browse files</span>
              </label>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={isUploading || !selectedFile}
              style={{ marginTop: '0.75rem' }}
            >
              {isUploading
                ? 'Uploading...'
                : clearance
                  ? 'Upload Updated Clearance'
                  : 'Upload Clearance'}
            </button>
          </form>
        </>
      )}
      {imageData && (
        <img
          key={clearance.id}
          src={imageData}
          alt=""
          aria-hidden="true"
          onLoad={() => {
            setRenderedImageData(imageData);
            setFailedImageData(null);
          }}
          onError={() => setFailedImageData(imageData)}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <ClearancePreviewModal
        clearance={isPreviewOpen ? clearance : null}
        onClose={() => setIsPreviewOpen(false)}
      />
    </section>
  );
}

export default StudentClearancePanel;
