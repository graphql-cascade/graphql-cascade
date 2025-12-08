'use client';

import { useQuery, gql } from '@apollo/client';

const GET_ORDERS = gql`
  query GetOrders {
    orders {
      id
      items {
        id
        productId
        quantity
        product {
          id
          name
          price
        }
      }
      total
      status
      createdAt
    }
  }
`;

interface Order {
  id: string;
  items: {
    id: string;
    productId: string;
    quantity: number;
    product: {
      id: string;
      name: string;
      price: number;
    };
  }[];
  total: number;
  status: string;
  createdAt: string;
}

export function OrdersView() {
  const { loading, error, data } = useQuery<{ orders: Order[] }>(GET_ORDERS);

  if (loading) return <div className="text-center py-8">Loading orders...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading orders: {error.message}</div>;

  const orders = data?.orders || [];

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 text-6xl mb-4">📦</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">No orders yet</h2>
        <p className="text-gray-600 mb-8">Your order history will appear here once you make a purchase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orders.map((order) => (
        <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                <p className="text-sm text-gray-600">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {order.status}
                </span>
                <p className="text-lg font-bold text-gray-900 mt-1">${order.total.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <span className="font-medium text-gray-900">{item.product.name}</span>
                    <span className="text-sm text-gray-600 ml-2">× {item.quantity}</span>
                  </div>
                  <span className="text-gray-900">${(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}