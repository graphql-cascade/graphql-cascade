import React from 'react';
import { useQuery } from 'urql';

const CHANNELS_QUERY = `
  query GetChannels {
    channels {
      id
      name
    }
  }
`;

interface Channel {
  id: string;
  name: string;
}

interface ChannelListProps {
  selectedChannel: string | null;
  onChannelSelect: (channelId: string) => void;
}

export function ChannelList({ selectedChannel, onChannelSelect }: ChannelListProps) {
  const [{ data, fetching, error }] = useQuery<{ channels: Channel[] }>({
    query: CHANNELS_QUERY,
  });

  if (fetching) return <div>Loading channels...</div>;
  if (error) return <div>Error loading channels: {error.message}</div>;

  return (
    <div className="channel-list">
      <h3>Channels</h3>
      <ul>
        {data?.channels.map((channel) => (
          <li
            key={channel.id}
            className={selectedChannel === channel.id ? 'selected' : ''}
            onClick={() => onChannelSelect(channel.id)}
          >
            {channel.name}
          </li>
        ))}
      </ul>
    </div>
  );
}