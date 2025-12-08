import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ApolloProviderWrapper } from '../lib/apollo-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'E-commerce Store',
  description: 'A modern e-commerce store with GraphQL Cascade',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ApolloProviderWrapper>
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                  <h1 className="text-2xl font-bold text-gray-900">
                    <a href="/">E-commerce Store</a>
                  </h1>
                  <nav className="flex space-x-4">
                    <a href="/" className="text-gray-600 hover:text-gray-900">Home</a>
                    <a href="/products" className="text-gray-600 hover:text-gray-900">Products</a>
                    <a href="/cart" className="text-gray-600 hover:text-gray-900">Cart</a>
                  </nav>
                </div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </ApolloProviderWrapper>
      </body>
    </html>
  );
}