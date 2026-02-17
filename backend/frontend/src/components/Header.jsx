export function Header({ user, isAuthenticated, onLogin, onLogout }) {
  return (
    <header>
      {isAuthenticated && (
        <button className="logout-floating" onClick={onLogout} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16,17 21,12 16,7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      )}
      <h1>
        <img 
          src="./icons/favicon-32x32.png" 
          alt="MarkAsset" 
          style={{ verticalAlign: 'middle', marginRight: '8px' }} 
        />
        MarkAsset
      </h1>
      <p>Sync files between your camera and VSCode</p>
      {!isAuthenticated && (
        <div className="auth-section">
          <button className="auth-btn auth-btn-primary" onClick={onLogin}>
            Sign in with Google
          </button>
        </div>
      )}
    </header>
  );
}