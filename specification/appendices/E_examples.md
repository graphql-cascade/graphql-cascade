# Appendix E: Examples

This appendix provides comprehensive examples of GraphQL Cascade usage across different scenarios and frameworks.

## Simple CRUD Operations

### User Management

**Schema:**
```graphql
type User implements Node & Timestamped {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}

enum UserRole {
  ADMIN
  USER
  GUEST
}

input CreateUserInput {
  email: String!
  name: String!
  role: UserRole
}

input UpdateUserInput {
  name: String
  role: UserRole
}

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

type DeleteUserCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: User
  cascade: CascadeUpdates!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserCascade!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserCascade!
  deleteUser(id: ID!): DeleteUserCascade!
}
```

**Server Implementation (Python/FraiseQL):**
```python
class UserMutations:
    @cascade_tracker.track
    def create_user(self, input: CreateUserInput) -> User:
        user = User(
            email=input.email,
            name=input.name,
            role=input.role or UserRole.USER
        )
        self.db.save(user)
        return user

    @cascade_tracker.track
    def update_user(self, id: str, input: UpdateUserInput) -> User:
        user = self.db.get(User, id)
        if not user:
            raise NotFoundError(f"User {id} not found")

        # Update fields
        for field, value in input.dict(exclude_unset=True).items():
            setattr(user, field, value)

        user.version = (user.version or 0) + 1
        self.db.save(user)
        return user

    @cascade_tracker.track
    def delete_user(self, id: str) -> User:
        user = self.db.get(User, id)
        if not user:
            raise NotFoundError(f"User {id} not found")

        self.db.delete(user)
        return user
```

**Client Usage (Apollo):**
```typescript
import { useCascadeMutation } from '@graphql-cascade/apollo';
import gql from 'graphql-tag';

const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      errors { message code field }
      data {
        id
        email
        name
        role
        createdAt
        updatedAt
      }
      cascade {
        updated { __typename id operation entity }
        deleted { __typename id }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      errors { message code field }
      data {
        id
        email
        name
        role
        updatedAt
        version
      }
      cascade {
        updated { __typename id operation entity }
        deleted { __typename id }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

function UserManagement() {
  const [createUser] = useCascadeMutation(CREATE_USER);
  const [updateUser] = useCascadeMutation(UPDATE_USER);

  const handleCreate = async () => {
    const result = await createUser({
      variables: {
        input: {
          email: 'john@example.com',
          name: 'John Doe',
          role: 'USER'
        }
      }
    });

    if (result.data.success) {
      console.log('User created:', result.data.data);
      // Cache automatically updated with new user
    }
  };

  const handleUpdate = async (userId: string) => {
    const result = await updateUser({
      variables: {
        id: userId,
        input: { name: 'Jane Doe' }
      }
    });

    if (result.data.success) {
      console.log('User updated:', result.data.data);
      // Cache automatically updated with user changes
      // Related queries automatically invalidated
    }
  };

  return (
    <div>
      <button onClick={handleCreate}>Create User</button>
      <button onClick={() => handleUpdate('user-123')}>Update User</button>
    </div>
  );
}
```

## Complex Relationships

### Company with Employees

**Schema:**
```graphql
type Company implements Node & Timestamped {
  id: ID!
  name: String!
  address: Address!
  owner: User!
  employees: [User!]!
  employeeCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}

type Address implements Node {
  id: ID!
  street: String!
  city: String!
  country: String!
  postalCode: String!
}

input UpdateCompanyInput {
  name: String
  addressId: ID
  ownerId: ID
}

type UpdateCompanyCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Company
  cascade: CascadeUpdates!
}

type Mutation {
  updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!
}
```

**Server Implementation:**
```python
class CompanyMutations:
    @cascade_tracker.track
    def update_company(self, id: str, input: UpdateCompanyInput) -> Company:
        company = self.db.get(Company, id)
        if not company:
            raise NotFoundError(f"Company {id} not found")

        # Update basic fields
        if input.name:
            company.name = input.name

        # Update address relationship
        if input.address_id:
            new_address = self.db.get(Address, input.address_id)
            if not new_address:
                raise NotFoundError(f"Address {input.address_id} not found")
            company.address = new_address

        # Update owner relationship
        if input.owner_id:
            new_owner = self.db.get(User, input.owner_id)
            if not new_owner:
                raise NotFoundError(f"User {input.owner_id} not found")
            company.owner = new_owner

        # Recalculate employee count
        company.employee_count = len(company.employees)

        company.version = (company.version or 0) + 1
        self.db.save(company)

        # Cascade will automatically include updated Company, Address, and User
        return company
```

**Client Usage:**
```typescript
const UPDATE_COMPANY = gql`
  mutation UpdateCompany($id: ID!, $input: UpdateCompanyInput!) {
    updateCompany(id: $id, input: $input) {
      success
      errors { message code field }
      data {
        id
        name
        address {
          id
          street
          city
          country
        }
        owner {
          id
          name
          email
        }
        employeeCount
        updatedAt
        version
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity {
            ... on Company {
              id name address { id street city } owner { id name } employeeCount
            }
            ... on Address {
              id street city country
            }
            ... on User {
              id name email
            }
          }
        }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount depth }
      }
    }
  }
`;

function CompanyEditor({ companyId }: { companyId: string }) {
  const [updateCompany] = useCascadeMutation(UPDATE_COMPANY);

  const handleUpdate = async (updates: UpdateCompanyInput) => {
    const result = await updateCompany({
      variables: { id: companyId, input: updates }
    });

    if (result.data.success) {
      // All related entities automatically updated in cache:
      // - Company with new name/address/owner
      // - Previous/new Address entities
      // - Previous/new User entities
      // - All related queries invalidated
      console.log('Cascade affected', result.data.cascade.metadata.affectedCount, 'entities');
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      handleUpdate({
        name: formData.get('name'),
        addressId: formData.get('addressId'),
        ownerId: formData.get('ownerId')
      });
    }}>
      <input name="name" placeholder="Company name" />
      <input name="addressId" placeholder="Address ID" />
      <input name="ownerId" placeholder="Owner ID" />
      <button type="submit">Update Company</button>
    </form>
  );
}
```

## Many-to-Many Relationships

### Orders and Products

**Schema:**
```graphql
type Order implements Node & Timestamped {
  id: ID!
  customer: User!
  items: [OrderItem!]!
  total: Float!
  status: OrderStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}

type OrderItem {
  product: Product!
  quantity: Int!
  price: Float!
  total: Float!
}

type Product implements Node & Timestamped {
  id: ID!
  name: String!
  description: String
  price: Float!
  inventory: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

type Mutation {
  addProductToOrder(orderId: ID!, productId: ID!, quantity: Int!): AddProductToOrderCascade!
  updateOrderStatus(id: ID!, status: OrderStatus!): UpdateOrderStatusCascade!
}

type AddProductToOrderCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Order
  cascade: CascadeUpdates!
}
```

**Server Implementation:**
```python
class OrderMutations:
    @cascade_tracker.track
    def add_product_to_order(self, order_id: str, product_id: str, quantity: int) -> Order:
        order = self.db.get(Order, order_id)
        product = self.db.get(Product, product_id)

        if not order or not product:
            raise NotFoundError("Order or product not found")

        if product.inventory < quantity:
            raise ValidationError("Insufficient inventory")

        # Create order item
        order_item = OrderItem(
            product=product,
            quantity=quantity,
            price=product.price,
            total=quantity * product.price
        )

        # Add to order
        order.items.append(order_item)

        # Update order total
        order.total = sum(item.total for item in order.items)

        # Update product inventory
        product.inventory -= quantity

        # Save all changes
        self.db.save(order)
        self.db.save(product)

        # Cascade will include: Order, OrderItem, Product
        return order

    @cascade_tracker.track
    def update_order_status(self, id: str, status: OrderStatus) -> Order:
        order = self.db.get(Order, id)
        if not order:
            raise NotFoundError(f"Order {id} not found")

        old_status = order.status
        order.status = status

        # Business logic based on status change
        if status == OrderStatus.SHIPPED and old_status != OrderStatus.SHIPPED:
            # Update product inventory (return items if cancelled)
            pass
        elif status == OrderStatus.CANCELLED and old_status != OrderStatus.CANCELLED:
            # Return items to inventory
            for item in order.items:
                item.product.inventory += item.quantity
                self.db.save(item.product)

        self.db.save(order)
        return order
```

**Client Usage:**
```typescript
const ADD_PRODUCT_TO_ORDER = gql`
  mutation AddProductToOrder($orderId: ID!, $productId: ID!, $quantity: Int!) {
    addProductToOrder(orderId: $orderId, productId: $productId, quantity: $quantity) {
      success
      errors { message code field }
      data {
        id
        total
        status
        items {
          product { id name price }
          quantity
          price
          total
        }
        customer { id name }
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity {
            ... on Order {
              id total status items { quantity total }
            }
            ... on Product {
              id name inventory
            }
          }
        }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

function OrderEditor({ orderId }: { orderId: string }) {
  const [addProduct] = useCascadeMutation(ADD_PRODUCT_TO_ORDER);

  const handleAddProduct = async (productId: string, quantity: number) => {
    const result = await addProduct({
      variables: { orderId, productId, quantity }
    });

    if (result.data.success) {
      // Cache automatically updated with:
      // - Order with new item and updated total
      // - Product with reduced inventory
      // - All order/product queries invalidated
      console.log('Order total:', result.data.data.total);
    }
  };

  return (
    <div>
      <h3>Add Product to Order</h3>
      <ProductSelector onSelect={(productId, qty) => handleAddProduct(productId, qty)} />
    </div>
  );
}
```

## Optimistic Updates

### Real-time Chat Application

**Schema:**
```graphql
type Message implements Node & Timestamped {
  id: ID!
  channel: Channel!
  author: User!
  content: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}

type Channel implements Node & Timestamped {
  id: ID!
  name: String!
  members: [User!]!
  lastMessageAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int
}

input SendMessageInput {
  channelId: ID!
  content: String!
}

type SendMessageCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Message
  cascade: CascadeUpdates!
}

type Mutation {
  sendMessage(input: SendMessageInput!): SendMessageCascade!
}

type Subscription {
  messageSent(channelId: ID!): MessageSentEvent!
}

type MessageSentEvent {
  message: Message!
  cascade: CascadeUpdates!
}
```

**Client with Optimistic Updates:**
```typescript
const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      success
      errors { message code field }
      data {
        id
        content
        author { id name }
        channel { id name }
        createdAt
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity {
            ... on Message { id content createdAt }
            ... on Channel { id lastMessageAt }
          }
        }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

function ChatRoom({ channelId }: { channelId: string }) {
  const [sendMessage] = useOptimisticCascadeMutation(SEND_MESSAGE, {
    onOptimisticUpdate: (optimisticMessage) => {
      // Message appears immediately in UI
      addMessageToUI(optimisticMessage);
      scrollToBottom();
    },
    onSuccess: (realMessage) => {
      // Update with real message (may have server-generated ID)
      updateMessageInUI(realMessage);
    },
    onError: (error) => {
      // Remove optimistic message on failure
      removeOptimisticMessage();
      showErrorToast('Failed to send message');
    }
  });

  const handleSend = async (content: string) => {
    await sendMessage({
      variables: {
        input: {
          channelId,
          content
        }
      }
    });
  };

  return (
    <div className="chat-room">
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
```

## Conflict Resolution

### Collaborative Document Editing

**Schema:**
```graphql
type Document implements Node & Timestamped {
  id: ID!
  title: String!
  content: String!
  author: User!
  collaborators: [User!]!
  version: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input UpdateDocumentInput {
  title: String
  content: String
}

type UpdateDocumentCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: Document
  cascade: CascadeUpdates!
}

type Mutation {
  updateDocument(id: ID!, input: UpdateDocumentInput!): UpdateDocumentCascade!
}
```

**Client with Conflict Resolution:**
```typescript
function CollaborativeEditor({ documentId }: { documentId: string }) {
  const [updateDocument] = useOptimisticCascadeMutation(UPDATE_DOCUMENT, {
    detectionStrategy: 'VERSION_BASED',
    resolutionStrategy: 'MERGE',
    fieldResolvers: {
      'content': 'CLIENT_WINS',  // Keep local content changes
      'title': 'SERVER_WINS'     // Server title takes precedence
    },
    onConflictResolved: (resolved, conflicts) => {
      console.log('Resolved conflicts:', conflicts);
      // Update UI with merged content
      setDocument(resolved);
    },
    onManualResolution: async (conflicts) => {
      // Show conflict resolution dialog
      return await showConflictDialog(conflicts);
    }
  });

  const handleContentChange = useDebouncedCallback((newContent: string) => {
    updateDocument({
      variables: {
        id: documentId,
        input: { content: newContent }
      }
    });
  }, 1000);

  return (
    <div>
      <DocumentEditor
        content={document.content}
        onChange={handleContentChange}
      />
    </div>
  );
}
```

## Real-time Subscriptions

### Live Dashboard

**Schema:**
```graphql
type Subscription {
  cascadeUpdates(
    entityTypes: [String!]
    entityIds: [ID!]
  ): CascadeUpdateEvent!
}

type CascadeUpdateEvent {
  eventType: CascadeEventType!
  entity: UpdatedEntity
  deletedEntity: DeletedEntity
  timestamp: DateTime!
  transactionId: ID
}

enum CascadeEventType {
  ENTITY_CREATED
  ENTITY_UPDATED
  ENTITY_DELETED
}
```

**Client with Real-time Updates:**
```typescript
const CASCADE_SUBSCRIPTION = gql`
  subscription OnCascadeUpdates($entityTypes: [String!]) {
    cascadeUpdates(entityTypes: $entityTypes) {
      eventType
      entity {
        __typename
        id
        operation
        entity
      }
      deletedEntity {
        __typename
        id
      }
      timestamp
      transactionId
    }
  }
`;

function LiveDashboard() {
  const cascadeClient = useCascadeClient();

  useSubscription(CASCADE_SUBSCRIPTION, {
    variables: { entityTypes: ['Order', 'Product', 'User'] },
    onData: ({ data }) => {
      const event = data.cascadeUpdates;

      // Apply real-time cascade updates
      if (event.entity) {
        cascadeClient.applyCascade({
          success: true,
          data: event.entity.entity,
          cascade: {
            updated: [event.entity],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: event.timestamp,
              affectedCount: 1
            }
          }
        });
      }

      if (event.deletedEntity) {
        cascadeClient.applyCascade({
          success: true,
          data: null,
          cascade: {
            updated: [],
            deleted: [event.deletedEntity],
            invalidations: [],
            metadata: {
              timestamp: event.timestamp,
              affectedCount: 1
            }
          }
        });
      }
    }
  });

  // Dashboard automatically stays in sync with real-time changes
  return <DashboardComponents />;
}
```

## Custom Actions

### Password Reset

**Schema:**
```graphql
type PasswordResetResult {
  emailSent: Boolean!
  expiresAt: DateTime!
  resetToken: ID
}

type SendPasswordResetCascade implements CascadeResponse {
  success: Boolean!
  errors: [CascadeError!]
  data: PasswordResetResult
  cascade: CascadeUpdates!
}

type Mutation {
  sendPasswordReset(email: String!): SendPasswordResetCascade!
}
```

**Server Implementation:**
```python
class AuthMutations:
    @cascade_tracker.track
    def send_password_reset(self, email: str) -> PasswordResetResult:
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            # Don't reveal if email exists or not
            return PasswordResetResult(
                email_sent=True,
                expires_at=datetime.utcnow() + timedelta(hours=24)
            )

        # Create password reset token
        reset_token = PasswordResetToken(
            user=user,
            token=generate_secure_token(),
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        self.db.save(reset_token)

        # Send email (async)
        self.email_service.send_password_reset_email(user.email, reset_token.token)

        return PasswordResetResult(
            email_sent=True,
            expires_at=reset_token.expires_at,
            reset_token=reset_token.id
        )
```

**Client Usage:**
```typescript
const SEND_PASSWORD_RESET = gql`
  mutation SendPasswordReset($email: String!) {
    sendPasswordReset(email: $email) {
      success
      errors { message code field }
      data {
        emailSent
        expiresAt
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity {
            ... on PasswordResetToken {
              id
              expiresAt
            }
          }
        }
        invalidations { queryName strategy scope }
        metadata { timestamp affectedCount }
      }
    }
  }
`;

function PasswordResetForm() {
  const [sendReset] = useCascadeMutation(SEND_PASSWORD_RESET);

  const handleSubmit = async (email: string) => {
    const result = await sendReset({
      variables: { email }
    });

    if (result.data.success) {
      if (result.data.data.emailSent) {
        showSuccessMessage('Password reset email sent');
      }
    } else {
      showErrorMessage(result.data.errors[0].message);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const email = (e.target as HTMLFormElement).email.value;
      handleSubmit(email);
    }}>
      <input name="email" type="email" placeholder="Enter your email" />
      <button type="submit">Send Reset Email</button>
    </form>
  );
}
```

## Framework-Specific Examples

### React Query

```typescript
import { useCascadeMutation } from '@graphql-cascade/react-query';

function TaskManager() {
  const createTask = useCascadeMutation(CREATE_TASK);
  const updateTask = useCascadeMutation(UPDATE_TASK);
  const deleteTask = useCascadeMutation(DELETE_TASK);

  return (
    <div>
      <button onClick={() => createTask.mutate({ title: 'New Task' })}>
        Add Task
      </button>
      {/* Tasks automatically stay in sync */}
    </div>
  );
}
```

### Relay

```javascript
import { useCascadeMutation } from '@graphql-cascade/relay';

function UserProfile({ userId }) {
  const [updateUser] = useCascadeMutation(graphql`
    mutation UpdateUserMutation($id: ID!, $input: UpdateUserInput!) {
      updateUser(id: $id, input: $input) {
        success
        data { id name email }
        cascade { updated { __typename id entity } }
      }
    }
  `);

  return (
    <button onClick={() => updateUser({ id: userId, input: { name: 'New Name' } })}>
      Update Name
    </button>
  );
}
```

### URQL

```typescript
import { useCascadeMutation } from '@graphql-cascade/urql';

function ProductList() {
  const [updateProduct] = useCascadeMutation(UPDATE_PRODUCT);

  const handleUpdate = (productId, updates) => {
    updateProduct({
      id: productId,
      input: updates
    });
  };

  return <ProductGrid onUpdate={handleUpdate} />;
}
```

These examples demonstrate GraphQL Cascade's versatility across different GraphQL clients, mutation types, and application patterns. The core principle remains the same: automatic, server-driven cache updates that eliminate manual cache management code.</content>
</xai:function_call">The file has been written successfully.