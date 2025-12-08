'use client';

import { useQuery, gql } from '@apollo/client';
import { useCascadeMutation } from '@graphql-cascade/apollo';
import { generateCheckoutOptimisticResponse } from '../../lib/cascade-optimistic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const GET_CART = gql`
  query GetCart {
    cart {
      id
      productId
      quantity
      product {
        id
        name
        description
        price
        inventory
        category
      }
    }
  }
`;

const CHECKOUT = gql`
  mutation Checkout {
    checkout {
      success
      errors {
        message
        code
      }
      data {
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
      cascade {
        updated {
          __typename
          id
          operation
          entity
        }
        deleted {
          __typename
          id
        }
        invalidations {
          queryName
          strategy
          scope
        }
        metadata {
          timestamp
          affectedCount
        }
      }
    }
  }
`;

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    inventory: number;
    category: string;
  };
}

export function CheckoutView() {
  const router = useRouter();
  const { loading, error, data } = useQuery<{ cart: CartItem[] }>(GET_CART);

  const [checkout, { loading: checkoutLoading }] = useCascadeMutation(CHECKOUT, {
    optimistic: true,
    optimisticCascadeResponse: () => {
      if (!data?.cart) return null as any;
      return generateCheckoutOptimisticResponse(data.cart);
    },
    onCompleted: (data, cascade) => {
      console.log('Checkout completed:', data);
      console.log('Cascade updates:', cascade);
      // Redirect to order confirmation or orders page
      router.push('/orders');
    },
    onError: (error) => {
      console.error('Checkout failed:', error);
      alert('Checkout failed. Please try again.');
    },
  });

  if (loading) return <div className="text-center py-8">Loading cart...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading cart: {error.message}</div>;

  const cartItems = data?.cart || [];

  if (cartItems.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your cart is empty</h2>
        <p className="text-gray-600 mb-8">Add some products before checking out!</p>
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const total = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // Check if all items are in stock
  const hasInsufficientStock = cartItems.some(item => item.quantity > item.product.inventory);

  const handleCheckout = async () => {
    if (hasInsufficientStock) {
      alert('Some items in your cart are no longer available in the requested quantity. Please update your cart.');
      return;
    }

    try {
      await checkout();
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>

          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.product.name}</h3>
                  <p className="text-sm text-gray-600">{item.product.description}</p>
                  <p className="text-sm text-gray-500">
                    ${item.product.price.toFixed(2)} × {item.quantity}
                  </p>
                  {item.quantity > item.product.inventory && (
                    <p className="text-sm text-red-600">
                      Only {item.product.inventory} available
                    </p>
                  )}
                </div>

                <span className="font-medium text-gray-900">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center text-xl font-semibold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {hasInsufficientStock && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-400">⚠️</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Inventory Issue
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Some items in your cart are no longer available in the requested quantity.
                Please update your cart before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipping Information</h2>
        <div className="text-gray-600">
          <p>This is a demo application. In a real e-commerce site, you would collect shipping and payment information here.</p>
        </div>
      </div>

      <div className="flex space-x-4">
        <Link
          href="/cart"
          className="flex-1 text-center bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Back to Cart
        </Link>

        <button
          onClick={handleCheckout}
          disabled={checkoutLoading || hasInsufficientStock}
          className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {checkoutLoading ? 'Processing...' : 'Complete Order'}
        </button>
      </div>
    </div>
  );
}