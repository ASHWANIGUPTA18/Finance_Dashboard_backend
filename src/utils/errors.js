class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function notFound(msg = 'Resource not found') {
  return new AppError(msg, 404);
}

function forbidden(msg = 'Access denied') {
  return new AppError(msg, 403);
}

function badRequest(msg = 'Bad request') {
  return new AppError(msg, 400);
}

function unauthorized(msg = 'Unauthorized') {
  return new AppError(msg, 401);
}

module.exports = { AppError, notFound, forbidden, badRequest, unauthorized };
