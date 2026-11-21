const express = require("express");
const multer = require("multer");
const router = express.Router();
const imageController = require("../controllers/imageController");
const verifyJwt = require("../middleware/verifyJwt");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"));
    }
  },
});

// GET is public by unguessable UUID so <img src="/api/images/:id"> renders natively without custom headers
router.get("/:id", imageController.getImage);
router.post("/", verifyJwt, upload.single("image"), imageController.uploadImage);

module.exports = router;
