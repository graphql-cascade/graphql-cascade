import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Product {
    id: ID!
    name: String!
    description: String!
    price: Float!
    inventory: Int!
    category: String!
  }

  type CartItem {
    id: ID!
    productId: ID!
    quantity: Int!
    product: Product!
  }

  type Order {
    id: ID!
    items: [CartItem!]!
    total: Float!
    status: String!
    createdAt: String!
  }

  type Query {
    products: [Product!]!
    product(id: ID!): Product
    cart: [CartItem!]!
    orders: [Order!]!
    order(id: ID!): Order
  }

  type AddToCartCascade {
    success: Boolean!
    data: CartItem
    cascade: CascadeData
  }

  type UpdateCartItemCascade {
    success: Boolean!
    data: CartItem
    cascade: CascadeData
  }

  type RemoveFromCartCascade {
    success: Boolean!
    data: CartItem
    cascade: CascadeData
  }

  type CheckoutCascade {
    success: Boolean!
    data: Order
    cascade: CascadeData
  }

  type Mutation {
    addToCart(productId: ID!, quantity: Int!): AddToCartCascade!
    updateCartItem(id: ID!, quantity: Int!): UpdateCartItemCascade!
    removeFromCart(id: ID!): RemoveFromCartCascade!
    checkout: CheckoutCascade!
  }
`;