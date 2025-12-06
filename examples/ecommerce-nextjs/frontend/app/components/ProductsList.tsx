'use client';

import { useQuery, gql } from '@apollo/client';
import { ProductCard } from './ProductCard';

const GET_PRODUCTS = gql`
  query GetProducts {
    products {
      id
      name
      description
      price
      inventory
      category
    }
  }
`;

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
}

export function ProductsList() {
  const { loading, error, data } = useQuery<{ products: Product[] }>(GET_PRODUCTS);

  if (loading) return <div className="text-center py-8">Loading products...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading products: {error.message}</div>;

  const products = data?.products || [];

  if (products.length === 0) {
    return <div className="text-center py-8 text-gray-500">No products available</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}