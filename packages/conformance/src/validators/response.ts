import type { ResponseValidationResult, ValidationError } from "../types";
import {
  INVALIDATION_SCOPE_VALUES,
  INVALIDATION_STRATEGY_VALUES,
} from "./schema";

const STANDARD_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CONFLICT",
  "INTERNAL_ERROR",
  "TRANSACTION_FAILED",
  "TIMEOUT",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
]);

const DOMAIN_CODE_PATTERN = /^[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)*$/;

/**
 * Cascade entries name their entity's type in `typename`. The `__typename`
 * that earlier versions used is deprecated, and inside GraphQL execution it
 * resolves to the wrapper type, so it never stands in for `typename`.
 */
function missingTypename(
  kind: string,
  path: string,
  entry: Record<string, unknown>,
): ValidationError {
  const hint = entry.__typename
    ? " (__typename is deprecated since specification 1.3.0)"
    : "";
  return {
    code: "MISSING_TYPENAME",
    message: `${kind} must have typename${hint}`,
    path: `${path}.typename`,
  };
}

/**
 * A QueryInvalidation needs a known strategy and scope, plus whatever its
 * scope matches on: queryName (or queryHash, for EXACT) or queryPattern.
 */
function validateQueryInvalidation(
  inv: Record<string, unknown>,
  path: string,
): ValidationError[] {
  const problems: ValidationError[] = [];
  if (!INVALIDATION_STRATEGY_VALUES.includes(inv.strategy as string)) {
    problems.push({
      code: "INVALID_STRATEGY",
      message: `QueryInvalidation.strategy must be one of ${INVALIDATION_STRATEGY_VALUES.join(", ")}`,
      path: `${path}.strategy`,
    });
  }
  if (!INVALIDATION_SCOPE_VALUES.includes(inv.scope as string)) {
    problems.push({
      code: "INVALID_SCOPE",
      message: `QueryInvalidation.scope must be one of ${INVALIDATION_SCOPE_VALUES.join(", ")}`,
      path: `${path}.scope`,
    });
  }
  const namesQuery =
    inv.scope === "PREFIX" || (inv.scope === "EXACT" && !inv.queryHash);
  if (namesQuery && !inv.queryName) {
    problems.push({
      code: "MISSING_QUERY_NAME",
      message: `QueryInvalidation with ${inv.scope} scope must have queryName`,
      path: `${path}.queryName`,
    });
  }
  if (inv.scope === "PATTERN" && !inv.queryPattern) {
    problems.push({
      code: "MISSING_QUERY_PATTERN",
      message: "QueryInvalidation with PATTERN scope must have queryPattern",
      path: `${path}.queryPattern`,
    });
  }
  return problems;
}

/**
 * Type invalidations and the truncation flag were added in specification
 * 1.2; responses without them are valid.
 */
function validateTypeInvalidations(
  cascade: Record<string, unknown>,
): ValidationError[] {
  const { typeInvalidations } = cascade;
  const metadata = (cascade.metadata ?? {}) as Record<string, unknown>;
  const problems: ValidationError[] = [];

  if (
    metadata.truncated !== undefined &&
    typeof metadata.truncated !== "boolean"
  ) {
    problems.push({
      code: "INVALID_TRUNCATED",
      message: "metadata.truncated must be a boolean",
      path: "cascade.metadata.truncated",
    });
  }

  const covered =
    Array.isArray(typeInvalidations) && typeInvalidations.length > 0;
  if (metadata.truncated === true && !covered) {
    problems.push({
      code: "UNCOVERED_TRUNCATION",
      message:
        "metadata.truncated is true but cascade.typeInvalidations is empty; omitted entities must be covered by type invalidations",
      path: "cascade.typeInvalidations",
    });
  }

  if (typeInvalidations === undefined) return problems;
  if (!Array.isArray(typeInvalidations)) {
    problems.push({
      code: "INVALID_TYPE_INVALIDATIONS",
      message: "cascade.typeInvalidations must be an array",
      path: "cascade.typeInvalidations",
    });
    return problems;
  }

  typeInvalidations.forEach((inv: unknown, i: number) => {
    const typename = (inv as Record<string, unknown> | null)?.typename;
    if (typeof typename !== "string" || typename === "") {
      problems.push({
        code: "MISSING_TYPENAME",
        message: "TypeInvalidation must have typename",
        path: `cascade.typeInvalidations[${i}].typename`,
      });
    }
  });

  return problems;
}

function validateErrors(errors: unknown): ValidationError[] {
  if (errors === undefined || errors === null) return [];
  if (!Array.isArray(errors)) {
    return [
      {
        code: "INVALID_ERRORS",
        message: "errors must be an array or null",
        path: "errors",
      },
    ];
  }

  const problems: ValidationError[] = [];
  errors.forEach((error: unknown, i: number) => {
    if (!error || typeof error !== "object") return;
    const { code, domainCode } = error as Record<string, unknown>;
    if (typeof code !== "string" || !STANDARD_ERROR_CODES.has(code)) {
      problems.push({
        code: "INVALID_ERROR_CODE",
        message: `code "${String(code)}" is not a standard CascadeErrorCode; use domainCode for application-specific codes`,
        path: `errors[${i}].code`,
      });
    }
    if (
      domainCode !== undefined &&
      domainCode !== null &&
      (typeof domainCode !== "string" || !DOMAIN_CODE_PATTERN.test(domainCode))
    ) {
      problems.push({
        code: "INVALID_DOMAIN_CODE",
        message: `domainCode "${String(domainCode)}" must be UPPER_SNAKE_CASE segments separated by "."`,
        path: `errors[${i}].domainCode`,
      });
    }
  });
  return problems;
}

/**
 * Validates a cascade mutation response
 */
export function validateResponse(
  response: unknown,
  _options?: { strict?: boolean },
): ResponseValidationResult {
  const errors: ValidationError[] = [];

  if (!response || typeof response !== "object") {
    return {
      valid: false,
      errors: [
        {
          code: "INVALID_RESPONSE",
          message: "Response must be an object",
        },
      ],
    };
  }

  const r = response as Record<string, unknown>;

  // Check success field
  if (typeof r.success !== "boolean") {
    errors.push({
      code: "MISSING_SUCCESS",
      message: "Response must have success: boolean",
      path: "success",
    });
  }

  errors.push(...validateErrors(r.errors));

  // Check cascade field
  if (!r.cascade || typeof r.cascade !== "object") {
    errors.push({
      code: "MISSING_CASCADE",
      message: "Response must have cascade: CascadeUpdates",
      path: "cascade",
    });
  } else {
    const cascade = r.cascade as Record<string, unknown>;

    // Validate updated array
    if (!Array.isArray(cascade.updated)) {
      errors.push({
        code: "INVALID_UPDATED",
        message: "cascade.updated must be an array",
        path: "cascade.updated",
      });
    } else {
      cascade.updated.forEach((entity: unknown, i: number) => {
        if (!entity || typeof entity !== "object") return;
        const e = entity as Record<string, unknown>;
        if (!e.typename) {
          errors.push(
            missingTypename("UpdatedEntity", `cascade.updated[${i}]`, e),
          );
        }
        if (!e.id) {
          errors.push({
            code: "MISSING_ID",
            message: "UpdatedEntity must have id",
            path: `cascade.updated[${i}].id`,
          });
        }
        if (!e.operation) {
          errors.push({
            code: "MISSING_OPERATION",
            message: "UpdatedEntity must have operation",
            path: `cascade.updated[${i}].operation`,
          });
        }
        const { updatedFields } = e;
        if (
          updatedFields !== undefined &&
          updatedFields !== null &&
          !(
            Array.isArray(updatedFields) &&
            updatedFields.every((field) => typeof field === "string")
          )
        ) {
          errors.push({
            code: "INVALID_UPDATED_FIELDS",
            message:
              "UpdatedEntity.updatedFields must be null or a list of field names",
            path: `cascade.updated[${i}].updatedFields`,
          });
        }
      });
    }

    // Validate deleted array
    if (!Array.isArray(cascade.deleted)) {
      errors.push({
        code: "INVALID_DELETED",
        message: "cascade.deleted must be an array",
        path: "cascade.deleted",
      });
    } else {
      cascade.deleted.forEach((entity: unknown, i: number) => {
        if (!entity || typeof entity !== "object") return;
        const e = entity as Record<string, unknown>;
        if (!e.typename) {
          errors.push(
            missingTypename("DeletedEntity", `cascade.deleted[${i}]`, e),
          );
        }
        if (!e.id) {
          errors.push({
            code: "MISSING_ID",
            message: "DeletedEntity must have id",
            path: `cascade.deleted[${i}].id`,
          });
        }
      });
    }

    // Validate invalidations array
    if (!Array.isArray(cascade.invalidations)) {
      errors.push({
        code: "INVALID_INVALIDATIONS",
        message: "cascade.invalidations must be an array",
        path: "cascade.invalidations",
      });
    } else {
      cascade.invalidations.forEach((inv: unknown, i: number) => {
        if (!inv || typeof inv !== "object") return;
        errors.push(
          ...validateQueryInvalidation(
            inv as Record<string, unknown>,
            `cascade.invalidations[${i}]`,
          ),
        );
      });
    }

    errors.push(...validateTypeInvalidations(cascade));

    // Validate metadata
    if (!cascade.metadata || typeof cascade.metadata !== "object") {
      errors.push({
        code: "MISSING_METADATA",
        message: "cascade must have metadata",
        path: "cascade.metadata",
      });
    } else {
      const meta = cascade.metadata as Record<string, unknown>;
      if (meta.timestamp === undefined || meta.timestamp === null) {
        errors.push({
          code: "MISSING_TIMESTAMP",
          message: "metadata must have timestamp",
          path: "cascade.metadata.timestamp",
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
