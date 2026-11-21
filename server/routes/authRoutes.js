const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const loginLimit = require("../middleware/loginLimit");
const verifyJwt = require("../middleware/verifyJwt");

router.post("/register", authController.register);
router.post("/login", loginLimit, authController.login);
router.get("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);
router.get("/me", verifyJwt, authController.me);

module.exports = router;
