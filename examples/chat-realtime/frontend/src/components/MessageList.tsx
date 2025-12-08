import React from 'react';
import { useQuery, useSubscription } from 'urql';

const MESSAGES_QUERY = `
  query GetMessages($channelId: ID!) {
    channel(id: $channelId) {
      id
      name
      messages {
        id
        content
        sender {
          id
          name
        }
        createdAt
      }
    }
  }
`;

const MESSAGE_ADDED_SUBSCRIPTION = `
  subscription OnMessageAdded($channelId: ID!) {
    messageAdded(channelId: $channelId) {
      message {
        id
        content
        sender {
          id
          name
        }
        createdAt
      }
      cascade {
        invalidate
        update
      }
    }
  }
`;

interface Message {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  messages: Message[];
}

interface MessageListProps {
  channelId: string;
}

export function MessageList({ channelId }: MessageListProps) {
  const [{ data, fetching, error }] = useQuery<{ channel: Channel }>({
    query: MESSAGES_QUERY,
    variables: { channelId },
  });

  // Subscribe to new messages
  useSubscription(
    {
      query: MESSAGE_ADDED_SUBSCRIPTION,
      variables: { channelId },
    },
    (messages, response) => {
      // The cascade exchange will handle updating the cache automatically
      return messages;
    }
  );

  if (fetching) return <div>Loading messages...</div>;
  if (error) return <div>Error loading messages: {error.message}</div>;
  if (!data?.channel) return <div>Channel not found</div>;

  return (
    <div className="message-list">
      <h3>{data.channel.name}</h3>
      <div className="messages">
        {data.channel.messages.map((message) => (
          <div key={message.id} className="message">
            <strong>{message.sender.name}:</strong> {message.content}
            <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}