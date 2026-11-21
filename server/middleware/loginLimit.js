const rateLimit = require("express-rate-limit");

const loginLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    message: "Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 1 minuto.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = loginLimit;
