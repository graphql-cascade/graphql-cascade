import { validateResponse } from "./response";

describe("validateResponse", () => {
  it("valid complete response passes", () => {
    const response = {
      success: true,
      cascade: {
        updated: [{ __typename: "User", id: "1", operation: "CREATE" }],
        deleted: [{ __typename: "Post", id: "2" }],
        invalidations: [{ queryName: "getUsers" }],
        metadata: {
          timestamp: Date.now(),
        },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("response missing success fails", () => {
    const response = {
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "MISSING_SUCCESS",
      message: "Response must have success: boolean",
      path: "success",
    });
  });

  it("response missing cascade fails", () => {
    const response = {
      success: true,
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "MISSING_CASCADE",
      message: "Response must have cascade: CascadeUpdates",
      path: "cascade",
    });
  });

  it("invalid updated entity fails (missing __typename)", () => {
    const response = {
      success: true,
      cascade: {
        updated: [
          { id: "1", operation: "CREATE" }, // missing __typename
        ],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "MISSING_TYPENAME",
      message: "UpdatedEntity must have __typename",
      path: "cascade.updated[0].__typename",
    });
  });

  it("invalid deleted entity fails (missing id)", () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [
          { __typename: "Post" }, // missing id
        ],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "MISSING_ID",
      message: "DeletedEntity must have id",
      path: "cascade.deleted[0].id",
    });
  });

  it("invalid invalidation fails (missing queryName)", () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [
          {}, // missing queryName
        ],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "MISSING_QUERY_NAME",
      message: "QueryInvalidation must have queryName",
      path: "cascade.invalidations[0].queryName",
    });
  });

  it("invalid metadata fails (missing timestamp)", () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: {}, // missing timestamp
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "MISSING_TIMESTAMP",
      message: "metadata must have timestamp",
      path: "cascade.metadata.timestamp",
    });
  });

  it("empty cascade arrays are valid", () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("error response with success=false is valid", () => {
    const response = {
      success: false,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("strict mode catches additional issues (placeholder)", () => {
    const response = {
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    };

    const result = validateResponse(response, { strict: true });
    // Placeholder: in strict mode, we might check for additional constraints
    // For now, it passes like normal mode
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe("errors", () => {
    const withErrors = (errors: unknown) => ({
      success: false,
      errors,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now() },
      },
    });

    it("accepts a standard code with a well-formed domainCode", () => {
      const result = validateResponse(
        withErrors([
          {
            message: "Insufficient funds",
            code: "CONFLICT",
            domainCode: "BILLING.INSUFFICIENT_FUNDS",
          },
        ]),
      );
      expect(result.errors).toHaveLength(0);
    });

    it("accepts null errors", () => {
      expect(validateResponse(withErrors(null)).valid).toBe(true);
    });

    it("rejects errors that are not an array", () => {
      expect(validateResponse(withErrors({})).errors).toContainEqual({
        code: "INVALID_ERRORS",
        message: "errors must be an array or null",
        path: "errors",
      });
    });

    it("rejects codes outside the standard CascadeErrorCode set", () => {
      expect(
        validateResponse(
          withErrors([{ message: "No funds", code: "INSUFFICIENT_FUNDS" }]),
        ).errors,
      ).toContainEqual({
        code: "INVALID_ERROR_CODE",
        message:
          'code "INSUFFICIENT_FUNDS" is not a standard CascadeErrorCode; use domainCode for application-specific codes',
        path: "errors[0].code",
      });
    });

    it.each(["insufficient_funds", "BILLING..FUNDS", "1FUNDS", ""])(
      "rejects malformed domainCode %p",
      (domainCode) => {
        expect(
          validateResponse(
            withErrors([{ message: "x", code: "CONFLICT", domainCode }]),
          ).errors,
        ).toContainEqual({
          code: "INVALID_DOMAIN_CODE",
          message: `domainCode "${domainCode}" must be UPPER_SNAKE_CASE segments separated by "."`,
          path: "errors[0].domainCode",
        });
      },
    );
  });

  describe("type invalidations", () => {
    const withCascade = (
      extra: Record<string, unknown>,
      truncated?: unknown,
    ) => ({
      success: true,
      cascade: {
        updated: [],
        deleted: [],
        invalidations: [],
        metadata: { timestamp: Date.now(), truncated },
        ...extra,
      },
    });

    it("accepts a truncated cascade covered by type invalidations", () => {
      const result = validateResponse(
        withCascade(
          { typeInvalidations: [{ typename: "Post", affectedCount: 800 }] },
          true,
        ),
      );
      expect(result.errors).toHaveLength(0);
    });

    it("accepts responses from 1.1 servers without the new fields", () => {
      expect(validateResponse(withCascade({})).valid).toBe(true);
    });

    it("rejects typeInvalidations that are not an array", () => {
      expect(
        validateResponse(withCascade({ typeInvalidations: {} })).errors,
      ).toContainEqual({
        code: "INVALID_TYPE_INVALIDATIONS",
        message: "cascade.typeInvalidations must be an array",
        path: "cascade.typeInvalidations",
      });
    });

    it("requires a typename on every type invalidation", () => {
      expect(
        validateResponse(withCascade({ typeInvalidations: [{}] })).errors,
      ).toContainEqual({
        code: "MISSING_TYPENAME",
        message: "TypeInvalidation must have typename",
        path: "cascade.typeInvalidations[0].typename",
      });
    });

    it("rejects a non-boolean truncated flag", () => {
      expect(validateResponse(withCascade({}, "yes")).errors).toContainEqual({
        code: "INVALID_TRUNCATED",
        message: "metadata.truncated must be a boolean",
        path: "cascade.metadata.truncated",
      });
    });

    it("rejects truncation without any typeInvalidations field", () => {
      expect(validateResponse(withCascade({}, true)).errors).toContainEqual(
        expect.objectContaining({ code: "UNCOVERED_TRUNCATION" }),
      );
    });

    it("rejects truncation that nothing covers", () => {
      expect(
        validateResponse(withCascade({ typeInvalidations: [] }, true)).errors,
      ).toContainEqual({
        code: "UNCOVERED_TRUNCATION",
        message:
          "metadata.truncated is true but cascade.typeInvalidations is empty; omitted entities must be covered by type invalidations",
        path: "cascade.typeInvalidations",
      });
    });
  });
});
