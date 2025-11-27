import { OrdersView } from '../components/OrdersView';

export default function OrdersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Order History</h1>
        <p className="text-gray-600">
          View your past orders
        </p>
      </div>

      <OrdersView />
    </div>
  );
}