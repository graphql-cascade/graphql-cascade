import React, { useState } from 'react';
import { ChannelList } from './components/ChannelList';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';

function App() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  return (
    <div className="app">
      <div className="sidebar">
        <ChannelList
          selectedChannel={selectedChannel}
          onChannelSelect={setSelectedChannel}
        />
      </div>
      <div className="main">
        {selectedChannel ? (
          <>
            <MessageList channelId={selectedChannel} />
            <MessageInput channelId={selectedChannel} />
          </>
        ) : (
          <div className="placeholder">Select a channel to start chatting</div>
        )}
      </div>
    </div>
  );
}

export default App;