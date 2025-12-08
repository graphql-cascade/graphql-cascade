import { ProductsList } from '../components/ProductsList';

export default function ProductsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">All Products</h1>
        <p className="text-gray-600">
          Browse our complete collection of products
        </p>
      </div>

      <ProductsList />
    </div>
  );
}