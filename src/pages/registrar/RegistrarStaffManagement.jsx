import { useEffect, useState } from 'react';
import { RegistrarStaffService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/registrarStaffManagement.css';

function RegistrarStaffManagement() {
  const { addToast } = useToast();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });

  useEffect(() => {
    let isCurrent = true;
    const loadStaff = async () => {
      try {
        const accounts = await RegistrarStaffService.list();
        if (isCurrent) setStaff(accounts);
      } catch (error) {
        if (isCurrent) {
          addToast(error.message || 'Failed to load registrar staff accounts.', 'error');
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    loadStaff();
    return () => {
      isCurrent = false;
    };
  }, [addToast]);

  const createStaffAccount = async (event) => {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newStaff = await RegistrarStaffService.create(form);
      setStaff((current) => [...current, newStaff].sort((a, b) => (
        a.full_name.localeCompare(b.full_name)
      )));
      setForm({ fullName: '', email: '', password: '' });
      addToast('Registrar staff account created.', 'success');
    } catch (error) {
      addToast(error.message || 'Failed to create registrar staff account.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const setStaffActive = async (account, active) => {
    setBusyStaffId(account.id);
    try {
      const updatedStaff = await RegistrarStaffService.setActive(account.id, active);
      setStaff((current) => current.map((item) => (
        item.id === account.id ? updatedStaff : item
      )));
      addToast(
        active ? 'Registrar staff account restored.' : 'Registrar staff account suspended.',
        'success',
      );
    } catch (error) {
      addToast(error.message || 'Failed to update registrar staff account.', 'error');
    } finally {
      setBusyStaffId(null);
    }
  };

  return (
    <div className="dashboard-page registrar-staff-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Registrar Staff</h1>
        <p className="dashboard-subtext">
          Create staff accounts and suspend or restore their access.
        </p>
      </header>

      <section className="registrar-staff-create" aria-labelledby="create-staff-heading">
        <div className="registrar-staff-section-heading">
          <h2 id="create-staff-heading" className="settings-section-title">Create staff account</h2>
        </div>
        <form className="registrar-staff-form" onSubmit={createStaffAccount}>
          <label>
            <span>Full name</span>
            <input
              className="auth-input"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              autoComplete="name"
              maxLength={160}
              required
            />
          </label>
          <label>
            <span>Email address</span>
            <input
              className="auth-input"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label>
            <span>Initial password</span>
            <input
              className="auth-input"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <small>Use at least 12 characters. Share the password with the staff member securely.</small>
          </label>
          <button type="submit" className="btn-primary" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create staff account'}
          </button>
        </form>
      </section>

      <section className="registrar-staff-list-section" aria-labelledby="staff-list-heading">
        <div className="registrar-staff-section-heading">
          <div>
            <h2 id="staff-list-heading" className="settings-section-title">Staff accounts</h2>
            <p className="dashboard-subtext">
              {staff.length} {staff.length === 1 ? 'account' : 'accounts'}
            </p>
          </div>
        </div>
        <div className="request-table-wrapper registrar-staff-table" role="region" aria-label="Registrar staff accounts">
          <table className="request-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th className="registrar-staff-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5}>Loading staff accounts...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={5}>No registrar staff accounts found.</td></tr>
              ) : staff.map((account) => (
                <tr key={account.id}>
                  <td>{account.full_name}</td>
                  <td>{account.email}</td>
                  <td>
                    <span className={`registrar-staff-status${account.active ? ' is-active' : ' is-disabled'}`}>
                      {account.active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{new Date(account.created_at).toLocaleDateString()}</td>
                  <td className="registrar-staff-actions">
                    <button
                      type="button"
                      className="workflow-step-button"
                      onClick={() => setStaffActive(account, !account.active)}
                      disabled={busyStaffId === account.id}
                    >
                      {account.active ? 'Suspend account' : 'Restore account'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default RegistrarStaffManagement;
