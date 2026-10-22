/**
 * Error responses share one shape: `{ error, code }`, where `error` is a
 * human-readable message and `code` is a stable machine-readable identifier.
 */
export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_DCA_ID: "INVALID_DCA_ID",
  INVALID_LIMIT: "INVALID_LIMIT",
  NOT_FOUND: "NOT_FOUND",
  DCA_NOT_FOUND: "DCA_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_CONFIG: "INVALID_CONFIG",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

export function sendError(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/** Handler for requests that matched no route; always JSON. */
export function notFoundHandler(req, res) {
  return sendError(res, 404, ErrorCode.NOT_FOUND, "Route not found.");
}

/**
 * Final error handler. Client errors raised by middleware (for example a
 * malformed JSON body) keep their 4xx status; everything else is a 500 whose
 * body never contains the internal error text, which is only logged.
 */
export function createErrorHandler(log) {
  // Express identifies error handlers by their four-argument signature.
  // eslint-disable-next-line no-unused-vars
  return (err, _req, res, _next) => {
    const status = Number(err?.status ?? err?.statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      log.warn({ err: err.message, status }, "request rejected");
      const code = status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.BAD_REQUEST;
      const message = status === 404 ? "Route not found." : "Bad request.";
      return sendError(res, status, code, message);
    }
    log.error({ err: err?.message });
    return sendError(res, 500, ErrorCode.INTERNAL_ERROR, "internal server error");
  };
}
