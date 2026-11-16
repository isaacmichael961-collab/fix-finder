const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { auth } = require("../middleware/auth");

function tokenFor(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role = "customer" } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 8) return res.status(400).json({ error: "Use a password with at least 8 characters." });
    // Public registration can never create an administrator account.
    if (!["customer", "handyman"].includes(role)) return res.status(400).json({ error: "Choose customer or handyman." });
    const hash = await bcrypt.hash(password, 12);
    const result = await req.app.locals.pool.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role",
      [name.trim(), email.trim().toLowerCase(), hash, role]
    );
    const user = result.rows[0];
    res.status(201).json({ token: tokenFor(user), user });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await req.app.locals.pool.query(
      "SELECT id,name,email,password_hash,role FROM users WHERE email=$1",
      [String(email || "").trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ token: tokenFor(safeUser), user: safeUser });
  } catch (err) { next(err); }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const result = await req.app.locals.pool.query(
      "SELECT id,name,email,role,created_at FROM users WHERE id=$1", [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Account not found." });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
