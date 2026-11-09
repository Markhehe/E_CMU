import { useRef, useState } from 'react';
import { readSheet } from 'read-excel-file/browser';
import writeExcelFile from 'write-excel-file/browser';
import { StudentDirectoryService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/registrarStudentEntry.css';

const FIELDS = ['studentId', 'firstName', 'middleName', 'lastName', 'birthdate'];
const FIELD_LABELS = {
  studentId: 'Student ID',
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  birthdate: 'Birthdate',
};
const EMPTY_FORM = {
  studentId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthdate: '',
};
const MAX_IMPORT_ROWS = 500;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const EXCEL_TEMPLATE_ROWS = [
  ['Student ID', 'First name', 'Middle name', 'Last name', 'Birthdate'],
  ['20230554', 'Mark', '', 'E', '2004-05-23'],
];

function normalizeHeader(value) {
  return String(value ?? '').replace(/[\uFEFF\s_-]/g, '').toLowerCase();
}

function mapHeaders(headers) {
  const aliases = {
    studentid: 'studentId',
    firstname: 'firstName',
    middlename: 'middleName',
    lastname: 'lastName',
    birthdate: 'birthdate',
  };
  return headers.map((header) => aliases[normalizeHeader(header)] || null);
}

function rowsToRecords(rows) {
  if (!rows.length) throw new Error('The selected file has no rows.');
  const headerFields = mapHeaders(rows[0]);
  const missingFields = ['studentId', 'firstName', 'lastName', 'birthdate']
    .filter((field) => !headerFields.includes(field));
  if (missingFields.length) {
    throw new Error(`Missing columns: ${missingFields.map((field) => FIELD_LABELS[field]).join(', ')}.`);
  }

  return rows.slice(1)
    .map((row) => Object.fromEntries(headerFields.map((field, index) => {
      if (!field) return [null, null];
      const value = row[index];
      return [field, value instanceof Date && field === 'birthdate'
        ? value.toISOString().slice(0, 10)
        : value ?? ''];
    }).filter(([field]) => field)));
}

function parseDelimitedText(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('The delimited file contains an unclosed quoted value.');
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function normalizeJsonRecords(input) {
  const records = Array.isArray(input) ? input : [input];
  if (!records.length || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new Error('JSON must be a student object or an array of student objects.');
  }
  return records.map((record) => {
    const mapped = {};
    for (const [key, value] of Object.entries(record)) {
      const field = mapHeaders([key])[0];
      if (field) mapped[field] = value;
    }
    return mapped;
  });
}

function validateRecords(records) {
  if (!records.length) return 'Add at least one student record.';
  if (records.length > MAX_IMPORT_ROWS) return `An import can contain at most ${MAX_IMPORT_ROWS} records.`;

  const ids = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const row = index + 1;
    for (const field of ['studentId', 'firstName', 'lastName', 'birthdate']) {
      if (!String(record[field] ?? '').trim()) {
        return `Row ${row}: ${FIELD_LABELS[field]} is required.`;
      }
    }
    if (String(record.studentId).trim().length > 64) return `Row ${row}: Student ID must be 64 characters or fewer.`;
    for (const field of ['firstName', 'middleName', 'lastName']) {
      if (String(record[field] ?? '').trim().length > 120) {
        return `Row ${row}: ${FIELD_LABELS[field]} must be 120 characters or fewer.`;
      }
    }

    const birthdate = String(record.birthdate).trim();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? new Date(`${birthdate}T00:00:00.000Z`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== birthdate) {
      return `Row ${row}: Birthdate must be a valid date in YYYY-MM-DD format.`;
    }

    const studentId = String(record.studentId).trim();
    if (ids.has(studentId)) return `Student ID ${studentId} appears more than once in this import.`;
    ids.add(studentId);
  }
  return '';
}

function prepareRecords(records) {
  return records.map((record) => Object.fromEntries(FIELDS.map((field) => [
    field,
    String(record[field] ?? '').trim(),
  ])));
}

export default function RegistrarStudentEntry() {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState([]);
  const [jsonText, setJsonText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef(null);

  const importRecords = async (records, clearForm) => {
    const validationError = validateRecords(records);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await StudentDirectoryService.add(
        records.map((record) => Object.fromEntries(FIELDS.map((field) => [field, record[field]]))),
      );
      addToast(
        `Added ${result.inserted} new ${result.inserted === 1 ? 'student' : 'students'}. `
        + `${result.skipped} already existed; no changes were made to those records.`,
        'success',
      );
      if (clearForm) setForm(EMPTY_FORM);
      setPreview([]);
      setJsonText('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to add student records.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const markExistingRecords = async (records) => {
    const existingIds = new Set(await StudentDirectoryService.findExisting(
      records.map((record) => record.studentId),
    ));
    return records.map((record) => ({
      ...record,
      alreadyExists: existingIds.has(record.studentId),
    }));
  };

  const processImportFile = async (file) => {
    if (!file) return;
    setErrorMessage('');
    setSelectedFileName(file.name);
    setIsReadingFile(true);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('Files must be 10 MB or smaller.');
      const extension = file.name.split('.').pop()?.toLowerCase();
      let records;
      if (extension === 'xlsx') {
        const rows = await readSheet(file, 1);
        records = rowsToRecords(rows);
      } else if (extension === 'csv' || extension === 'tsv') {
        const rows = parseDelimitedText(await file.text(), extension === 'tsv' ? '\t' : ',');
        records = rowsToRecords(rows);
      } else {
        throw new Error('Choose a CSV, TSV, or XLSX file.');
      }

      records = prepareRecords(records);
      const validationError = validateRecords(records);
      if (validationError) throw new Error(validationError);
      setPreview(await markExistingRecords(records));
      setJsonText('');
    } catch (error) {
      setPreview([]);
      setErrorMessage(error.message || 'Unable to read the selected file.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const importFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    void processImportFile(file);
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    void processImportFile(event.dataTransfer.files?.[0]);
  };

  const parseJson = async () => {
    setErrorMessage('');
    try {
      const records = prepareRecords(normalizeJsonRecords(JSON.parse(jsonText)));
      const validationError = validateRecords(records);
      if (validationError) throw new Error(validationError);
      setPreview(await markExistingRecords(records));
    } catch (error) {
      setPreview([]);
      setErrorMessage(error instanceof SyntaxError ? 'Enter valid JSON.' : error.message);
    }
  };

  const downloadExcelTemplate = async () => {
    try {
      const blob = await writeExcelFile(EXCEL_TEMPLATE_ROWS).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-directory-template.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      addToast(error.message || 'Unable to create the Excel template.', 'error');
    }
  };

  return (
    <div className="dashboard-page registrar-student-entry-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Enter New Students</h1>
        <p className="dashboard-subtext">
          Add students to the directory used to verify student registrations. This does not create login accounts.
        </p>
      </header>

      <section className="registrar-entry-card" aria-labelledby="student-entry-heading">
        <div className="registrar-entry-heading">
          <h2 id="student-entry-heading" className="settings-section-title">Add one student</h2>
        </div>
        <form
          className="registrar-entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            void importRecords([form], true);
          }}
        >
          <label><span>Student ID</span><input className="auth-input" value={form.studentId} maxLength={64} required onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))} /></label>
          <label><span>First name</span><input className="auth-input" value={form.firstName} maxLength={120} required onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /></label>
          <label><span>Middle name <small>(optional)</small></span><input className="auth-input" value={form.middleName} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, middleName: event.target.value }))} /></label>
          <label><span>Last name</span><input className="auth-input" value={form.lastName} maxLength={120} required onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></label>
          <label><span>Birthdate</span><input className="auth-input" type="date" value={form.birthdate} required onChange={(event) => setForm((current) => ({ ...current, birthdate: event.target.value }))} /></label>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add student'}</button>
        </form>
      </section>

      <section className="registrar-entry-card" aria-labelledby="bulk-entry-heading">
        <div className="registrar-entry-heading">
          <div>
            <h2 id="bulk-entry-heading" className="settings-section-title">Add multiple students</h2>
            <p className="dashboard-subtext">Up to {MAX_IMPORT_ROWS} records per import. Columns: Student ID, First name, Middle name, Last name, Birthdate.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void downloadExcelTemplate()}>
            Download Excel template
          </button>
        </div>
        <div className="registrar-entry-bulk-options">
          <div className="registrar-entry-upload-panel">
            <div
              className={`registrar-entry-file-drop${isDragActive ? ' is-drag-active' : ''}${selectedFileName ? ' has-file' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragActive(false);
              }}
              onDrop={handleFileDrop}
            >
              <input
                ref={fileInputRef}
                className="registrar-entry-file-input"
                type="file"
                accept=".csv,.tsv,.xlsx"
                onChange={importFile}
                aria-label="Choose a CSV, TSV, or XLSX student file"
              />
              <div className="registrar-entry-upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
                  <path d="M4.5 15.5v3A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
                </svg>
              </div>
              {isReadingFile ? (
                <>
                  <strong>Reading your file...</strong>
                  <span className="registrar-entry-file-hint">{selectedFileName}</span>
                </>
              ) : selectedFileName ? (
                <>
                  <strong className="registrar-entry-selected-file">{selectedFileName}</strong>
                  <span className="registrar-entry-file-hint">Choose another file or drop it here to replace it.</span>
                </>
              ) : (
                <>
                  <strong>{isDragActive ? 'Drop your file to get started' : 'Drag and drop your file here'}</strong>
                  <span className="registrar-entry-file-hint">or browse files from your device</span>
                </>
              )}
              <button
                type="button"
                className="btn-secondary registrar-entry-choose-file"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingFile}
              >
                {selectedFileName && !isReadingFile ? 'Choose another file' : 'Choose file'}
              </button>
              <div className="registrar-entry-file-types" aria-label="Supported file types">
                <span>.CSV</span><span>.TSV</span><span>.XLSX</span>
                <small>Maximum 10 MB</small>
              </div>
            </div>
            <p className="registrar-entry-file-note">
              Use the template above for the correct columns. Remove its example row before uploading.
            </p>
          </div>
          <div className="registrar-entry-json">
            <label htmlFor="student-json-input">Or paste a JSON object or array</label>
            <textarea
              id="student-json-input"
              className="auth-input"
              rows={7}
              value={jsonText}
              placeholder={'[{"studentId":"20230554","firstName":"Mark","middleName":"","lastName":"E","birthdate":"2004-05-23"}]'}
              onChange={(event) => setJsonText(event.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={parseJson} disabled={!jsonText.trim()}>Preview JSON</button>
          </div>
        </div>
      </section>

      {errorMessage && <p className="registrar-entry-error" role="alert">{errorMessage}</p>}

      {preview.length > 0 && (
        <section className="registrar-entry-card registrar-entry-preview" aria-labelledby="preview-heading">
          <div className="registrar-entry-heading">
            <div>
              <h2 id="preview-heading" className="settings-section-title">Import preview</h2>
              <p className="dashboard-subtext">
                {preview.filter((record) => !record.alreadyExists).length} new students will be added.
                {' '}{preview.filter((record) => record.alreadyExists).length} already exist and will not be changed.
              </p>
            </div>
            <div className="registrar-entry-actions">
              <button type="button" className="btn-secondary" onClick={() => setPreview([])} disabled={isSubmitting}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void importRecords(preview, false)}
                disabled={isSubmitting || !preview.some((record) => !record.alreadyExists)}
              >
                {isSubmitting ? 'Adding...' : `Add ${preview.filter((record) => !record.alreadyExists).length} new students`}
              </button>
            </div>
          </div>
          <div className="registrar-entry-table-wrap">
            <table className="registrar-entry-table">
              <thead><tr>{FIELDS.map((field) => <th key={field}>{FIELD_LABELS[field]}</th>)}<th>Status</th></tr></thead>
              <tbody>{preview.slice(0, 10).map((record, index) => (
                <tr
                  key={`${record.studentId}-${index}`}
                  className={record.alreadyExists ? 'registrar-entry-existing-row' : ''}
                >
                  {FIELDS.map((field) => <td key={field}>{record[field] || '—'}</td>)}
                  <td>
                    <span className={`registrar-entry-status${record.alreadyExists ? ' is-existing' : ' is-new'}`}>
                      {record.alreadyExists ? 'Already exists — unchanged' : 'New'}
                    </span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {preview.length > 10 && <p className="registrar-entry-more">Showing first 10 of {preview.length} records.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
