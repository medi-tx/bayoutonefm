import { ICON } from '../icons.js';

export default function ServerBar({ servers, selectedServerId, onSelect, onCreateServer, onLogout, user }) {
  return (
    <div className="server-bar">
      <div className="user-badge" title={`Logged in as ${user.username}`}>
        <span className="user-letter" style={{ background: user.avatar_color }}>
          {user.username.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="server-divider" />

      <div className="server-list">
        {servers.map((s) => (
          <button
            key={s.id}
            className={s.id === selectedServerId ? 'server-pill active' : 'server-pill'}
            title={s.name}
            onClick={() => onSelect(s)}
          >
            <span className="server-pill-icon">{s.icon}</span>
          </button>
        ))}

        <button className="server-pill add" title="Create a new server" onClick={onCreateServer}>
          <span className="server-pill-icon">{ICON.plus}</span>
        </button>
      </div>

      <div className="server-divider" />
      <button className="server-pill logout" title="Log out" onClick={onLogout}>
        <span className="server-pill-icon">{ICON.door}</span>
      </button>
    </div>
  );
}