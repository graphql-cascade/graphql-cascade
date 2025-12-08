import React, { useState } from 'react';
import { useMutation } from 'urql';

const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($channelId: ID!, $content: String!, $senderId: ID!) {
    sendMessage(channelId: $channelId, content: $content, senderId: $senderId) {
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

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [{ fetching }, sendMessage] = useMutation(SEND_MESSAGE_MUTATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    // For demo purposes, use a hardcoded sender ID
    // In a real app, this would come from authentication
    const senderId = 'user-1';

    // Optimistic update: add message to cache immediately
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      sender: {
        id: senderId,
        name: "You", // Demo name
      },
      createdAt: new Date().toISOString(),
    };

    await sendMessage(
      {
        channelId,
        content: content.trim(),
        senderId,
      },
      {
        // Optimistic response for immediate UI update
        optimisticResponse: {
          sendMessage: {
            message: optimisticMessage,
            cascade: {
              invalidate: [],
              update: null,
            },
          },
        },
      }
    );

    setContent('');
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a message..."
        disabled={fetching}
      />
      <button type="submit" disabled={fetching || !content.trim()}>
        {fetching ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}