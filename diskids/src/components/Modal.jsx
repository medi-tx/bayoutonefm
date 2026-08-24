import { useEffect, useState } from 'react';
import { ICON } from '../icons.js';

export default function Modal({ title, subtitle, icon, emojiOptions, onClose, onSubmit }) {
  const [fields, setFields] = useState({ name: '', pin: '', icon: emojiOptions ? emojiOptions[0] : '' });

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(e) {
    e.preventDefault();
    onSubmit(fields);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose}>{ICON.cross}</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={fields.name}
              onChange={(e) => setFields({ ...fields, name: e.target.value })}
              maxLength={24}
              placeholder={title === 'New Server' ? 'My Awesome Club' : 'general'}
              autoFocus
              required
            />
          </label>

          {emojiOptions && (
            <label>
              <span>Pick an icon</span>
              <div className="emoji-row">
                {emojiOptions.map((em) => (
                  <button
                    type="button"
                    key={em}
                    className={fields.icon === em ? 'emoji-pick active' : 'emoji-pick'}
                    onClick={() => setFields({ ...fields, icon: em })}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </label>
          )}

          <label>
            <span>Parental PIN</span>
            <input
              type="password"
              value={fields.pin}
              onChange={(e) => setFields({ ...fields, pin: e.target.value })}
              placeholder="Ask a grown-up to enter the PIN"
              inputMode="numeric"
              required
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}