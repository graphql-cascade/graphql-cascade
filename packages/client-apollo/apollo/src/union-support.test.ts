import {
  extractCascadeFromUnion,
  extractCascadeFromMutationResult,
  isSuccessResponse,
  isErrorResponse,
  UnionCascadeConfig,
} from "./union-support";
import { CascadeUpdates, CascadeOperation } from "@graphql-cascade/client";

describe("union-support", () => {
  const mockCascade: CascadeUpdates = {
    updated: [
      {
        __typename: "User",
        id: "1",
        operation: CascadeOperation.UPDATED,
        entity: { id: "1", name: "John" },
      },
    ],
    deleted: [],
    invalidations: [],
    metadata: { timestamp: "2024-01-01", depth: 1, affectedCount: 1 },
  };

  describe("extractCascadeFromUnion", () => {
    describe("union type responses", () => {
      it("should extract cascade data from success union type", () => {
        const response = {
          __typename: "CreateUserSuccess",
          user: { id: "1", name: "John" },
          cascade: mockCascade,
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(false);
        expect(result.typename).toBe("CreateUserSuccess");
        expect(result.cascade).toEqual(mockCascade);
        expect(result.data).toEqual({ id: "1", name: "John" });
      });

      it("should handle error union type", () => {
        const response = {
          __typename: "CreateUserError",
          errors: [{ message: "User already exists", code: "DUPLICATE" }],
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(true);
        expect(result.typename).toBe("CreateUserError");
        expect(result.cascade).toBeNull();
        expect(result.data).toBeNull();
        expect(result.errors).toEqual([
          { message: "User already exists", code: "DUPLICATE" },
        ]);
      });

      it("should detect error types by typename pattern", () => {
        const response = {
          __typename: "SomethingError",
          errors: [{ message: "Failed" }],
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(true);
        expect(result.typename).toBe("SomethingError");
      });

      it("should use successTypes config to validate response", () => {
        const response = {
          __typename: "UnknownType",
          user: { id: "1" },
          cascade: mockCascade,
        };

        const config: UnionCascadeConfig = {
          successTypes: ["CreateUserSuccess"],
        };

        const result = extractCascadeFromUnion(response, config);

        expect(result.isError).toBe(true);
        expect(result.errors).toEqual([
          { message: "Unexpected response type: UnknownType" },
        ]);
      });

      it("should use errorTypes config to identify errors", () => {
        const response = {
          __typename: "CustomFailure",
          errors: [{ message: "Custom error" }],
        };

        const config: UnionCascadeConfig = {
          errorTypes: ["CustomFailure"],
        };

        const result = extractCascadeFromUnion(response, config);

        expect(result.isError).toBe(true);
        expect(result.typename).toBe("CustomFailure");
      });

      it("should use custom dataField config", () => {
        const response = {
          __typename: "CreateUserSuccess",
          customData: { id: "1", name: "John" },
          cascade: mockCascade,
        };

        const config: UnionCascadeConfig = {
          dataField: "customData",
        };

        const result = extractCascadeFromUnion(response, config);

        expect(result.data).toEqual({ id: "1", name: "John" });
      });

      it("should handle multiple data fields by using the first", () => {
        const response = {
          __typename: "CreateUserSuccess",
          user: { id: "1", name: "John" },
          metadata: { createdAt: "2024-01-01" },
          cascade: mockCascade,
        };

        const result = extractCascadeFromUnion(response);

        // Should use 'user' as it comes first alphabetically after filtering
        expect(result.data).toEqual({ id: "1", name: "John" });
      });

      it("should throw error when throwOnMissing is true and no cascade found", () => {
        const response = {
          __typename: "CreateUserSuccess",
          user: { id: "1" },
        };

        const config: UnionCascadeConfig = {
          throwOnMissing: true,
        };

        expect(() => extractCascadeFromUnion(response, config)).toThrow(
          "No cascade data found in response type: CreateUserSuccess",
        );
      });
    });

    describe("non-union responses", () => {
      it("should handle direct cascade response (no union)", () => {
        const response = {
          success: true,
          data: { id: "1", name: "John" },
          cascade: mockCascade,
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(false);
        expect(result.cascade).toEqual(mockCascade);
        expect(result.data).toEqual({ id: "1", name: "John" });
      });

      it("should handle response with __typename but no cascade", () => {
        const response = {
          __typename: "User",
          success: true,
          user: { id: "1", name: "John" },
          cascade: mockCascade,
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(false);
        expect(result.cascade).toEqual(mockCascade);
        expect(result.data).toEqual({ id: "1", name: "John" });
      });

      it("should return data without cascade if not found", () => {
        const response = {
          success: true,
          data: { id: "1", name: "John" },
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(false);
        expect(result.cascade).toBeNull();
        expect(result.data).toEqual(response);
      });

      it("should throw when throwOnMissing is true and not a union type", () => {
        const response = {
          success: true,
          data: { id: "1" },
        };

        const config: UnionCascadeConfig = {
          throwOnMissing: true,
        };

        expect(() => extractCascadeFromUnion(response, config)).toThrow(
          "Response is not a union type and does not contain cascade data",
        );
      });
    });

    describe("edge cases", () => {
      it("should handle null response", () => {
        const result = extractCascadeFromUnion(null);

        expect(result.isError).toBe(true);
        expect(result.cascade).toBeNull();
        expect(result.data).toBeNull();
        expect(result.errors).toEqual([
          { message: "Response is null or undefined" },
        ]);
      });

      it("should handle undefined response", () => {
        const result = extractCascadeFromUnion(undefined);

        expect(result.isError).toBe(true);
        expect(result.cascade).toBeNull();
        expect(result.data).toBeNull();
      });

      it("should handle response with no data fields", () => {
        const response = {
          __typename: "CreateUserSuccess",
          cascade: mockCascade,
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(false);
        expect(result.cascade).toEqual(mockCascade);
        expect(result.data).toBeNull();
      });

      it("should handle response with errors field but not error type", () => {
        const response = {
          __typename: "CreateUserSuccess",
          user: { id: "1" },
          cascade: mockCascade,
        };

        const result = extractCascadeFromUnion(response);

        expect(result.isError).toBe(false);
        expect(result.data).toEqual({ id: "1" });
      });
    });
  });

  describe("extractCascadeFromMutationResult", () => {
    it("should extract from full mutation result", () => {
      const mutationResult = {
        createUser: {
          __typename: "CreateUserSuccess",
          user: { id: "1", name: "John" },
          cascade: mockCascade,
        },
      };

      const result = extractCascadeFromMutationResult(mutationResult);

      expect(result.isError).toBe(false);
      expect(result.cascade).toEqual(mockCascade);
      expect(result.data).toEqual({ id: "1", name: "John" });
    });

    it("should handle multiple mutations by using first", () => {
      const mutationResult = {
        createUser: {
          __typename: "CreateUserSuccess",
          user: { id: "1" },
          cascade: mockCascade,
        },
        updateUser: {
          __typename: "UpdateUserSuccess",
          user: { id: "2" },
          cascade: mockCascade,
        },
      };

      const result = extractCascadeFromMutationResult(mutationResult);

      // Should use createUser (first key)
      expect(result.data).toEqual({ id: "1" });
    });

    it("should handle error in mutation result", () => {
      const mutationResult = {
        createUser: {
          __typename: "CreateUserError",
          errors: [{ message: "Failed" }],
        },
      };

      const result = extractCascadeFromMutationResult(mutationResult);

      expect(result.isError).toBe(true);
      expect(result.errors).toEqual([{ message: "Failed" }]);
    });

    it("should handle null mutation result", () => {
      const result = extractCascadeFromMutationResult(null);

      expect(result.isError).toBe(true);
      expect(result.errors).toEqual([{ message: "Invalid mutation result" }]);
    });

    it("should handle empty mutation result", () => {
      const result = extractCascadeFromMutationResult({});

      expect(result.isError).toBe(true);
      expect(result.errors).toEqual([
        { message: "No mutation field found in result" },
      ]);
    });

    it("should pass config through to extractCascadeFromUnion", () => {
      const mutationResult = {
        createUser: {
          __typename: "CreateUserSuccess",
          customData: { id: "1" },
          cascade: mockCascade,
        },
      };

      const config: UnionCascadeConfig = {
        dataField: "customData",
      };

      const result = extractCascadeFromMutationResult(mutationResult, config);

      expect(result.data).toEqual({ id: "1" });
    });
  });

  describe("type guards", () => {
    describe("isSuccessResponse", () => {
      it("should return true for success type", () => {
        const response = {
          __typename: "CreateUserSuccess",
          user: { id: "1" },
        };

        expect(isSuccessResponse(response, ["CreateUserSuccess"])).toBe(true);
      });

      it("should return false for non-success type", () => {
        const response = {
          __typename: "CreateUserError",
          errors: [],
        };

        expect(isSuccessResponse(response, ["CreateUserSuccess"])).toBe(false);
      });

      it("should return false for response without __typename", () => {
        const response = {
          user: { id: "1" },
        };

        expect(isSuccessResponse(response, ["CreateUserSuccess"])).toBe(false);
      });

      it("should return false for null", () => {
        expect(isSuccessResponse(null, ["CreateUserSuccess"])).toBe(false);
      });
    });

    describe("isErrorResponse", () => {
      it("should return true for error type", () => {
        const response = {
          __typename: "CreateUserError",
          errors: [{ message: "Failed" }],
        };

        expect(isErrorResponse(response, ["CreateUserError"])).toBe(true);
      });

      it("should return true for typename containing 'error'", () => {
        const response = {
          __typename: "SomethingError",
          errors: [{ message: "Failed" }],
        };

        expect(isErrorResponse(response, [])).toBe(true);
      });

      it("should return false for success type", () => {
        const response = {
          __typename: "CreateUserSuccess",
          user: { id: "1" },
        };

        expect(isErrorResponse(response, ["CreateUserError"])).toBe(false);
      });

      it("should return false for response without __typename", () => {
        const response = {
          errors: [{ message: "Failed" }],
        };

        expect(isErrorResponse(response, ["CreateUserError"])).toBe(false);
      });

      it("should return false for null", () => {
        expect(isErrorResponse(null, ["CreateUserError"])).toBe(false);
      });
    });
  });

  describe("PrintOptim integration examples", () => {
    it("should handle PrintOptim's CreatePrintServer pattern", () => {
      const response = {
        __typename: "CreatePrintServerSuccess",
        printServer: {
          id: "123",
          hostname: "printer.example.com",
          nTotalAllocations: 0,
        },
        cascade: mockCascade,
      };

      const config: UnionCascadeConfig = {
        successTypes: ["CreatePrintServerSuccess"],
        errorTypes: ["CreatePrintServerError"],
      };

      const result = extractCascadeFromUnion(response, config);

      expect(result.isError).toBe(false);
      expect(result.typename).toBe("CreatePrintServerSuccess");
      expect(result.cascade).toEqual(mockCascade);
      expect(result.data).toEqual({
        id: "123",
        hostname: "printer.example.com",
        nTotalAllocations: 0,
      });
    });

    it("should handle PrintOptim's error response pattern", () => {
      const response = {
        __typename: "CreatePrintServerError",
        errors: [
          {
            identifier: "hostname",
            message: "Hostname already exists",
          },
        ],
      };

      const config: UnionCascadeConfig = {
        successTypes: ["CreatePrintServerSuccess"],
        errorTypes: ["CreatePrintServerError"],
      };

      const result = extractCascadeFromUnion(response, config);

      expect(result.isError).toBe(true);
      expect(result.typename).toBe("CreatePrintServerError");
      expect(result.cascade).toBeNull();
      expect(result.errors).toEqual([
        {
          identifier: "hostname",
          message: "Hostname already exists",
        },
      ]);
    });

    it("should work with full mutation result from PrintOptim", () => {
      const mutationResult = {
        createPrintServer: {
          __typename: "CreatePrintServerSuccess",
          printServer: {
            id: "123",
            hostname: "printer.example.com",
            nTotalAllocations: 0,
          },
          cascade: {
            updated: [
              {
                __typename: "PrintServer",
                id: "123",
                operation: CascadeOperation.CREATED,
                entity: {
                  id: "123",
                  hostname: "printer.example.com",
                  nTotalAllocations: 0,
                },
              },
            ],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: "2024-01-01",
              depth: 1,
              affectedCount: 1,
            },
          },
        },
      };

      const config: UnionCascadeConfig = {
        successTypes: ["CreatePrintServerSuccess"],
        errorTypes: ["CreatePrintServerError"],
      };

      const result = extractCascadeFromMutationResult(mutationResult, config);

      expect(result.isError).toBe(false);
      expect(result.cascade).toBeDefined();
      expect(result.data).toEqual({
        id: "123",
        hostname: "printer.example.com",
        nTotalAllocations: 0,
      });
    });
  });
});
