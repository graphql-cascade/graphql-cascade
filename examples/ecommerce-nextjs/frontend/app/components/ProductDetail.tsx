'use client';

import { useQuery, gql } from '@apollo/client';
import { useState } from 'react';
import { useCascadeMutation } from '@graphql-cascade/apollo';
import { generateAddToCartOptimisticResponse } from '../../lib/cascade-optimistic';

const GET_PRODUCT = gql`
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      name
      description
      price
      inventory
      category
    }
  }
`;

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

interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const { loading: productLoading, error: productError, data } = useQuery<{ product: Product }>(GET_PRODUCT, {
    variables: { id: productId },
  });

  const [addToCart, { loading: addToCartLoading }] = useCascadeMutation(ADD_TO_CART, {
    optimistic: true,
    optimisticCascadeResponse: (variables) => {
      if (!data?.product) return null as any;
      return generateAddToCartOptimisticResponse(variables.productId, variables.quantity, data.product);
    },
    onCompleted: (data, cascade) => {
      console.log('Added to cart:', data);
      console.log('Cascade updates:', cascade);
    },
    onError: (error) => {
      console.error('Failed to add to cart:', error);
    },
  });

  if (productLoading) return <div className="text-center py-8">Loading product...</div>;
  if (productError) return <div className="text-center py-8 text-red-600">Error loading product: {productError.message}</div>;
  if (!data?.product) return <div className="text-center py-8 text-gray-500">Product not found</div>;

  const product = data.product;
  const isOutOfStock = product.inventory === 0;

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
      setQuantity(1);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-8">
          <div className="mb-6">
            <span className="inline-block bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded mb-4">
              {product.category}
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
            <p className="text-gray-600 text-lg leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <span className="text-4xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
              <span className={`text-lg ${product.inventory > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}
              </span>
            </div>
          </div>

          {!isOutOfStock && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label htmlFor="quantity" className="text-lg font-medium text-gray-700">
                  Quantity:
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={product.inventory}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded text-center text-lg"
                />
              </div>

              <button
                onClick={handleAddToCart}
                disabled={addToCartLoading || quantity > product.inventory}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                {addToCartLoading ? 'Adding to Cart...' : 'Add to Cart'}
              </button>
            </div>
          )}

          {isOutOfStock && (
            <button
              disabled
              className="w-full bg-gray-400 text-white py-3 px-6 rounded-lg cursor-not-allowed text-lg font-medium"
            >
              Out of Stock
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        <a
          href="/products"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          ← Back to Products
        </a>
      </div>
    </div>
  );
}