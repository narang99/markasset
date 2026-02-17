export function ProgressBar({ progress, message, isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="progress">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="progress-text">
        {Math.round(progress)}% - {message}
      </div>
    </div>
  );
}