require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.locals.pool = pool;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("DATABASE CONNECTION ERROR:", error.message);
    res.status(503).json({
      ok: false,
      database: "disconnected",
      error: error.message
    });
  }
});

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/providers", require("./src/routes/providers"));
app.use("/api/bookings", require("./src/routes/bookings"));
app.use("/api/messages", require("./src/routes/messages"));
app.use("/api/reviews", require("./src/routes/reviews"));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FixFinder running at http://localhost:${port}`));
