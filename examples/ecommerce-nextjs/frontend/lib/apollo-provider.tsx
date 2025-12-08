'use client';

import { ApolloProvider } from '@apollo/client';
import { ReactNode } from 'react';
import client from './apollo-client';

interface ApolloProviderWrapperProps {
  children: ReactNode;
}

export function ApolloProviderWrapper({ children }: ApolloProviderWrapperProps) {
  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}