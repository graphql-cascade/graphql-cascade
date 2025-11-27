export interface User {
  id: string;
  name: string;
  email: string;
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
  authorId: string;
  channelId: string;
  createdAt: Date;
  updatedAt: Date;
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
    authorId: '1',
    channelId: '1',
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z'),
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

export function createMessage(content: string, authorId: string, channelId: string): Message {
  const message: Message = {
    id: (messages.length + 1).toString(),
    content,
    authorId,
    channelId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  messages.push(message);
  return message;
}

// Additional helper functions for resolvers
export const getUsers = (): User[] => users;
export const getChannels = (): Channel[] => channels;
export const getMessages = (): Message[] => messages;

export const createUser = (name: string): User => {
  const user: User = { id: (users.length + 1).toString(), name };
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

// Helper function to get message with populated author
export const getMessageWithAuthor = (id: string): (Message & { author: User }) | undefined => {
  const message = messages.find(m => m.id === id);
  if (!message) return undefined;

  const author = getUserById(message.authorId);
  if (!author) return undefined;

  return { ...message, author };
};

// Helper function to get messages with populated authors
export const getMessagesWithAuthors = (channelId?: string): (Message & { author: User })[] => {
  let msgs = messages;
  if (channelId) {
    msgs = msgs.filter(m => m.channelId === channelId);
  }

  return msgs.map(msg => {
    const author = getUserById(msg.authorId);
    if (!author) throw new Error(`Author not found for message ${msg.id}`);
    return { ...msg, author };
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};