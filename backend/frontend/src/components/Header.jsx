export function Header({ user, isAuthenticated, onLogin, onLogout }) {
  return (
    <header>
      <h1>
        <img 
          src="./icons/favicon-32x32.png" 
          alt="MarkAsset" 
          style={{ verticalAlign: 'middle', marginRight: '8px' }} 
        />
        MarkAsset Upload
      </h1>
      <p>Upload images with your 4-character code</p>
      <div className="auth-section">
        {isAuthenticated ? (
          <>
            <div className="auth-status">
              Logged in as {user?.name || user?.email}
            </div>
            <button className="auth-btn" onClick={onLogout}>
              Sign Out
            </button>
          </>
        ) : (
          <button className="auth-btn" onClick={onLogin}>
            Login with Google
          </button>
        )}
      </div>
    </header>
  );
}