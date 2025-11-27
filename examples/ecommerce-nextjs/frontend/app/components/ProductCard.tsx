'use client';

import { useState } from 'react';
import { useCascadeMutation, gql } from '@graphql-cascade/apollo';
import { generateAddToCartOptimisticResponse } from '../../lib/cascade-optimistic';

const ADD_TO_CART = gql`
  mutation AddToCart($productId: ID!, $quantity: Int!) {
    addToCart(productId: $productId, quantity: $quantity) {
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

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [addToCart, { loading }] = useCascadeMutation(ADD_TO_CART, {
    optimistic: true,
    optimisticCascadeResponse: (variables) =>
      generateAddToCartOptimisticResponse(variables.productId, variables.quantity, product),
    onCompleted: (data, cascade) => {
      console.log('Added to cart:', data);
      console.log('Cascade updates:', cascade);
    },
    onError: (error) => {
      console.error('Failed to add to cart:', error);
    },
  });

  const handleAddToCart = async () => {
    if (product.inventory < quantity) {
      alert('Not enough inventory available');
      return;
    }

    try {
      await addToCart({
        variables: {
          productId: product.id,
          quantity,
        },
      });
      // Reset quantity after successful add
      setQuantity(1);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const isOutOfStock = product.inventory === 0;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
          <p className="text-gray-600 text-sm mb-2">{product.description}</p>
          <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
            {product.category}
          </span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
          <span className={`text-sm ${product.inventory > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}
          </span>
        </div>

        {!isOutOfStock && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <label htmlFor={`quantity-${product.id}`} className="text-sm text-gray-700">
                Quantity:
              </label>
              <input
                id={`quantity-${product.id}`}
                type="number"
                min="1"
                max={product.inventory}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
              />
            </div>

            <button
              onClick={handleAddToCart}
              disabled={loading || quantity > product.inventory}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        )}

        {isOutOfStock && (
          <button
            disabled
            className="w-full bg-gray-400 text-white py-2 px-4 rounded cursor-not-allowed"
          >
            Out of Stock
          </button>
        )}
      </div>
    </div>
  );
}