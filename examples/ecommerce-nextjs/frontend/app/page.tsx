import { gql } from '@apollo/client';
import { ProductsList } from './components/ProductsList';

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

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Our Store
        </h1>
        <p className="text-lg text-gray-600">
          Discover amazing products with real-time inventory updates
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Featured Products</h2>
        <ProductsList />
      </div>
    </div>
  );
}