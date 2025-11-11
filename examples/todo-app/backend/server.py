#!/usr/bin/env python3
"""
GraphQL Cascade TODO App Backend

Simple GraphQL server demonstrating GraphQL Cascade with basic CRUD operations.
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
import asyncio
from dataclasses import dataclass, field

# GraphQL Cascade imports (would be installed)
try:
    from graphql_cascade import (
        CascadeTracker,
        CascadeBuilder,
        CascadeInvalidator,
        CascadeResponse,
        CascadeError,
        CascadeErrorCode
    )
except ImportError:
    # Mock implementations for demo
    class CascadeTracker:
        def __init__(self, **kwargs): pass
        def start_transaction(self): return "mock_tx"
        def end_transaction(self): return {"updated": [], "deleted": [], "invalidations": [], "metadata": {}}
        def track_create(self, entity): pass
        def track_update(self, entity): pass
        def track_delete(self, typename, id): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass

    class CascadeBuilder:
        def __init__(self, tracker, invalidator=None): pass
        def build_response(self, data, success=True, errors=None):
            return CascadeResponse(success=success, data=data, cascade={"updated": [], "deleted": [], "invalidations": [], "metadata": {}})

    class CascadeInvalidator:
        pass

    @dataclass
    class CascadeResponse:
        success: bool
        data: Any = None
        cascade: Dict = field(default_factory=dict)
        errors: List = field(default_factory=list)

    @dataclass
    class CascadeError:
        message: str
        code: str

    class CascadeErrorCode:
        NOT_FOUND = "NOT_FOUND"


# Domain Models
@dataclass
class User:
    id: str
    email: str
    name: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    version: int = 1

    @property
    def __typename__(self):
        return "User"

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "version": self.version,
        }


@dataclass
class Todo:
    id: str
    title: str
    description: Optional[str]
    completed: bool
    owner_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    version: int = 1

    @property
    def __typename__(self):
        return "Todo"

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "completed": self.completed,
            "ownerId": self.owner_id,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "version": self.version,
        }


# In-memory storage (for demo)
users_db: Dict[str, User] = {}
todos_db: Dict[str, Todo] = {}
next_user_id = 1
next_todo_id = 1


class TodoService:
    """Business logic for Todo operations."""

    @staticmethod
    def create_user(email: str, name: str) -> User:
        global next_user_id
        user = User(
            id=str(next_user_id),
            email=email,
            name=name
        )
        users_db[user.id] = user
        next_user_id += 1
        return user

    @staticmethod
    def update_user(user_id: str, email: Optional[str] = None, name: Optional[str] = None) -> User:
        if user_id not in users_db:
            raise ValueError(f"User {user_id} not found")

        user = users_db[user_id]
        if email is not None:
            user.email = email
        if name is not None:
            user.name = name
        user.updated_at = datetime.utcnow()
        user.version += 1
        return user

    @staticmethod
    def delete_user(user_id: str) -> User:
        if user_id not in users_db:
            raise ValueError(f"User {user_id} not found")

        user = users_db[user_id]

        # Delete all user's todos
        todos_to_delete = [tid for tid, todo in todos_db.items() if todo.owner_id == user_id]
        for tid in todos_to_delete:
            del todos_db[tid]

        del users_db[user_id]
        return user

    @staticmethod
    def create_todo(title: str, description: Optional[str], owner_id: str) -> Todo:
        global next_todo_id
        if owner_id not in users_db:
            raise ValueError(f"Owner {owner_id} not found")

        todo = Todo(
            id=str(next_todo_id),
            title=title,
            description=description,
            completed=False,
            owner_id=owner_id
        )
        todos_db[todo.id] = todo
        next_todo_id += 1
        return todo

    @staticmethod
    def update_todo(todo_id: str, title: Optional[str] = None, description: Optional[str] = None,
                   completed: Optional[bool] = None) -> Todo:
        if todo_id not in todos_db:
            raise ValueError(f"Todo {todo_id} not found")

        todo = todos_db[todo_id]
        if title is not None:
            todo.title = title
        if description is not None:
            todo.description = description
        if completed is not None:
            todo.completed = completed
        todo.updated_at = datetime.utcnow()
        todo.version += 1
        return todo

    @staticmethod
    def delete_todo(todo_id: str) -> Todo:
        if todo_id not in todos_db:
            raise ValueError(f"Todo {todo_id} not found")

        todo = todos_db[todo_id]
        del todos_db[todo_id]
        return todo


# GraphQL Resolvers
class MutationResolvers:
    """GraphQL mutation resolvers with Cascade support."""

    @staticmethod
    def create_user(input_data: Dict[str, Any]) -> CascadeResponse:
        """Create a new user with cascade tracking."""
        tracker = CascadeTracker(max_depth=2)
        invalidator = CascadeInvalidator()
        builder = CascadeBuilder(tracker, invalidator)

        with tracker:
            try:
                user = TodoService.create_user(
                    email=input_data["email"],
                    name=input_data["name"]
                )
                tracker.track_create(user)
                return builder.build_response(user, success=True)
            except Exception as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.INTERNAL_ERROR)
                return builder.build_error_response([error])

    @staticmethod
    def update_user(user_id: str, input_data: Dict[str, Any]) -> CascadeResponse:
        """Update a user with cascade tracking."""
        tracker = CascadeTracker(max_depth=2)
        invalidator = CascadeInvalidator()
        builder = CascadeBuilder(tracker, invalidator)

        with tracker:
            try:
                user = TodoService.update_user(
                    user_id=user_id,
                    email=input_data.get("email"),
                    name=input_data.get("name")
                )
                tracker.track_update(user)
                return builder.build_response(user, success=True)
            except ValueError as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.NOT_FOUND)
                return builder.build_error_response([error])
            except Exception as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.INTERNAL_ERROR)
                return builder.build_error_response([error])

    @staticmethod
    def delete_user(user_id: str) -> CascadeResponse:
        """Delete a user with cascade tracking."""
        tracker = CascadeTracker(max_depth=3)  # Cascade to todos
        invalidator = CascadeInvalidator()
        builder = CascadeBuilder(tracker, invalidator)

        with tracker:
            try:
                user = TodoService.delete_user(user_id)
                tracker.track_delete("User", user_id)

                # Track deleted todos
                for tid in todos_db.keys():
                    if tid.startswith(f"todo_{user_id}_"):  # Mock cascade
                        tracker.track_delete("Todo", tid)

                return builder.build_response(user, success=True)
            except ValueError as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.NOT_FOUND)
                return builder.build_error_response([error])
            except Exception as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.INTERNAL_ERROR)
                return builder.build_error_response([error])

    @staticmethod
    def create_todo(input_data: Dict[str, Any]) -> CascadeResponse:
        """Create a new todo with cascade tracking."""
        tracker = CascadeTracker(max_depth=2)
        invalidator = CascadeInvalidator()
        builder = CascadeBuilder(tracker, invalidator)

        with tracker:
            try:
                todo = TodoService.create_todo(
                    title=input_data["title"],
                    description=input_data.get("description"),
                    owner_id=input_data["ownerId"]
                )
                tracker.track_create(todo)

                # Also track the owner as updated (relationship)
                owner = users_db[todo.owner_id]
                tracker.track_update(owner)

                return builder.build_response(todo, success=True)
            except Exception as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.INTERNAL_ERROR)
                return builder.build_error_response([error])

    @staticmethod
    def update_todo(todo_id: str, input_data: Dict[str, Any]) -> CascadeResponse:
        """Update a todo with cascade tracking."""
        tracker = CascadeTracker(max_depth=2)
        invalidator = CascadeInvalidator()
        builder = CascadeBuilder(tracker, invalidator)

        with tracker:
            try:
                todo = TodoService.update_todo(
                    todo_id=todo_id,
                    title=input_data.get("title"),
                    description=input_data.get("description"),
                    completed=input_data.get("completed")
                )
                tracker.track_update(todo)
                return builder.build_response(todo, success=True)
            except ValueError as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.NOT_FOUND)
                return builder.build_error_response([error])
            except Exception as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.INTERNAL_ERROR)
                return builder.build_error_response([error])

    @staticmethod
    def delete_todo(todo_id: str) -> CascadeResponse:
        """Delete a todo with cascade tracking."""
        tracker = CascadeTracker(max_depth=1)
        invalidator = CascadeInvalidator()
        builder = CascadeBuilder(tracker, invalidator)

        with tracker:
            try:
                todo = TodoService.delete_todo(todo_id)
                tracker.track_delete("Todo", todo_id)
                return builder.build_response(todo, success=True)
            except ValueError as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.NOT_FOUND)
                return builder.build_error_response([error])
            except Exception as e:
                error = CascadeError(message=str(e), code=CascadeErrorCode.INTERNAL_ERROR)
                return builder.build_error_response([error])


class QueryResolvers:
    """GraphQL query resolvers."""

    @staticmethod
    def get_user(user_id: str) -> Optional[User]:
        return users_db.get(user_id)

    @staticmethod
    def get_todo(todo_id: str) -> Optional[Todo]:
        return todos_db.get(todo_id)

    @staticmethod
    def list_users(limit: int = 10, offset: int = 0) -> List[User]:
        users = list(users_db.values())
        return users[offset:offset + limit]

    @staticmethod
    def list_todos(limit: int = 10, offset: int = 0) -> List[Todo]:
        todos = list(todos_db.values())
        return todos[offset:offset + limit]

    @staticmethod
    def search_users(query: str) -> List[User]:
        return [u for u in users_db.values() if query.lower() in u.name.lower() or query.lower() in u.email.lower()]

    @staticmethod
    def search_todos(query: str) -> List[Todo]:
        return [t for t in todos_db.values() if query.lower() in t.title.lower()]


# Simple GraphQL server (mock implementation)
class GraphQLServer:
    """Simple GraphQL server for demonstration."""

    def __init__(self):
        self.query_resolvers = QueryResolvers()
        self.mutation_resolvers = MutationResolvers()

    async def execute_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Mock GraphQL execution."""
        # This is a very simplified mock - in reality you'd use a proper GraphQL library
        if "createUser" in query:
            input_data = variables.get("input", {})
            result = self.mutation_resolvers.create_user(input_data)
            return {"data": {"createUser": result.__dict__}}

        elif "updateUser" in query:
            user_id = variables.get("id")
            input_data = variables.get("input", {})
            result = self.mutation_resolvers.update_user(user_id, input_data)
            return {"data": {"updateUser": result.__dict__}}

        elif "deleteUser" in query:
            user_id = variables.get("id")
            result = self.mutation_resolvers.delete_user(user_id)
            return {"data": {"deleteUser": result.__dict__}}

        elif "createTodo" in query:
            input_data = variables.get("input", {})
            result = self.mutation_resolvers.create_todo(input_data)
            return {"data": {"createTodo": result.__dict__}}

        elif "updateTodo" in query:
            todo_id = variables.get("id")
            input_data = variables.get("input", {})
            result = self.mutation_resolvers.update_todo(todo_id, input_data)
            return {"data": {"updateTodo": result.__dict__}}

        elif "deleteTodo" in query:
            todo_id = variables.get("id")
            result = self.mutation_resolvers.delete_todo(todo_id)
            return {"data": {"deleteTodo": result.__dict__}}

        elif "listUsers" in query:
            users = self.query_resolvers.list_users()
            return {"data": {"listUsers": [u.to_dict() for u in users]}}

        elif "listTodos" in query:
            todos = self.query_resolvers.list_todos()
            return {"data": {"listTodos": [t.to_dict() for t in todos]}}

        return {"data": {}}


async def main():
    """Run the GraphQL server."""
    server = GraphQLServer()
    print("GraphQL Cascade TODO App Backend")
    print("Server running at http://localhost:4000/graphql")
    print("Try mutations like createUser, updateUser, createTodo, etc.")
    print("All mutations return cascade data automatically!")

    # Example usage
    print("\nExample: Creating a user")
    result = await server.execute_query("""
        mutation CreateUser($input: CreateUserInput!) {
            createUser(input: $input) {
                success
                data { id name email }
                cascade {
                    updated { __typename id operation }
                    metadata { affectedCount }
                }
            }
        }
    """, {"input": {"email": "john@example.com", "name": "John Doe"}})

    print("Result:", result)


if __name__ == "__main__":
    asyncio.run(main())