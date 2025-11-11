// GraphQL Cascade - Apollo Server Integration Example

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { makeExecutableSchema } from '@graphql-tools/schema';
import gql from 'graphql-tag';

// Import GraphQL Cascade components
import { CascadePlugin } from '@graphql-cascade/apollo';
import { CascadeTracker } from '@graphql-cascade/core';

// GraphQL Schema with Cascade directives
const typeDefs = gql`
  # Cascade base types
  interface Node {
    id: ID!
  }

  interface CascadeResponse {
    success: Boolean!
    errors: [CascadeError!]
    data: MutationPayload
    cascade: CascadeUpdates!
  }

  type CascadeUpdates {
    updated: [UpdatedEntity!]!
    deleted: [DeletedEntity!]!
    invalidations: [QueryInvalidation!]!
    metadata: CascadeMetadata!
  }

  type CascadeMetadata {
    timestamp: DateTime!
    depth: Int!
    affectedCount: Int!
  }

  type UpdatedEntity {
    __typename: String!
    id: ID!
    operation: CascadeOperation!
    entity: Node!
  }

  type DeletedEntity {
    __typename: String!
    id: ID!
    deletedAt: DateTime!
  }

  enum CascadeOperation {
    CREATED
    UPDATED
    DELETED
  }

  type QueryInvalidation {
    queryName: String
    strategy: InvalidationStrategy!
    scope: InvalidationScope!
  }

  enum InvalidationStrategy {
    INVALIDATE
    REFETCH
    REMOVE
  }

  enum InvalidationScope {
    EXACT
    PREFIX
    PATTERN
    ALL
  }

  type CascadeError {
    message: String!
    code: CascadeErrorCode!
    field: String
  }

  enum CascadeErrorCode {
    VALIDATION_ERROR
    NOT_FOUND
    INTERNAL_ERROR
  }

  scalar DateTime
  scalar MutationPayload

  # Cascade directives
  directive @cascade(
    maxDepth: Int = 3
    includeRelated: Boolean = true
    autoInvalidate: Boolean = true
    excludeTypes: [String!]
  ) on FIELD_DEFINITION

  directive @cascadeInvalidates(
    queries: [String!]!
    strategy: InvalidationStrategy = INVALIDATE
  ) on FIELD_DEFINITION

  # Domain types
  type User implements Node {
    id: ID!
    email: String! @cascadeInvalidates(queries: ["listUsers"])
    name: String! @cascadeInvalidates(queries: ["listUsers"])
    role: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Company implements Node {
    id: ID!
    name: String! @cascadeInvalidates(queries: ["listCompanies", "searchCompanies"])
    address: Address
    employees: [User!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Address implements Node {
    id: ID!
    street: String!
    city: String!
    country: String!
  }

  enum UserRole {
    ADMIN
    USER
    GUEST
  }

  # Input types
  input CreateUserInput {
    email: String!
    name: String!
    role: UserRole = USER
  }

  input UpdateUserInput {
    email: String
    name: String
    role: UserRole
  }

  input CreateCompanyInput {
    name: String!
    address: AddressInput
  }

  input AddressInput {
    street: String!
    city: String!
    country: String!
  }

  # Response types
  type CreateUserCascade implements CascadeResponse {
    success: Boolean!
    errors: [CascadeError!]
    data: User
    cascade: CascadeUpdates!
  }

  type UpdateUserCascade implements CascadeResponse {
    success: Boolean!
    errors: [CascadeError!]
    data: User
    cascade: CascadeUpdates!
  }

  type CreateCompanyCascade implements CascadeResponse {
    success: Boolean!
    errors: [CascadeError!]
    data: Company
    cascade: CascadeUpdates!
  }

  # Queries
  type Query {
    getUser(id: ID!): User
    listUsers(
      first: Int = 10
      after: String
      filter: UserFilter
    ): UserConnection!

    getCompany(id: ID!): Company
    listCompanies(
      first: Int = 10
      after: String
      filter: CompanyFilter
    ): CompanyConnection!

    searchCompanies(query: String!, first: Int = 10): CompanyConnection!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type CompanyConnection {
    edges: [CompanyEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CompanyEdge {
    node: Company!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input UserFilter {
    role: UserRole
    emailContains: String
  }

  input CompanyFilter {
    nameContains: String
    city: String
  }

  # Mutations
  type Mutation {
    createUser(input: CreateUserInput!): CreateUserCascade!
      @cascade(maxDepth: 2)

    updateUser(id: ID!, input: UpdateUserInput!): UpdateUserCascade!
      @cascade(maxDepth: 1)

    createCompany(input: CreateCompanyInput!): CreateCompanyCascade!
      @cascade(maxDepth: 3, excludeTypes: ["AuditLog"])
  }
`;

// Mock data store (replace with real database)
let users: any[] = [];
let companies: any[] = [];
let addresses: any[] = [];
let nextId = 1;

// Resolvers
const resolvers = {
  Query: {
    getUser: (_: any, { id }: { id: string }) => {
      return users.find(u => u.id === id);
    },

    listUsers: (_: any, { first, after, filter }: any) => {
      let filtered = users;

      if (filter) {
        if (filter.role) {
          filtered = filtered.filter(u => u.role === filter.role);
        }
        if (filter.emailContains) {
          filtered = filtered.filter(u =>
            u.email.includes(filter.emailContains)
          );
        }
      }

      return {
        edges: filtered.slice(0, first).map((user: any) => ({
          node: user,
          cursor: user.id
        })),
        pageInfo: {
          hasNextPage: filtered.length > first,
          hasPreviousPage: false,
          startCursor: filtered[0]?.id,
          endCursor: filtered[filtered.length - 1]?.id
        },
        totalCount: filtered.length
      };
    },

    getCompany: (_: any, { id }: { id: string }) => {
      return companies.find(c => c.id === id);
    },

    listCompanies: (_: any, { first, after, filter }: any) => {
      let filtered = companies;

      if (filter) {
        if (filter.nameContains) {
          filtered = filtered.filter(c =>
            c.name.includes(filter.nameContains)
          );
        }
        if (filter.city && c.address) {
          filtered = filtered.filter(c =>
            c.address.city === filter.city
          );
        }
      }

      return {
        edges: filtered.slice(0, first).map((company: any) => ({
          node: company,
          cursor: company.id
        })),
        pageInfo: {
          hasNextPage: filtered.length > first,
          hasPreviousPage: false,
          startCursor: filtered[0]?.id,
          endCursor: filtered[filtered.length - 1]?.id
        },
        totalCount: filtered.length
      };
    },

    searchCompanies: (_: any, { query, first }: any) => {
      const filtered = companies.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );

      return {
        edges: filtered.slice(0, first).map((company: any) => ({
          node: company,
          cursor: company.id
        })),
        pageInfo: {
          hasNextPage: filtered.length > first,
          hasPreviousPage: false,
          startCursor: filtered[0]?.id,
          endCursor: filtered[filtered.length - 1]?.id
        },
        totalCount: filtered.length
      };
    }
  },

  Mutation: {
    createUser: (_: any, { input }: any) => {
      const user = {
        id: String(nextId++),
        ...input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      users.push(user);

      // GraphQL Cascade automatically tracks this creation
      // and includes it in the cascade response
      return {
        success: true,
        data: user,
        errors: []
      };
    },

    updateUser: (_: any, { id, input }: any) => {
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex === -1) {
        return {
          success: false,
          data: null,
          errors: [{
            message: 'User not found',
            code: 'NOT_FOUND'
          }]
        };
      }

      const user = { ...users[userIndex], ...input, updatedAt: new Date().toISOString() };
      users[userIndex] = user;

      // GraphQL Cascade automatically tracks this update
      return {
        success: true,
        data: user,
        errors: []
      };
    },

    createCompany: (_: any, { input }: any) => {
      let address = null;
      if (input.address) {
        address = {
          id: String(nextId++),
          ...input.address
        };
        addresses.push(address);
      }

      const company = {
        id: String(nextId++),
        ...input,
        address,
        employees: [], // Will be populated by relationships
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      companies.push(company);

      // GraphQL Cascade tracks company and address creation
      return {
        success: true,
        data: company,
        errors: []
      };
    }
  },

  // Resolvers for relationships
  Company: {
    employees: (company: any) => {
      return users.filter(u => u.companyId === company.id);
    }
  },

  User: {
    __typename: () => 'User'
  },

  Company: {
    __typename: () => 'Company'
  },

  Address: {
    __typename: () => 'Address'
  }
};

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Configure Cascade tracker
const cascadeTracker = new CascadeTracker({
  maxDepth: 3,
  excludeTypes: ['AuditLog']
});

// Create Apollo Server with Cascade plugin
const server = new ApolloServer({
  schema,
  plugins: [
    CascadePlugin({
      tracker: cascadeTracker,
      responseLimits: {
        maxEntities: 500,
        maxSizeMB: 5
      }
    })
  ]
});

// Start server
async function startServer() {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 }
  });

  console.log(`🚀 Server ready at ${url}`);
  console.log(`📊 GraphQL Cascade enabled with maxDepth: 3`);
}

startServer().catch(console.error);

// Example queries to test:
//
// 1. Create user with cascade:
// mutation {
//   createUser(input: { email: "john@example.com", name: "John Doe" }) {
//     success
//     data { id name email }
//     cascade {
//       updated { __typename id operation }
//       invalidations { queryName strategy scope }
//       metadata { affectedCount depth }
//     }
//   }
// }
//
// 2. Update user:
// mutation {
//   updateUser(id: "1", input: { name: "John Smith" }) {
//     success
//     data { id name }
//     cascade {
//       updated { __typename id operation }
//       invalidations { queryName strategy scope }
//     }
//   }
// }
//
// 3. Create company with address:
// mutation {
//   createCompany(input: {
//     name: "ACME Corp"
//     address: { street: "123 Main St", city: "Anytown", country: "USA" }
//   }) {
//     success
//     data { id name address { street city } }
//     cascade {
//       updated { __typename id operation }
//       metadata { affectedCount }
//     }
//   }
// }