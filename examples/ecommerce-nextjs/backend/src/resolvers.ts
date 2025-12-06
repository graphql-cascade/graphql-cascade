import { buildSuccessResponse, buildErrorResponse } from '@graphql-cascade/server';
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

export const resolvers = {
  Query: {
    products: (): Product[] => getProducts(),
    product: (_: any, { id }: { id: string }): Product | undefined => getProduct(id),
    cart: (): CartItem[] => getCartItems(),
    orders: (): Order[] => getOrders(),
    order: (_: any, { id }: { id: string }): Order | undefined => getOrder(id),
  },
  Mutation: {
    addToCart: (_: any, { productId, quantity }: { productId: string; quantity: number }, context: any) => {
      const cartItem = addToCart(productId, quantity);
      if (!cartItem) {
        return buildErrorResponse(context.cascadeTracker, [{ message: 'Product not found or insufficient inventory', code: 'INSUFFICIENT_INVENTORY' }]);
      }
      context.cascadeTracker.trackCreate(cartItem);
      // Also track the product update for inventory
      const product = getProduct(productId);
      if (product) {
        context.cascadeTracker.trackUpdate(product);
      }
      return buildSuccessResponse(context.cascadeTracker, undefined, cartItem);
    },
    updateCartItem: (_: any, { id, quantity }: { id: string; quantity: number }, context: any) => {
      const cartItem = updateCartItem(id, quantity);
      if (!cartItem) {
        return buildErrorResponse(context.cascadeTracker, [{ message: 'Cart item not found or insufficient inventory', code: 'INSUFFICIENT_INVENTORY' }]);
      }
      context.cascadeTracker.trackUpdate(cartItem);
      // Also track the product update for inventory
      const product = getProduct(cartItem.productId);
      if (product) {
        context.cascadeTracker.trackUpdate(product);
      }
      return buildSuccessResponse(context.cascadeTracker, undefined, cartItem);
    },
    removeFromCart: (_: any, { id }: { id: string }, context: any) => {
      const cartItem = getCartItem(id);
      if (!cartItem) {
        return buildErrorResponse(context.cascadeTracker, [{ message: 'Cart item not found', code: 'NOT_FOUND' }]);
      }
      const success = removeFromCart(id);
      context.cascadeTracker.trackDelete('CartItem', id);
      // Also track the product update for inventory
      const product = getProduct(cartItem.productId);
      if (product) {
        context.cascadeTracker.trackUpdate(product);
      }
      return buildSuccessResponse(context.cascadeTracker, undefined, cartItem);
    },
    checkout: (_: any, __: any, context: any) => {
      const cartItems = getCartItems();
      if (cartItems.length === 0) {
        return buildErrorResponse(context.cascadeTracker, [{ message: 'Cart is empty', code: 'EMPTY_CART' }]);
      }

      // Check inventory for all items
      for (const item of cartItems) {
        if (item.product.inventory < item.quantity) {
          return buildErrorResponse(context.cascadeTracker, [{ message: `Insufficient inventory for ${item.product.name}`, code: 'INSUFFICIENT_INVENTORY' }]);
        }
      }

      const order = createOrder(cartItems);
      clearCart();

      context.cascadeTracker.trackCreate(order);
      // Track all cart items as deleted
      cartItems.forEach(item => {
        context.cascadeTracker.trackDelete('CartItem', item.id);
      });
      // Track all products as updated (inventory changes)
      cartItems.forEach(item => {
        const product = getProduct(item.productId);
        if (product) {
          context.cascadeTracker.trackUpdate(product);
        }
      });

      return buildSuccessResponse(context.cascadeTracker, undefined, order);
    },
  },
};