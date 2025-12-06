import { CascadeResponse, CascadeUpdates, UpdatedEntity, DeletedEntity, QueryInvalidation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';

// Types for our e-commerce domain
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: string;
  createdAt: string;
}

// Optimistic response generator for addToCart mutation
export function generateAddToCartOptimisticResponse(
  productId: string,
  quantity: number,
  product: Product
): CascadeResponse<CartItem> {
  const cartItemId = `temp-${Date.now()}`; // Temporary ID for optimistic update

  const optimisticCartItem: CartItem = {
    id: cartItemId,
    productId,
    quantity,
    product: {
      ...product,
      inventory: product.inventory - quantity, // Optimistically reduce inventory
    },
  };

  const cascade: CascadeUpdates = {
    updated: [
      {
        __typename: 'CartItem',
        id: cartItemId,
        operation: 'CREATED',
        entity: optimisticCartItem,
      },
      {
        __typename: 'Product',
        id: productId,
        operation: 'UPDATED',
        entity: {
          ...product,
          inventory: product.inventory - quantity,
        },
      },
    ],
    deleted: [],
    invalidations: [
      {
        queryName: 'cart',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      },
      {
        queryName: 'products',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      },
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      transactionId: `opt-${Date.now()}`,
      depth: 1,
      affectedCount: 2,
    },
  };

  return {
    success: true,
    data: optimisticCartItem,
    cascade,
  };
}

// Optimistic response generator for updateCartItem mutation
export function generateUpdateCartItemOptimisticResponse(
  cartItemId: string,
  quantity: number,
  existingCartItem: CartItem
): CascadeResponse<CartItem> {
  const inventoryChange = quantity - existingCartItem.quantity;

  const optimisticCartItem: CartItem = {
    ...existingCartItem,
    quantity,
    product: {
      ...existingCartItem.product,
      inventory: existingCartItem.product.inventory - inventoryChange,
    },
  };

  const cascade: CascadeUpdates = {
    updated: [
      {
        __typename: 'CartItem',
        id: cartItemId,
        operation: 'UPDATED',
        entity: optimisticCartItem,
      },
      {
        __typename: 'Product',
        id: existingCartItem.productId,
        operation: 'UPDATED',
        entity: {
          ...existingCartItem.product,
          inventory: existingCartItem.product.inventory - inventoryChange,
        },
      },
    ],
    deleted: [],
    invalidations: [
      {
        queryName: 'cart',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      },
      {
        queryName: 'products',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      },
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      transactionId: `opt-${Date.now()}`,
      depth: 1,
      affectedCount: 2,
    },
  };

  return {
    success: true,
    data: optimisticCartItem,
    cascade,
  };
}

// Optimistic response generator for removeFromCart mutation
export function generateRemoveFromCartOptimisticResponse(
  cartItemId: string,
  cartItem: CartItem
): CascadeResponse<CartItem> {
  const cascade: CascadeUpdates = {
    updated: [
      {
        __typename: 'Product',
        id: cartItem.productId,
        operation: 'UPDATED',
        entity: {
          ...cartItem.product,
          inventory: cartItem.product.inventory + cartItem.quantity, // Restore inventory
        },
      },
    ],
    deleted: [
      {
        __typename: 'CartItem',
        id: cartItemId,
        deletedAt: new Date().toISOString(),
      },
    ],
    invalidations: [
      {
        queryName: 'cart',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      },
      {
        queryName: 'products',
        strategy: InvalidationStrategy.REFETCH,
        scope: InvalidationScope.EXACT,
      },
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      transactionId: `opt-${Date.now()}`,
      depth: 1,
      affectedCount: 2,
    },
  };

  return {
    success: true,
    data: cartItem,
    cascade,
  };
}

// Optimistic response generator for checkout mutation
export function generateCheckoutOptimisticResponse(
  cartItems: CartItem[]
): CascadeResponse<Order> {
  const orderId = `temp-order-${Date.now()}`;
  const total = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const optimisticOrder: Order = {
    id: orderId,
    items: cartItems,
    total,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  // Create invalidations for all affected products and cart items
  const invalidations: QueryInvalidation[] = [
    {
      queryName: 'cart',
      strategy: InvalidationStrategy.REFETCH,
      scope: InvalidationScope.EXACT,
    },
    {
      queryName: 'orders',
      strategy: InvalidationStrategy.REFETCH,
      scope: InvalidationScope.EXACT,
    },
    {
      queryName: 'products',
      strategy: InvalidationStrategy.REFETCH,
      scope: InvalidationScope.EXACT,
    },
  ];

  // Create updated entities for products (inventory reduction)
  const updatedEntities: UpdatedEntity[] = cartItems.map(item => ({
    __typename: 'Product',
    id: item.productId,
    operation: 'UPDATED',
    entity: {
      ...item.product,
      inventory: item.product.inventory - item.quantity,
    },
  }));

  // Create deleted entities for cart items
  const deletedEntities: DeletedEntity[] = cartItems.map(item => ({
    __typename: 'CartItem',
    id: item.id,
    deletedAt: new Date().toISOString(),
  }));

  const cascade: CascadeUpdates = {
    updated: [
      ...updatedEntities,
      {
        __typename: 'Order',
        id: orderId,
        operation: 'CREATED',
        entity: optimisticOrder,
      },
    ],
    deleted: deletedEntities,
    invalidations,
    metadata: {
      timestamp: new Date().toISOString(),
      transactionId: `opt-${Date.now()}`,
      depth: 1,
      affectedCount: cartItems.length * 2 + 1, // products + cart items + order
    },
  };

  return {
    success: true,
    data: optimisticOrder,
    cascade,
  };
}