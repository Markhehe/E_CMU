import { useState } from 'react';
import Modal from '../../../components/ui/Modal';

const ETA_PRESETS = [3, 7, 14, 30];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getInitialEta(request, isUpdating) {
  if (isUpdating && request?.etaAt) return new Date(request.etaAt);
  return addDays(new Date(), 3);
}

function RequestEtaModal({ isOpen, onClose, request, isUpdating, onSubmit }) {
  const initialEta = getInitialEta(request, isUpdating);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [etaDate, setEtaDate] = useState(() => formatDateInput(initialEta));
  const [etaTime, setEtaTime] = useState(() => (
    isUpdating && request?.etaAt
      ? `${String(initialEta.getHours()).padStart(2, '0')}:${String(initialEta.getMinutes()).padStart(2, '0')}`
      : '15:30'
  ));
  const [activePreset, setActivePreset] = useState(isUpdating ? null : 3);

  const selectPreset = (days) => {
    setEtaDate(formatDateInput(addDays(new Date(), days)));
    setActivePreset(days);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const etaAt = new Date(`${etaDate}T${etaTime}:00`);
    if (Number.isNaN(etaAt.getTime())) return;
    setIsSubmitting(true);
    try {
      await onSubmit(etaAt.toISOString());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isUpdating ? 'Update Estimated Availability' : 'Start Document Processing'}
      maxWidth="520px"
    >
      <form className="request-eta-form" onSubmit={handleSubmit}>
        <p className="dashboard-subtext">
          {request?.displayId} · {request?.docType}
        </p>
        <fieldset className="request-eta-presets">
          <legend>Quick presets</legend>
          {ETA_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              className={`request-eta-preset${activePreset === days ? ' is-active' : ''}`}
              aria-pressed={activePreset === days}
              onClick={() => selectPreset(days)}
            >
              {days} days
            </button>
          ))}
        </fieldset>

        <label className="settings-label" htmlFor="request-eta-date">
          Estimated Time of Availability
        </label>
        <div className="request-eta-fields">
          <input
            id="request-eta-date"
            className="auth-input"
            type="date"
            value={etaDate}
            onChange={(event) => {
              setEtaDate(event.target.value);
              setActivePreset(null);
            }}
            required
          />
          <input
            id="request-eta-time"
            className="auth-input"
            type="time"
            step="60"
            value={etaTime}
            onChange={(event) => setEtaTime(event.target.value)}
            aria-label="Estimated availability time, hour and minute"
            required
          />
        </div>
        <div className="request-eta-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSubmitting || !etaDate || !etaTime}>
            {isSubmitting ? 'Saving...' : isUpdating ? 'Update ETA' : 'Start Processing'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default RequestEtaModal;
