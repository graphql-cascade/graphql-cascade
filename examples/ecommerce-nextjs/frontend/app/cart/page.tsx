import { CartView } from '../components/CartView';

export default function CartPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Shopping Cart</h1>
        <p className="text-gray-600">
          Review your items and proceed to checkout
        </p>
      </div>

      <CartView />
    </div>
  );
}