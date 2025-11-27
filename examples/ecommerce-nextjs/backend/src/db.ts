export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}

let products: Product[] = [
  {
    id: '1',
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 199.99,
    inventory: 50,
    category: 'Electronics',
  },
  {
    id: '2',
    name: 'Smart Watch',
    description: 'Fitness tracking smart watch with heart rate monitor',
    price: 299.99,
    inventory: 30,
    category: 'Electronics',
  },
  {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with thermal carafe',
    price: 89.99,
    inventory: 25,
    category: 'Appliances',
  },
  {
    id: '4',
    name: 'Yoga Mat',
    description: 'Non-slip yoga mat with carrying strap',
    price: 29.99,
    inventory: 100,
    category: 'Sports & Fitness',
  },
];

let cartItems: CartItem[] = [];
let orders: Order[] = [];

let nextProductId = 5;
let nextCartItemId = 1;
let nextOrderId = 1;

// Product functions
export const getProducts = (): Product[] => products;

export const getProduct = (id: string): Product | undefined =>
  products.find(p => p.id === id);

export const updateProductInventory = (id: string, newInventory: number): Product | null => {
  const product = products.find(p => p.id === id);
  if (!product) return null;
  product.inventory = newInventory;
  return product;
};

// Cart functions
export const getCartItems = (): CartItem[] => {
  return cartItems.map(item => ({
    ...item,
    product: getProduct(item.productId)!,
  }));
};

export const getCartItem = (id: string): CartItem | undefined => {
  const item = cartItems.find(c => c.id === id);
  if (!item) return undefined;
  return {
    ...item,
    product: getProduct(item.productId)!,
  };
};

export const addToCart = (productId: string, quantity: number): CartItem | null => {
  const product = getProduct(productId);
  if (!product || product.inventory < quantity) return null;

  const existingItem = cartItems.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
    return { ...existingItem, product };
  }

  const cartItem: CartItem = {
    id: nextCartItemId.toString(),
    productId,
    quantity,
    product,
  };
  cartItems.push(cartItem);
  nextCartItemId++;
  return cartItem;
};

export const updateCartItem = (id: string, quantity: number): CartItem | null => {
  const item = cartItems.find(c => c.id === id);
  if (!item) return null;

  const product = getProduct(item.productId);
  if (!product || product.inventory < quantity) return null;

  item.quantity = quantity;
  return { ...item, product };
};

export const removeFromCart = (id: string): boolean => {
  const index = cartItems.findIndex(c => c.id === id);
  if (index === -1) return false;
  cartItems.splice(index, 1);
  return true;
};

export const clearCart = (): void => {
  cartItems = [];
};

// Order functions
export const getOrders = (): Order[] => orders;

export const getOrder = (id: string): Order | undefined =>
  orders.find(o => o.id === id);

export const createOrder = (cartItemsForOrder: CartItem[]): Order => {
  const total = cartItemsForOrder.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const order: Order = {
    id: nextOrderId.toString(),
    items: [...cartItemsForOrder],
    total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  nextOrderId++;

  // Update product inventory
  cartItemsForOrder.forEach(item => {
    const product = getProduct(item.productId);
    if (product) {
      updateProductInventory(item.productId, product.inventory - item.quantity);
    }
  });

  return order;
};