# GraphQL Cascade - Strawberry Integration Example

import strawberry
from typing import List, Optional
import datetime

# Import GraphQL Cascade components
from graphql_cascade.strawberry import CascadeExtension
from graphql_cascade import CascadeTracker

# Define GraphQL types with Strawberry

@strawberry.interface
class Node:
    id: strawberry.ID

@strawberry.interface
class Timestamped:
    created_at: datetime.datetime
    updated_at: datetime.datetime
    version: Optional[int]

@strawberry.interface
class CascadeResponse:
    success: bool
    errors: List['CascadeError']
    data: Optional['MutationPayload']
    cascade: 'CascadeUpdates'

@strawberry.type
class CascadeUpdates:
    updated: List['UpdatedEntity']
    deleted: List['DeletedEntity']
    invalidations: List['QueryInvalidation']
    metadata: 'CascadeMetadata'

@strawberry.type
class CascadeMetadata:
    timestamp: str
    depth: int
    affected_count: int

@strawberry.type
class UpdatedEntity:
    __typename: str
    id: strawberry.ID
    operation: 'CascadeOperation'
    entity: Node

@strawberry.type
class DeletedEntity:
    __typename: str
    id: strawberry.ID
    deleted_at: str

@strawberry.enum
class CascadeOperation:
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"

@strawberry.type
class QueryInvalidation:
    query_name: Optional[str]
    strategy: 'InvalidationStrategy'
    scope: 'InvalidationScope'

@strawberry.enum
class InvalidationStrategy:
    INVALIDATE = "INVALIDATE"
    REFETCH = "REFETCH"
    REMOVE = "REMOVE"

@strawberry.enum
class InvalidationScope:
    EXACT = "EXACT"
    PREFIX = "PREFIX"
    PATTERN = "PATTERN"
    ALL = "ALL"

@strawberry.type
class CascadeError:
    message: str
    code: 'CascadeErrorCode'
    field: Optional[str]

@strawberry.enum
class CascadeErrorCode:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"

# Domain types
@strawberry.type
class User(Node, Timestamped):
    id: strawberry.ID
    email: str
    name: str
    role: 'UserRole'
    created_at: datetime.datetime
    updated_at: datetime.datetime
    version: Optional[int] = None

@strawberry.type
class Company(Node, Timestamped):
    id: strawberry.ID
    name: str
    address: Optional['Address']
    employees: List[User]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    version: Optional[int] = None

@strawberry.type
class Address(Node):
    id: strawberry.ID
    street: str
    city: str
    country: str

@strawberry.enum
class UserRole:
    ADMIN = "ADMIN"
    USER = "USER"
    GUEST = "GUEST"

# Input types
@strawberry.input
class CreateUserInput:
    email: str
    name: str
    role: UserRole = UserRole.USER

@strawberry.input
class UpdateUserInput:
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[UserRole] = None

@strawberry.input
class CreateCompanyInput:
    name: str
    address: Optional['AddressInput'] = None

@strawberry.input
class AddressInput:
    street: str
    city: str
    country: str

# Response types
@strawberry.type
class CreateUserCascade(CascadeResponse):
    success: bool
    errors: List[CascadeError]
    data: Optional[User]
    cascade: CascadeUpdates

@strawberry.type
class UpdateUserCascade(CascadeResponse):
    success: bool
    errors: List[CascadeError]
    data: Optional[User]
    cascade: CascadeUpdates

@strawberry.type
class CreateCompanyCascade(CascadeResponse):
    success: bool
    errors: List[CascadeError]
    data: Optional[Company]
    cascade: CascadeUpdates

# Pagination types
@strawberry.type
class UserConnection:
    edges: List['UserEdge']
    page_info: 'PageInfo'
    total_count: int

@strawberry.type
class UserEdge:
    node: User
    cursor: str

@strawberry.type
class CompanyConnection:
    edges: List['CompanyEdge']
    page_info: 'PageInfo'
    total_count: int

@strawberry.type
class CompanyEdge:
    node: Company
    cursor: str

@strawberry.type
class PageInfo:
    has_next_page: bool
    has_previous_page: bool
    start_cursor: Optional[str]
    end_cursor: Optional[str]

# Filter types
@strawberry.input
class UserFilter:
    role: Optional[UserRole] = None
    email_contains: Optional[str] = None

@strawberry.input
class CompanyFilter:
    name_contains: Optional[str] = None
    city: Optional[str] = None

# Placeholder for mutation payload
MutationPayload = strawberry.scalar(
    strawberry.Union[User, Company],
    name="MutationPayload"
)

# Mock data store (replace with real database)
users_db = []
companies_db = []
addresses_db = []
next_id = 1

# Configure cascade tracker
cascade_tracker = CascadeTracker(
    max_depth=3,
    exclude_types=[]
)

# Queries
@strawberry.type
class Query:
    @strawberry.field
    def get_user(self, id: strawberry.ID) -> Optional[User]:
        return next((u for u in users_db if u.id == id), None)

    @strawberry.field
    def list_users(
        self,
        first: int = 10,
        after: Optional[str] = None,
        filter: Optional[UserFilter] = None
    ) -> UserConnection:
        filtered = users_db

        if filter:
            if filter.role:
                filtered = [u for u in filtered if u.role == filter.role]
            if filter.email_contains:
                filtered = [u for u in filtered if filter.email_contains in u.email]

        # Simple pagination
        start = 0
        if after:
            start = next((i for i, u in enumerate(filtered) if u.id == after), 0) + 1

        nodes = filtered[start:start + first]

        return UserConnection(
            edges=[
                UserEdge(node=user, cursor=user.id)
                for user in nodes
            ],
            page_info=PageInfo(
                has_next_page=len(filtered) > start + first,
                has_previous_page=start > 0,
                start_cursor=nodes[0].id if nodes else None,
                end_cursor=nodes[-1].id if nodes else None
            ),
            total_count=len(filtered)
        )

    @strawberry.field
    def get_company(self, id: strawberry.ID) -> Optional[Company]:
        return next((c for c in companies_db if c.id == id), None)

    @strawberry.field
    def list_companies(
        self,
        first: int = 10,
        after: Optional[str] = None,
        filter: Optional[CompanyFilter] = None
    ) -> CompanyConnection:
        filtered = companies_db

        if filter:
            if filter.name_contains:
                filtered = [c for c in filtered if filter.name_contains in c.name]
            if filter.city and c.address:
                filtered = [c for c in filtered if c.address.city == filter.city]

        # Simple pagination
        start = 0
        if after:
            start = next((i for i, c in enumerate(filtered) if c.id == after), 0) + 1

        nodes = filtered[start:start + first]

        return CompanyConnection(
            edges=[
                CompanyEdge(node=company, cursor=company.id)
                for company in nodes
            ],
            page_info=PageInfo(
                has_next_page=len(filtered) > start + first,
                has_previous_page=start > 0,
                start_cursor=nodes[0].id if nodes else None,
                end_cursor=nodes[-1].id if nodes else None
            ),
            total_count=len(filtered)
        )

    @strawberry.field
    def search_companies(
        self,
        query: str,
        first: int = 10
    ) -> CompanyConnection:
        filtered = [
            c for c in companies_db
            if query.lower() in c.name.lower()
        ]

        nodes = filtered[:first]

        return CompanyConnection(
            edges=[
                CompanyEdge(node=company, cursor=company.id)
                for company in nodes
            ],
            page_info=PageInfo(
                has_next_page=len(filtered) > first,
                has_previous_page=False,
                start_cursor=nodes[0].id if nodes else None,
                end_cursor=nodes[-1].id if nodes else None
            ),
            total_count=len(filtered)
        )

# Mutations
@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_user(self, input: CreateUserInput) -> CreateUserCascade:
        """Create a new user with cascade tracking."""
        global next_id

        # Create user
        user = User(
            id=strawberry.ID(str(next_id)),
            email=input.email,
            name=input.name,
            role=input.role,
            created_at=datetime.datetime.now(),
            updated_at=datetime.datetime.now()
        )
        next_id += 1

        users_db.append(user)

        # GraphQL Cascade automatically tracks this creation
        # The CascadeExtension handles the cascade response construction

        return CreateUserCascade(
            success=True,
            errors=[],
            data=user,
            cascade=CascadeUpdates(
                updated=[],  # Will be filled by CascadeExtension
                deleted=[],
                invalidations=[],
                metadata=CascadeMetadata(
                    timestamp=datetime.datetime.now().isoformat(),
                    depth=1,
                    affected_count=1
                )
            )
        )

    @strawberry.mutation
    def update_user(self, id: strawberry.ID, input: UpdateUserInput) -> UpdateUserCascade:
        """Update a user with cascade tracking."""
        user = next((u for u in users_db if u.id == id), None)

        if not user:
            return UpdateUserCascade(
                success=False,
                errors=[CascadeError(
                    message="User not found",
                    code=CascadeErrorCode.NOT_FOUND
                )],
                data=None,
                cascade=CascadeUpdates(
                    updated=[],
                    deleted=[],
                    invalidations=[],
                    metadata=CascadeMetadata(
                        timestamp=datetime.datetime.now().isoformat(),
                        depth=0,
                        affected_count=0
                    )
                )
            )

        # Update user
        if input.email is not None:
            user.email = input.email
        if input.name is not None:
            user.name = input.name
        if input.role is not None:
            user.role = input.role
        user.updated_at = datetime.datetime.now()

        # GraphQL Cascade automatically tracks this update

        return UpdateUserCascade(
            success=True,
            errors=[],
            data=user,
            cascade=CascadeUpdates(
                updated=[],  # Will be filled by CascadeExtension
                deleted=[],
                invalidations=[],
                metadata=CascadeMetadata(
                    timestamp=datetime.datetime.now().isoformat(),
                    depth=1,
                    affected_count=1
                )
            )
        )

    @strawberry.mutation
    def create_company(self, input: CreateCompanyInput) -> CreateCompanyCascade:
        """Create a company with optional address."""
        global next_id

        # Create address if provided
        address = None
        if input.address:
            address = Address(
                id=strawberry.ID(str(next_id)),
                street=input.address.street,
                city=input.address.city,
                country=input.address.country
            )
            addresses_db.append(address)
            next_id += 1

        # Create company
        company = Company(
            id=strawberry.ID(str(next_id)),
            name=input.name,
            address=address,
            employees=[],  # Will be populated by relationships
            created_at=datetime.datetime.now(),
            updated_at=datetime.datetime.now()
        )
        next_id += 1

        companies_db.append(company)

        # GraphQL Cascade tracks both company and address creation

        return CreateCompanyCascade(
            success=True,
            errors=[],
            data=company,
            cascade=CascadeUpdates(
                updated=[],  # Will be filled by CascadeExtension
                deleted=[],
                invalidations=[],
                metadata=CascadeMetadata(
                    timestamp=datetime.datetime.now().isoformat(),
                    depth=2,  # Company + Address
                    affected_count=2 if address else 1
                )
            )
        )

# Create schema with cascade extension
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[CascadeExtension(tracker=cascade_tracker)]
)

# Example usage:
#
# from strawberry.fastapi import GraphQLRouter
#
# graphql_app = GraphQLRouter(schema)
#
# # Add to FastAPI app
# app = FastAPI()
# app.include_router(graphql_app, prefix="/graphql")
#
# Example queries:
#
# 1. Create user:
# mutation {
#   createUser(input: { email: "john@example.com", name: "John Doe" }) {
#     success
#     data { id name email }
#     cascade {
#       updated { __typename id operation }
#       invalidations { queryName strategy scope }
#       metadata { affectedCount depth }
#     }
#   }
# }
#
# 2. Update user:
# mutation {
#   updateUser(id: "1", input: { name: "John Smith" }) {
#     success
#     data { id name }
#     cascade {
#       updated { __typename id operation }
#       invalidations { queryName strategy scope }
#     }
#   }
# }
#
# 3. Create company with address:
# mutation {
#   createCompany(input: {
#     name: "ACME Corp"
#     address: { street: "123 Main St", city: "Anytown", country: "USA" }
#   }) {
#     success
#     data { id name address { street city } }
#     cascade {
#       updated { __typename id operation }
#       metadata { affectedCount }
#     }
#   }
# }