/**
 * Runs the specification's server conformance cases against the conformance
 * domain implemented with @graphql-cascade/server: payload cascades through
 * graphql-js, and the extensions transport through the Apollo Server plugin.
 */
import { ApolloServer } from "@apollo/server";
import { buildSchema, graphql } from "graphql";
import {
  DOMAIN_SCHEMA,
  REFERENCE_SCHEMA,
  runServerCases,
  type CascadeLimits,
  type ServerState,
  type ServerTarget,
} from "@graphql-cascade/conformance";
import { CascadeBuilder } from "./builder";
import { notFoundError } from "./errors";
import { createCascadePlugin } from "./integrations/apollo";
import { CascadeTracker } from "./tracker";

interface UserRow {
  id: string;
  name: string;
  email: string;
  managerId?: string | null;
}
interface PostRow {
  id: string;
  title: string;
  published: boolean;
  authorId: string;
}
type Context = { cascadeTracker?: CascadeTracker };

const schema = buildSchema(REFERENCE_SCHEMA + DOMAIN_SCHEMA);

/** The conformance domain, kept in memory. */
class Domain {
  users = new Map<string, UserRow>();
  posts = new Map<string, PostRow>();
  limits: CascadeLimits = {};
  private nextId = 0;

  load(state: ServerState, limits: CascadeLimits = {}) {
    this.users = new Map(state.users?.map((u) => [u.id, { ...u }]));
    this.posts = new Map(state.posts?.map((p) => [p.id, { ...p }]));
    this.limits = limits;
  }

  newId(prefix: string) {
    return `${prefix}${++this.nextId}`;
  }

  /** A user as GraphQL resolves it, with its relationships. */
  user(id: string | null | undefined): Record<string, unknown> | null {
    const row = id ? this.users.get(id) : undefined;
    if (!row) return null;
    const domain = this;
    return {
      __typename: "User",
      id: row.id,
      name: row.name,
      email: row.email,
      postCount: this.postsOf(row.id).length,
      get manager() {
        return domain.user(row.managerId);
      },
      get posts() {
        return domain.postsOf(row.id).map((p) => domain.post(p.id));
      },
    };
  }

  post(id: string): Record<string, unknown> | null {
    const row = this.posts.get(id);
    if (!row) return null;
    const domain = this;
    return {
      __typename: "Post",
      id: row.id,
      title: row.title,
      published: row.published,
      get author() {
        return domain.user(row.authorId);
      },
    };
  }

  postsOf(authorId: string) {
    return [...this.posts.values()].filter((p) => p.authorId === authorId);
  }
}

/**
 * Root resolvers. Each mutation field tracks its own cascade (REQ-012), and
 * also tracks into the operation's tracker when the context has one, for
 * the Apollo Server plugin's extensions cascade.
 */
function rootValue(domain: Domain) {
  const mutate = (
    context: Context,
    change: (
      track: Pick<
        CascadeTracker,
        "trackCreate" | "trackUpdate" | "trackDelete"
      >,
    ) => unknown,
  ) => {
    const tracker = new CascadeTracker();
    tracker.startTransaction();
    const builder = new CascadeBuilder(tracker, undefined, domain.limits);
    const operation = context.cascadeTracker;
    const both = {
      trackCreate: (entity: never) => {
        tracker.trackCreate(entity);
        operation?.trackCreate(entity);
      },
      trackUpdate: (entity: never, options?: never) => {
        tracker.trackUpdate(entity, options);
        operation?.trackUpdate(entity, options);
      },
      trackDelete: (typename: string, id: string) => {
        tracker.trackDelete(typename, id);
        operation?.trackDelete(typename, id);
      },
    };
    const result = change(both as never);
    return result === NOT_FOUND
      ? builder.buildErrorResponse([notFoundError("No such entity")])
      : builder.buildResponse(result);
  };

  const userEntity = (id: string) => domain.user(id) as never;
  const postEntity = (id: string) => domain.post(id) as never;

  return {
    user: ({ id }: { id: string }) => domain.user(id),
    users: () => [...domain.users.keys()].map((id) => domain.user(id)),
    post: ({ id }: { id: string }) => domain.post(id),

    createUser: ({ input }: { input: Omit<UserRow, "id"> }, context: Context) =>
      mutate(context, (track) => {
        const id = domain.newId("u");
        domain.users.set(id, { id, ...input });
        track.trackCreate(userEntity(id));
        return domain.user(id);
      }),

    updateUser: (
      { id, input }: { id: string; input: Partial<UserRow> },
      context: Context,
    ) =>
      mutate(context, (track) => {
        const row = domain.users.get(id);
        if (!row) return NOT_FOUND;
        Object.assign(row, input);
        track.trackUpdate(userEntity(id), {
          updatedFields: Object.keys(input),
        } as never);
        return domain.user(id);
      }),

    deleteUser: ({ id }: { id: string }, context: Context) =>
      mutate(context, (track) => {
        if (!domain.users.delete(id)) return NOT_FOUND;
        track.trackDelete("User", id);
        return null;
      }),

    renameUser: ({ id, name }: { id: string; name: string }) => {
      const response = rootValue(domain).updateUser(
        { id, input: { name } },
        {},
      );
      return response.success
        ? {
            __typename: "RenameUserPayload",
            data: response.data,
            cascade: response.cascade,
            warnings: [],
          }
        : { __typename: "CascadeFailure", errors: response.errors };
    },

    createPost: (
      { input }: { input: { title: string; authorId: string } },
      context: Context,
    ) =>
      mutate(context, (track) => {
        if (!domain.users.has(input.authorId)) return NOT_FOUND;
        const id = domain.newId("p");
        domain.posts.set(id, { id, published: false, ...input });
        track.trackCreate(postEntity(id));
        track.trackUpdate(userEntity(input.authorId), {
          updatedFields: ["postCount", "posts"],
        } as never);
        return domain.post(id);
      }),

    updatePost: (
      { id, input }: { id: string; input: Partial<PostRow> },
      context: Context,
    ) =>
      mutate(context, (track) => {
        const row = domain.posts.get(id);
        if (!row) return NOT_FOUND;
        Object.assign(row, input);
        track.trackUpdate(postEntity(id), {
          updatedFields: Object.keys(input),
        } as never);
        return domain.post(id);
      }),

    publishPosts: ({ authorId }: { authorId: string }, context: Context) =>
      mutate(context, (track) => {
        if (!domain.users.has(authorId)) return NOT_FOUND;
        for (const row of domain.postsOf(authorId)) {
          if (row.published) continue;
          row.published = true;
          track.trackUpdate(postEntity(row.id), {
            updatedFields: ["published"],
          } as never);
        }
        return domain.user(authorId);
      }),
  };
}

const NOT_FOUND = Symbol("not found");

describe("server conformance", () => {
  it("passes every server case with payload cascades", async () => {
    const domain = new Domain();
    const target: ServerTarget = {
      setup: (state, limits) => domain.load(state, limits),
      execute: (source, variableValues) =>
        graphql({
          schema,
          source,
          variableValues,
          rootValue: rootValue(domain),
          contextValue: {},
        }) as never,
    };

    const results = await runServerCases(target);

    expect(results.filter((r) => r.status === "failed")).toEqual([]);
    expect(
      results.filter((r) => r.status === "skipped").map((r) => r.id),
    ).toEqual(["TC-T-001"]);
  });

  it("passes every case with the Apollo Server plugin's extensions cascade", async () => {
    const domain = new Domain();
    const server = new ApolloServer<Context>({
      schema,
      rootValue: rootValue(domain),
      plugins: [createCascadePlugin()],
    });
    await server.start();
    const target: ServerTarget = {
      capabilities: ["extensions"],
      setup: (state, limits) => domain.load(state, limits),
      async execute(query, variables) {
        const cascadeTracker = new CascadeTracker();
        cascadeTracker.startTransaction();
        const response = await server.executeOperation(
          { query, variables },
          { contextValue: { cascadeTracker } },
        );
        if (response.body.kind !== "single")
          throw new Error("Incremental response");
        return response.body.singleResult as never;
      },
    };

    const results = await runServerCases(target);
    await server.stop();

    expect(results.filter((r) => r.status === "failed")).toEqual([]);
    expect(results.every((r) => r.status === "passed")).toBe(true);
  });
});
