import { ICON } from '../icons.js';

function formatTime(iso) {
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function MessageList({ messages, user }) {
  let lastUser = null;

  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty-channel">
          <h3>{ICON.wave} It's quiet in here!</h3>
          <p>Type a message below to start chatting with your friends.</p>
        </div>
      )}

      {messages.map((m) => {
        const grouped = m.userId === lastUser;
        lastUser = m.userId;
        return (
          <div key={m.id} className={grouped ? 'message grouped' : 'message'}>
            {!grouped && (
              <span className="msg-avatar" style={{ background: m.avatarColor }}>
                {m.username.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="msg-body">
              {!grouped && (
                <div className="msg-meta">
                  <span className="msg-author">{m.username}</span>
                  <span className="msg-time">{formatTime(m.createdAt)}</span>
                </div>
              )}
              <div className="msg-content">
                {m.content}
                {m.flagged && (
                  <span className="msg-flagged" title={`Filtered: ${m.reasons}`}>
                    {ICON.shield} Filtered
                  </span>
                )}
              </div>
              {m.userId === user.id && grouped && <div className="msg-group-spacer" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}