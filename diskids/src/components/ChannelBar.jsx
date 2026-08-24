import { ICON } from '../icons.js';

export default function ChannelBar({ server, channels, selectedChannelId, onSelect, onCreateChannel }) {
  return (
    <div className="channel-bar">
      <div className="channel-bar-header">
        <span className="channel-bar-icon">{server.icon}</span>
        <div>
          <h2 className="channel-bar-title">{server.name}</h2>
          <span className="channel-bar-sub">Friendly club</span>
        </div>
      </div>

      <div className="channel-list-label">{ICON.speech} Channels</div>
      <div className="channel-list">
        {channels.map((c) => (
          <button
            key={c.id}
            className={c.id === selectedChannelId ? 'channel-item active' : 'channel-item'}
            onClick={() => onSelect(c)}
          >
            <span className="channel-hash">#</span>
            <span className="channel-name">{c.name}</span>
          </button>
        ))}
        <button className="channel-item add" onClick={onCreateChannel}>
          <span className="channel-hash">{ICON.plus}</span>
          <span className="channel-name">Add channel</span>
        </button>
      </div>
    </div>
  );
}