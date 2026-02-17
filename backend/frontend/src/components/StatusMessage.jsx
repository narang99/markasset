export function StatusMessage({ message, type }) {
  if (!message) return null;

  return (
    <div className="status">
      <div className={`status-${type}`}>
        {type === 'error' ? 'Error: ' : ''}{message}
      </div>
    </div>
  );
}