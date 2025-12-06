import { CheckoutView } from '../components/CheckoutView';

export default function CheckoutPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout</h1>
        <p className="text-gray-600">
          Complete your order
        </p>
      </div>

      <CheckoutView />
    </div>
  );
}