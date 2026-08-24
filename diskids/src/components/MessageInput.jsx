import { useState } from 'react';
import { ICON } from '../icons.js';

export default function MessageInput({ onSend, rateLimited, error }) {
  const [text, setText] = useState('');

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }

  return (
    <div className="message-input-wrap">
      {error && <div className="input-error">{error}</div>}
      <form onSubmit={submit} className="message-input-form">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Be kind! Type a message..."
        />
        <button type="submit" className="btn-primary send-btn">{ICON.send} Send</button>
      </form>
      <div className="input-hint">
        {rateLimited ? `${ICON.turtle} Whoa, slow down a sec!` : `${ICON.shield} Messages are kept friendly automatically.`}
      </div>
    </div>
  );
}