const Modal = ({ isOpen, onClose, title, children, maxWidth = '420px', zIndex = 9999 }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        zIndex,
        display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}
      onClick={onClose} // Closes when clicking the dark background outside the modal
    >
      <div
        className="card-ui"
        style={{
          backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px',
          width: '90%', maxWidth: maxWidth, boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()} // Prevents closing when clicking inside the card
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1.5rem',
            background: 'none', border: 'none', fontSize: '1.5rem',
            cursor: 'pointer', color: 'var(--text-muted)'
          }}
        >
          &times;
        </button>

        <h2 style={{ marginTop: 0, color: 'var(--imperial-blue)', fontFamily: 'var(--font-serif-body)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
          {title}
        </h2>

        {/* The specific content passed from other components goes here */}
        {children}
      </div>
    </div>
  );
};

export default Modal;