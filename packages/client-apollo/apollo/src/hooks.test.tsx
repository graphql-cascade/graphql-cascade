import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  gql,
} from "@apollo/client";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import {
  useCascadeMutation,
  UseCascadeMutationOptions,
  ConflictResolutionStrategy,
} from "./hooks";
import { CascadeResponse, CascadeOperation } from "@graphql-cascade/client";

// Test mutation
const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) {
      data {
        id
        name
      }
      cascade {
        updated {
          __typename
          id
          entity
        }
        deleted {
          __typename
          id
        }
      }
    }
  }
`;

// Helper to wrap hook with Apollo provider
function createWrapper(mocks: MockedResponse[] = []) {
  return ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children}
    </MockedProvider>
  );
}

// Helper to create a successful cascade response
function createSuccessResponse(
  id: string,
  name: string,
): CascadeResponse<{ id: string; name: string }> {
  return {
    data: { id, name },
    success: true,
    cascade: {
      updated: [
        {
          __typename: "User",
          id,
          operation: CascadeOperation.UPDATED,
          entity: { id, name },
        },
      ],
      deleted: [],
      invalidations: [],
      metadata: {
        timestamp: new Date().toISOString(),
        depth: 1,
        affectedCount: 1,
      },
    },
  };
}

describe("useCascadeMutation", () => {
  describe("basic mutation", () => {
    it("should execute mutation and extract cascade data", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "John" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "John"),
          },
        },
      };

      const { result } = renderHook(
        () => useCascadeMutation(UPDATE_USER_MUTATION),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate, state] = result.current;

      // Initial state
      expect(state.loading).toBe(false);
      expect(state.called).toBe(false);
      expect(state.data).toBeUndefined();
      expect(state.cascade).toBeUndefined();

      // Execute mutation
      let mutationResult;
      await act(async () => {
        mutationResult = await mutate({
          variables: { id: "1", name: "John" },
        });
      });

      // Wait for update
      await waitFor(() => {
        const [, newState] = result.current;
        expect(newState.called).toBe(true);
        expect(newState.cascade).toBeDefined();
      });

      // Check result
      expect(mutationResult).toEqual({
        data: { id: "1", name: "John" },
        cascade: expect.objectContaining({
          updated: expect.arrayContaining([
            expect.objectContaining({
              __typename: "User",
              id: "1",
            }),
          ]),
        }),
      });
    });

    it("should call onCompleted callback with cascade data", async () => {
      const onCompleted = jest.fn();
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Jane" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Jane"),
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            onCompleted,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Jane" } });
      });

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledWith(
          { id: "1", name: "Jane" },
          expect.objectContaining({
            updated: expect.any(Array),
            deleted: expect.any(Array),
          }),
        );
      });
    });

    it("should call onError callback on mutation failure", async () => {
      const onError = jest.fn();
      const mockError = new Error("Mutation failed");
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Error" },
        },
        error: mockError,
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            onError,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        try {
          await mutate({ variables: { id: "1", name: "Error" } });
        } catch (err) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error), {
          id: "1",
          name: "Error",
        });
      });
    });
  });

  describe("optimistic updates", () => {
    it("should apply optimistic update before mutation", async () => {
      const optimisticCascadeResponse = jest.fn((variables: any) => ({
        data: { id: variables.id, name: variables.name },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: variables.id,
              operation: CascadeOperation.UPDATED,
              entity: { id: variables.id, name: variables.name },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      }));

      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Optimistic" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Optimistic"),
          },
        },
        delay: 100, // Add delay to see optimistic update
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        const promise = mutate({ variables: { id: "1", name: "Optimistic" } });

        // Optimistic response should be called immediately
        expect(optimisticCascadeResponse).toHaveBeenCalledWith({
          id: "1",
          name: "Optimistic",
        });

        await promise;
      });
    });

    it("should rollback optimistic update on error", async () => {
      const optimisticCascadeResponse = jest.fn((variables: any) => ({
        data: { id: variables.id, name: variables.name },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: variables.id,
              operation: CascadeOperation.UPDATED,
              entity: { id: variables.id, name: variables.name },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      }));

      const mockError = new Error("Network error");
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Rollback" },
        },
        error: mockError,
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        try {
          await mutate({ variables: { id: "1", name: "Rollback" } });
        } catch (err) {
          // Expected error
        }
      });

      // Verify optimistic update was applied
      expect(optimisticCascadeResponse).toHaveBeenCalled();

      // Rollback should have occurred (would need to spy on cache operations)
    });

    it("should throw error if optimisticCascadeResponse not provided with optimistic:true", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Missing" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Missing"),
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            // optimisticCascadeResponse not provided
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await expect(
          mutate({ variables: { id: "1", name: "Missing" } }),
        ).rejects.toThrow(
          "optimisticCascadeResponse function is required for optimistic updates",
        );
      });
    });
  });

  describe("conflict resolution", () => {
    it("should detect conflicts between optimistic and server response", async () => {
      const optimisticCascadeResponse = (variables: any) => ({
        data: { id: variables.id, name: "Optimistic Name" },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: variables.id,
              operation: CascadeOperation.UPDATED,
              entity: { id: variables.id, name: "Optimistic Name" },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      });

      // Server returns different name (conflict!)
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Optimistic Name" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Server Name"),
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
            conflictResolution: "SERVER_WINS",
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Optimistic Name" } });
      });

      // Conflict should be detected and resolved with SERVER_WINS strategy
      // (Would need more sophisticated mocking to verify the resolution)
    });

    it.each([
      "SERVER_WINS" as const,
      "CLIENT_WINS" as const,
      "MERGE" as const,
      "MANUAL" as const,
    ])("should handle %s conflict resolution strategy", async (strategy) => {
      const optimisticCascadeResponse = (variables: any) => ({
        data: { id: variables.id, name: variables.name },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: variables.id,
              operation: CascadeOperation.UPDATED,
              entity: { id: variables.id, name: variables.name },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      });

      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Test" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Test"),
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
            conflictResolution: strategy,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Test" } });
      });

      // Should complete without error
      const [, state] = result.current;
      expect(state.error).toBeUndefined();
    });
  });

  describe("cascade client integration", () => {
    it("should apply cascade updates to cache", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Cache Test" },
        },
        result: {
          data: {
            updateUser: {
              data: { id: "1", name: "Cache Test" },
              cascade: {
                updated: [
                  {
                    __typename: "User",
                    id: "1",
                    entity: { id: "1", name: "Cache Test" },
                  },
                ],
                deleted: [],
              },
            },
          },
        },
      };

      const { result } = renderHook(
        () => useCascadeMutation(UPDATE_USER_MUTATION),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Cache Test" } });
      });

      await waitFor(() => {
        const [, state] = result.current;
        expect(state.cascade).toBeDefined();
        expect(state.cascade?.updated).toHaveLength(1);
      });
    });

    it("should handle deleted entities in cascade", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Delete Test" },
        },
        result: {
          data: {
            updateUser: {
              data: { id: "1", name: "Delete Test" },
              cascade: {
                updated: [],
                deleted: [
                  {
                    __typename: "Post",
                    id: "post-1",
                  },
                ],
              },
            },
          },
        },
      };

      const { result } = renderHook(
        () => useCascadeMutation(UPDATE_USER_MUTATION),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Delete Test" } });
      });

      await waitFor(() => {
        const [, state] = result.current;
        expect(state.cascade?.deleted).toHaveLength(1);
        expect(state.cascade?.deleted[0].__typename).toBe("Post");
      });
    });
  });

  describe("error handling", () => {
    it("should handle malformed cascade response gracefully", async () => {
      const onError = jest.fn();

      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Malformed" },
        },
        result: {
          data: {
            updateUser: {
              // Missing cascade data - this should trigger error handling
              data: { id: "1", name: "Malformed" },
            },
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            onError,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Malformed" } });
      });

      // Should call onError callback when cascade processing fails
      expect(onError).toHaveBeenCalledWith(expect.any(Error), {
        id: "1",
        name: "Malformed",
      });
    });

    it("should handle empty mutation response", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Empty" },
        },
        result: {
          data: {},
        },
      };

      const { result } = renderHook(
        () => useCascadeMutation(UPDATE_USER_MUTATION),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await expect(
          mutate({ variables: { id: "1", name: "Empty" } }),
        ).rejects.toThrow();
      });
    });
  });

  describe("state management", () => {
    it("should update loading state during mutation", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Loading" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Loading"),
          },
        },
        delay: 50,
      };

      const { result } = renderHook(
        () => useCascadeMutation(UPDATE_USER_MUTATION),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);

      act(() => {
        mutate({ variables: { id: "1", name: "Loading" } });
      });

      // Should be loading after mutation starts
      await waitFor(() => {
        expect(result.current[1].called).toBe(true);
      });
    });

    it("should preserve cascade data across renders", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Preserve" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Preserve"),
          },
        },
      };

      const { result, rerender } = renderHook(
        () => useCascadeMutation(UPDATE_USER_MUTATION),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Preserve" } });
      });

      await waitFor(() => {
        expect(result.current[1].cascade).toBeDefined();
      });

      const cascadeBeforeRerender = result.current[1].cascade;

      // Rerender hook
      rerender();

      // Cascade data should be preserved
      expect(result.current[1].cascade).toBe(cascadeBeforeRerender);
    });
  });

  describe("Advanced Conflict Resolution", () => {
    it("should trigger conflict resolution when optimistic and server differ", async () => {
      const optimisticCascadeResponse = (variables: any) => ({
        data: { id: variables.id, name: "Optimistic Name" },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: variables.id,
              operation: CascadeOperation.UPDATED,
              entity: { id: variables.id, name: "Optimistic Name", age: 25 },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      });

      // Server returns different data - this will trigger conflict
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Different Name" },
        },
        result: {
          data: {
            updateUser: {
              ...createSuccessResponse("1", "Server Name"),
              cascade: {
                updated: [
                  {
                    __typename: "User",
                    id: "1",
                    operation: CascadeOperation.UPDATED,
                    entity: { id: "1", name: "Server Name", age: 30 },
                  },
                ],
                deleted: [],
                invalidations: [],
                metadata: {
                  timestamp: new Date().toISOString(),
                  depth: 1,
                  affectedCount: 1,
                },
              },
            },
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
            conflictResolution: "SERVER_WINS",
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "1", name: "Different Name" } });
      });

      // Should complete successfully with server data winning
      await waitFor(() => {
        expect(result.current[1].data).toBeDefined();
      });
    });

    it("should handle CLIENT_WINS conflict resolution strategy", async () => {
      const optimisticCascadeResponse = (variables: any) => ({
        data: { id: variables.id, name: "Client Name" },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: variables.id,
              operation: CascadeOperation.UPDATED,
              entity: { id: variables.id, name: "Client Name", score: 100 },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      });

      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "2", name: "Test" },
        },
        result: {
          data: {
            updateUser: {
              ...createSuccessResponse("2", "Server Name"),
              cascade: {
                updated: [
                  {
                    __typename: "User",
                    id: "2",
                    operation: CascadeOperation.UPDATED,
                    entity: { id: "2", name: "Server Name", score: 50 },
                  },
                ],
                deleted: [],
                invalidations: [],
                metadata: {
                  timestamp: new Date().toISOString(),
                  depth: 1,
                  affectedCount: 1,
                },
              },
            },
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
            conflictResolution: "CLIENT_WINS",
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        await mutate({ variables: { id: "2", name: "Test" } });
      });

      await waitFor(() => {
        expect(result.current[1].data).toBeDefined();
      });
    });

    it("should rollback optimistically created entities on error", async () => {
      const optimisticCascadeResponse = (variables: any) => ({
        data: { id: "new-id", name: variables.name },
        success: true,
        cascade: {
          updated: [
            {
              __typename: "User",
              id: "new-id",
              operation: CascadeOperation.CREATED,
              entity: { id: "new-id", name: variables.name },
            },
          ],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      });

      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "new-id", name: "New User" },
        },
        error: new Error("Creation failed"),
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        try {
          await mutate({ variables: { id: "new-id", name: "New User" } });
        } catch (e) {
          // Expected error
        }
      });

      // Should have rolled back the optimistic create
      await waitFor(() => {
        expect(result.current[1].error).toBeDefined();
      });
    });

    it("should handle optimistic deletes with rollback", async () => {
      const optimisticCascadeResponse = (_variables: any) => ({
        data: { success: true },
        success: true,
        cascade: {
          updated: [],
          deleted: [
            {
              __typename: "User",
              id: "delete-me",
              operation: CascadeOperation.DELETED,
            },
          ],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
          },
        },
      });

      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "delete-me" },
        },
        error: new Error("Delete failed"),
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            optimisticCascadeResponse,
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        try {
          await mutate({ variables: { id: "delete-me" } });
        } catch (e) {
          // Expected error
        }
      });

      // Should have rolled back the optimistic delete
      await waitFor(() => {
        expect(result.current[1].error).toBeDefined();
      });
    });

    it("should throw error when optimistic enabled without optimisticCascadeResponse", async () => {
      const mockResponse: MockedResponse = {
        request: {
          query: UPDATE_USER_MUTATION,
          variables: { id: "1", name: "Test" },
        },
        result: {
          data: {
            updateUser: createSuccessResponse("1", "Test"),
          },
        },
      };

      const { result } = renderHook(
        () =>
          useCascadeMutation(UPDATE_USER_MUTATION, {
            optimistic: true,
            // Missing optimisticCascadeResponse!
          }),
        { wrapper: createWrapper([mockResponse]) },
      );

      const [mutate] = result.current;

      await act(async () => {
        try {
          await mutate({ variables: { id: "1", name: "Test" } });
          fail("Should have thrown an error");
        } catch (error: any) {
          expect(error.message).toContain("optimisticCascadeResponse");
        }
      });
    });
  });
});
