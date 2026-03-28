export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  EMAIL_TAKEN: () => new AppError('EMAIL_TAKEN', 'Email is already in use', 409),
  USERNAME_TAKEN: () => new AppError('USERNAME_TAKEN', 'Username is already in use', 409),
  INVALID_CREDENTIALS: () => new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401),
  INVALID_TOKEN: () => new AppError('INVALID_TOKEN', 'Invalid or expired token', 401),
  UNAUTHORIZED: () => new AppError('UNAUTHORIZED', 'Authentication required', 401),
  NOT_FOUND: (resource: string) => new AppError('NOT_FOUND', `${resource} not found`, 404),
  FORBIDDEN: () => new AppError('FORBIDDEN', 'You do not have permission to perform this action', 403),
  VALIDATION_ERROR: (details: unknown) => new AppError('VALIDATION_ERROR', 'Validation failed', 400, details),
  INTERNAL: () => new AppError('INTERNAL_ERROR', 'An unexpected error occurred', 500),
}
