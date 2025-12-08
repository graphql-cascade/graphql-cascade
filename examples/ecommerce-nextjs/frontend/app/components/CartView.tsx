'use client';

import { useQuery, gql } from '@apollo/client';
import { useCascadeMutation } from '@graphql-cascade/apollo';
import { generateUpdateCartItemOptimisticResponse, generateRemoveFromCartOptimisticResponse } from '../../lib/cascade-optimistic';
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

const UPDATE_CART_ITEM = gql`
  mutation UpdateCartItem($id: ID!, $quantity: Int!) {
    updateCartItem(id: $id, quantity: $quantity) {
      success
      errors {
        message
        code
      }
      data {
        id
        productId
        quantity
        product {
          id
          name
          inventory
        }
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

const REMOVE_FROM_CART = gql`
  mutation RemoveFromCart($id: ID!) {
    removeFromCart(id: $id) {
      success
      errors {
        message
        code
      }
      data {
        id
        productId
        quantity
        product {
          id
          name
          inventory
        }
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

export function CartView() {
  const { loading, error, data, refetch } = useQuery<{ cart: CartItem[] }>(GET_CART);

  const [updateCartItem] = useCascadeMutation(UPDATE_CART_ITEM, {
    optimistic: true,
    optimisticCascadeResponse: (variables) => {
      const cartItem = data?.cart.find(item => item.id === variables.id);
      if (!cartItem) return null as any;
      return generateUpdateCartItemOptimisticResponse(variables.id, variables.quantity, cartItem);
    },
    onCompleted: () => refetch(),
  });

  const [removeFromCart] = useCascadeMutation(REMOVE_FROM_CART, {
    optimistic: true,
    optimisticCascadeResponse: (variables) => {
      const cartItem = data?.cart.find(item => item.id === variables.id);
      if (!cartItem) return null as any;
      return generateRemoveFromCartOptimisticResponse(variables.id, cartItem);
    },
    onCompleted: () => refetch(),
  });

  if (loading) return <div className="text-center py-8">Loading cart...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading cart: {error.message}</div>;

  const cartItems = data?.cart || [];
  const total = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    const item = cartItems.find(item => item.id === itemId);
    if (!item || newQuantity > item.product.inventory) {
      alert('Not enough inventory available');
      return;
    }

    try {
      await updateCartItem({
        variables: { id: itemId, quantity: newQuantity },
      });
    } catch (error) {
      console.error('Error updating cart item:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeFromCart({
        variables: { id: itemId },
      });
    } catch (error) {
      console.error('Error removing cart item:', error);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your cart is empty</h2>
        <p className="text-gray-600 mb-8">Add some products to get started!</p>
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cart Items</h2>

          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 py-4 border-b border-gray-200 last:border-b-0">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.product.name}</h3>
                  <p className="text-sm text-gray-600">{item.product.description}</p>
                  <p className="text-sm text-gray-500">${item.product.price.toFixed(2)} each</p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      disabled={item.quantity >= item.product.inventory}
                    >
                      +
                    </button>
                  </div>

                  <span className="font-medium text-gray-900 w-20 text-right">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>

                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-600 hover:text-red-800 p-2"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <span className="text-xl font-semibold text-gray-900">Total:</span>
          <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
        </div>

        <Link
          href="/checkout"
          className="w-full block text-center bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}