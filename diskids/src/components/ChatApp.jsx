import { useEffect, useRef, useState } from 'react';
import { api, socket } from '../api.js';
import ServerBar from './ServerBar.jsx';
import ChannelBar from './ChannelBar.jsx';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import Modal from './Modal.jsx';
import { SERVER_ICONS, DEFAULT_ICON, ICON } from '../icons.js';

export default function ChatApp({ user, onLogout }) {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [inputError, setToast2] = useState(false);
  const selectedChannelRef = useRef(null);
  selectedChannelRef.current = selectedChannel;

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // load servers on mount
  useEffect(() => {
    api('/api/servers')
      .then((d) => {
        setServers(d.servers);
        if (d.servers[0]) setSelectedServer(d.servers[0]);
      })
      .catch((e) => flash(e.message));
  }, []);

  // load channels when server changes
  useEffect(() => {
    if (!selectedServer) return;
    api(`/api/servers/${selectedServer.id}/channels`)
      .then((d) => {
        setChannels(d.channels);
        setSelectedChannel(d.channels[0] ?? null);
      })
      .catch((e) => flash(e.message));
  }, [selectedServer]);

  // load messages when channel changes + join socket room
  useEffect(() => {
    if (!selectedChannel) { setMessages([]); return; }
    socket.connect();
    socket.emit('join_channel', { channelId: selectedChannel.id });
    api(`/api/channels/${selectedChannel.id}/messages`)
      .then((d) => setMessages(d.messages))
      .catch((e) => flash(e.message));
  }, [selectedChannel]);

  // socket listeners
  useEffect(() => {
    socket.connect();

    function onMessage(m) {
      if (m.channelId === selectedChannelRef.current?.id) {
        setMessages((prev) => [...prev, m]);
      }
    }
    function onChannelAdded({ serverId, channel }) {
      if (selectedChannelRef.current && serverId === selectedChannelRef.current.server_id) {
        setChannels((prev) => [...prev, channel]);
      }
    }
    function onRateLimited() { flash('Whoa, slow down a sec!'); setToast2(true); setTimeout(() => setToast2(false), 1000); }
    function onMessageError(e) { flash(e.error || 'Message error'); }
    function onAuthError() { flash('Your session ended. Please log in again.'); }

    socket.on('message', onMessage);
    socket.on('channel_added', onChannelAdded);
    socket.on('rate_limited', onRateLimited);
    socket.on('message_error', onMessageError);
    socket.on('auth_error', onAuthError);

    return () => {
      socket.off('message', onMessage);
      socket.off('channel_added', onChannelAdded);
      socket.off('rate_limited', onRateLimited);
      socket.off('message_error', onMessageError);
      socket.off('auth_error', onAuthError);
    };
  }, []);

  function sendMessage(text) {
    if (!selectedChannel) return;
    socket.emit('message', { channelId: selectedChannel.id, content: text });
  }

  async function handleCreateServer(fields) {
    try {
      const { server } = await api('/api/servers', {
        method: 'POST',
        body: { name: fields.name, icon: fields.icon, parentalPin: fields.pin },
      });
      setServers((prev) => [...prev, server]);
      setSelectedServer(server);
      setModal(null);
      flash(`Server created! ${ICON.party}`);
    } catch (e) {
      flash(e.message);
    }
  }

  async function handleCreateChannel(fields) {
    if (!selectedServer) return;
    try {
      const { channel } = await api(`/api/servers/${selectedServer.id}/channels`, {
        method: 'POST',
        body: { name: fields.name, topic: '', parentalPin: fields.pin },
      });
      // backend pushes channel_added via socket too, but add locally to be safe
      setChannels((prev) => (prev.some((c) => c.id === channel.id) ? prev : [...prev, channel]));
      setSelectedChannel(channel);
      setModal(null);
    } catch (e) {
      flash(e.message);
    }
  }

  return (
    <div className="app-shell">
      <ServerBar
        servers={servers}
        selectedServerId={selectedServer?.id}
        onSelect={setSelectedServer}
        onCreateServer={() => setModal('server')}
        onLogout={onLogout}
        user={user}
      />

      {selectedServer ? (
        <ChannelBar
          server={selectedServer}
          channels={channels}
          selectedChannelId={selectedChannel?.id}
          onSelect={setSelectedChannel}
          onCreateChannel={() => setModal('channel')}
        />
      ) : (
        <div className="channel-bar empty">
          <div className="empty-channel">
            <h3>{ICON.sparkles} No clubs yet!</h3>
            <p>Tap the + button to create your first server.</p>
          </div>
        </div>
      )}

      <div className="chat-main">
        {selectedChannel ? (
          <>
            <div className="chat-header">
              <span className="chat-header-hash">#</span>
              <span className="chat-header-name">{selectedChannel.name}</span>
              {selectedChannel.topic && <span className="chat-header-topic">{selectedChannel.topic}</span>}
            </div>
            <MessageList messages={messages} user={user} />
            <MessageInput onSend={sendMessage} rateLimited={inputError} error={null} />
          </>
        ) : (
          <div className="chat-main empty">
            <div className="empty-channel">
              <h3>{ICON.speech} Pick a channel</h3>
              <p>Choose a channel on the left to start chatting!</p>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {modal === 'server' && (
        <Modal
          title="New Server"
          subtitle="Make a friendly club for you and your friends."
          icon={DEFAULT_ICON}
          emojiOptions={SERVER_ICONS}
          onClose={() => setModal(null)}
          onSubmit={handleCreateServer}
        />
      )}
      {modal === 'channel' && (
        <Modal
          title="New Channel"
          subtitle="Add a new conversation topic to this server."
          icon={ICON.hash}
          onClose={() => setModal(null)}
          onSubmit={handleCreateChannel}
        />
      )}
    </div>
  );
}