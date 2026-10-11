function RequestDisplaySelect({ mode, onChange }) {
  return (
    <select
      className="toolbar-select request-display-select"
      value={mode}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Request display mode"
    >
      <option value="scroll">View: Scrollbar</option>
      <option value="pagination">View: Pagination</option>
    </select>
  );
}

export default RequestDisplaySelect;
