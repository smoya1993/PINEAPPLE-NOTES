const express = require("express");
const router = express.Router();
const noteController = require("../controllers/noteController");
const verifyJwt = require("../middleware/verifyJwt");

router.use(verifyJwt);

router.get("/", noteController.getNotes);
router.get("/:id", noteController.getNoteById);
router.post("/", noteController.createNote);
router.put("/:id", noteController.updateNote);
router.patch("/:id/favorite", noteController.toggleFavorite);
router.delete("/:id", noteController.deleteNote);

module.exports = router;
