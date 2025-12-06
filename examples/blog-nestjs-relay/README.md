# Blog Example: NestJS + Relay + GraphQL Cascade

This example demonstrates a medium-complexity blog application using GraphQL Cascade for relationship tracking and invalidation. The backend uses NestJS with the `@graphql-cascade/server` package, while the frontend uses React with Relay.

## Features

- **User Management**: Create and manage blog authors
- **Post Management**: Create, update, and delete blog posts
- **Comments**: Add comments to posts with relationship tracking
- **Cascade Integration**: Automatic relationship tracking and cache invalidation
- **Relay Frontend**: Modern React frontend with Relay for data fetching

## Architecture

### Backend (NestJS)

The backend uses NestJS with GraphQL and integrates GraphQL Cascade for relationship tracking:

- **Entities**: Post, User, Comment with proper relationships
- **Cascade Module**: Imported from `@graphql-cascade/server`
- **Resolvers**: Use `CascadeBuilder` to track relationships in mutations

Example mutation with cascade tracking:

```typescript
@Mutation(() => CreatePostResponse)
async createPost(@Args('input') input: CreatePostInput) {
  const post = await this.postsService.create(input);
  return buildSuccessResponse(post, (builder) => {
    builder.updated('Post', post);
    builder.updated('User', post.author);
  });
}
```

### Frontend (React + Relay)

The frontend uses Relay with cascade integration:

- **Relay Environment**: Configured to process cascade data
- **Components**: PostList, PostEditor, CommentSection
- **Cascade Processing**: Mutations return cascade data for cache updates

## Running the Example

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development servers:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000 for the frontend

## Key Concepts Demonstrated

### Relationship Tracking

Posts belong to users, comments belong to both posts and users. Cascade tracks these relationships automatically:

- When a user is updated, all their posts are invalidated
- When a post is updated, related comments are invalidated
- Mutations return cascade data to update the Relay cache

### NestJS Integration

- Code-first GraphQL schema with `@nestjs/graphql`
- CascadeModule provides cascade functionality
- Services handle business logic, resolvers handle GraphQL

### Relay Integration

- Relay config processes cascade responses
- Components use Relay fragments for data fetching
- Mutations update the cache using cascade data

## Project Structure

```
blog-nestjs-relay/
├── backend/           # NestJS server
│   ├── src/
│   │   ├── posts/     # Post module
│   │   ├── users/     # User module
│   │   └── comments/  # Comment module
│   └── package.json
├── frontend/          # React + Relay client
│   ├── src/
│   │   └── components/
│   └── package.json
├── docker-compose.yml # Development setup
└── package.json       # Workspace root
```