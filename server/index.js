require("dotenv").config();
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const express = require("express");
const errorHandler = require("./middleware/errorHandler");
const credentials = require("./middleware/credentials");
const cookieParser = require("cookie-parser");
const connectDB = require("./db/conn");

const app = express();
const port = process.env.PORT || 8085;

// Confiar en proxies y balanceadores de carga (Nginx / Docker / Render)
app.set("trust proxy", 1);

// CORS & cookies
app.use(credentials);
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "pineapple-notes-backend" });
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/workspace", require("./routes/workspaceRoutes"));
app.use("/api/notes", require("./routes/noteRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/meetings", require("./routes/meetingRoutes"));
app.use("/api/images", require("./routes/imageRoutes"));

app.use(errorHandler);

connectDB()
  .then(() => {
    console.log("Connected to PostgreSQL");
    app.listen(port, () => console.log(`🍍 Pineapple Notes API running on port ${port}`));
  })
  .catch((err) => {
    console.error("Error connecting to PostgreSQL:", err);
    process.exit(1);
  });
