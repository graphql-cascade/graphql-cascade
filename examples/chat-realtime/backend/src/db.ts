export interface User {
  id: string;
  name: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  channelId: string;
  createdAt: Date;
}

// In-memory database
export const users: User[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Charlie' },
];

export const channels: Channel[] = [
  {
    id: '1',
    name: 'general',
    description: 'General discussion',
    createdAt: new Date('2023-01-01'),
  },
  {
    id: '2',
    name: 'random',
    description: 'Random chat',
    createdAt: new Date('2023-01-01'),
  },
];

export const messages: Message[] = [
  {
    id: '1',
    content: 'Welcome to the chat!',
    senderId: '1',
    channelId: '1',
    createdAt: new Date('2023-01-01T10:00:00Z'),
  },
];

// Helper functions
export function getUserById(id: string): User | undefined {
  return users.find(user => user.id === id);
}

export function getChannelById(id: string): Channel | undefined {
  return channels.find(channel => channel.id === id);
}

export function getMessagesByChannelId(channelId: string): Message[] {
  return messages.filter(message => message.channelId === channelId);
}

export function createMessage(content: string, senderId: string, channelId: string): Message {
  const message: Message = {
    id: (messages.length + 1).toString(),
    content,
    senderId,
    channelId,
    createdAt: new Date(),
  };
  messages.push(message);
  return message;
}

// Additional helper functions for resolvers
export const getUsers = (): User[] => users;
export const getChannels = (): Channel[] => channels;
export const getMessages = (): Message[] => messages;

export const createUser = (name: string, email: string): User => {
  const user: User = { id: (users.length + 1).toString(), name, email };
  users.push(user);
  return user;
};

export const createChannel = (name: string, description?: string): Channel => {
  const channel: Channel = {
    id: (channels.length + 1).toString(),
    name,
    description,
    createdAt: new Date(),
  };
  channels.push(channel);
  return channel;
};

// Helper function to get message with populated sender
export const getMessageWithSender = (id: string): (Message & { sender: User }) | undefined => {
  const message = messages.find(m => m.id === id);
  if (!message) return undefined;

  const sender = getUserById(message.senderId);
  if (!sender) return undefined;

  return { ...message, sender };
};

// Helper function to get messages with populated senders
export const getMessagesWithSenders = (channelId?: string): (Message & { sender: User })[] => {
  let msgs = messages;
  if (channelId) {
    msgs = msgs.filter(m => m.channelId === channelId);
  }

  return msgs.map(msg => {
    const sender = getUserById(msg.senderId);
    if (!sender) throw new Error(`Sender not found for message ${msg.id}`);
    return { ...msg, sender };
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};