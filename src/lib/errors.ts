export class DomainError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code: string, status = 400, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} with ID "${id}" was not found.` : `${entity} was not found.`,
      "ENTITY_NOT_FOUND",
      404
    );
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, "VALIDATION_ERROR", 422, details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class AmountExceedsTotalError extends DomainError {
  constructor(message = "Payment amount exceeds the total pending amount") {
    super(message, "AMOUNT_EXCEEDS_TOTAL", 400);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, code = "BUSINESS_RULE_VIOLATION") {
    super(message, code, 400);
  }
}
