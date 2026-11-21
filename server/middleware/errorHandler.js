const errorHandler = (err, req, res, next) => {
  const status = err.status || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  const message = err.message || "Internal server error";

  if (status >= 500) {
    console.error("[ERROR]", err);
  }

  return res.status(status).json({
    message,
    isError: true,
  });
};

module.exports = errorHandler;
