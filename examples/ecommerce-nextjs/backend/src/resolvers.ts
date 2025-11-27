import { CascadeBuilder } from '@graphql-cascade/server';
import {
  getProducts,
  getProduct,
  getCartItems,
  getCartItem,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getOrders,
  getOrder,
  createOrder,
  type Product,
  type CartItem,
  type Order,
} from './db';

const cascadeBuilder = new CascadeBuilder();

export const resolvers = {
  Query: {
    products: (): Product[] => getProducts(),
    product: (_: any, { id }: { id: string }): Product | undefined => getProduct(id),
    cart: (): CartItem[] => getCartItems(),
    orders: (): Order[] => getOrders(),
    order: (_: any, { id }: { id: string }): Order | undefined => getOrder(id),
  },
  Mutation: {
    addToCart: (_: any, { productId, quantity }: { productId: string; quantity: number }) => {
      const cartItem = addToCart(productId, quantity);
      if (!cartItem) {
        return cascadeBuilder.buildErrorResponse('Product not found or insufficient inventory');
      }
      return cascadeBuilder.buildSuccessResponse(cartItem, {
        operation: 'CREATE',
        entityType: 'CartItem',
        entityId: cartItem.id,
        // Cascade update for product inventory
        cascade: {
          invalidate: [
            {
              entityType: 'Product',
              entityId: productId,
            },
          ],
        },
      });
    },
    updateCartItem: (_: any, { id, quantity }: { id: string; quantity: number }) => {
      const cartItem = updateCartItem(id, quantity);
      if (!cartItem) {
        return cascadeBuilder.buildErrorResponse('Cart item not found or insufficient inventory');
      }
      return cascadeBuilder.buildSuccessResponse(cartItem, {
        operation: 'UPDATE',
        entityType: 'CartItem',
        entityId: id,
        // Cascade update for product inventory
        cascade: {
          invalidate: [
            {
              entityType: 'Product',
              entityId: cartItem.productId,
            },
          ],
        },
      });
    },
    removeFromCart: (_: any, { id }: { id: string }) => {
      const cartItem = getCartItem(id);
      if (!cartItem) {
        return cascadeBuilder.buildErrorResponse('Cart item not found');
      }
      const success = removeFromCart(id);
      return cascadeBuilder.buildSuccessResponse(cartItem, {
        operation: 'DELETE',
        entityType: 'CartItem',
        entityId: id,
        // Cascade update for product inventory
        cascade: {
          invalidate: [
            {
              entityType: 'Product',
              entityId: cartItem.productId,
            },
          ],
        },
      });
    },
    checkout: () => {
      const cartItems = getCartItems();
      if (cartItems.length === 0) {
        return cascadeBuilder.buildErrorResponse('Cart is empty');
      }

      // Check inventory for all items
      for (const item of cartItems) {
        if (item.product.inventory < item.quantity) {
          return cascadeBuilder.buildErrorResponse(
            `Insufficient inventory for ${item.product.name}`
          );
        }
      }

      const order = createOrder(cartItems);
      clearCart();

      return cascadeBuilder.buildSuccessResponse(order, {
        operation: 'CREATE',
        entityType: 'Order',
        entityId: order.id,
        // Cascade updates for all affected products and clear cart
        cascade: {
          invalidate: [
            ...cartItems.map(item => ({
              entityType: 'Product' as const,
              entityId: item.productId,
            })),
            { entityType: 'CartItem', entityId: '*' }, // Clear all cart items
          ],
        },
      });
    },
  },
};