const express = require("express");
const router = express.Router();
const workspaceController = require("../controllers/workspaceController");
const verifyJwt = require("../middleware/verifyJwt");

router.use(verifyJwt);

router.get("/", workspaceController.getWorkspace);
router.put("/", workspaceController.syncWorkspace);

module.exports = router;
