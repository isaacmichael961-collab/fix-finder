const router = require("express").Router();
const { auth, allowRoles } = require("../middleware/auth");

router.get("/", async (req, res, next) => {
  try {
    const { search = "", category = "", area = "" } = req.query;
    const result = await req.app.locals.pool.query(`
      SELECT p.id,p.display_name,p.category,p.description,p.service_area,p.phone,p.price_from,
             p.available,p.verified,p.approval_status,
             COALESCE(ROUND(AVG(r.rating)::numeric,1),0) AS average_rating,
             COUNT(r.id)::int AS review_count
      FROM providers p
      LEFT JOIN reviews r ON r.provider_id=p.id
      WHERE p.approval_status='approved'
        AND ($1='' OR p.display_name ILIKE '%'||$1||'%' OR p.category ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%')
        AND ($2='' OR p.category ILIKE '%'||$2||'%')
        AND ($3='' OR p.service_area ILIKE '%'||$3||'%')
      GROUP BY p.id
      ORDER BY p.verified DESC, average_rating DESC, p.created_at DESC
      LIMIT 100
    `, [search, category, area]);
    res.json({ providers: result.rows });
  } catch (err) { next(err); }
});

// Handymen create or update their own profile; it remains pending until approved by admin.
router.post("/apply", auth, allowRoles("handyman"), async (req, res, next) => {
  try {
    const { display_name, category, description = "", service_area, phone = "", price_from = 0 } = req.body;
    if (!display_name?.trim() || !category?.trim() || !service_area?.trim()) {
      return res.status(400).json({ error: "Name, service category and service area are required." });
    }
    const result = await req.app.locals.pool.query(`
      INSERT INTO providers(user_id,display_name,category,description,service_area,phone,price_from,approval_status,verified)
      VALUES($1,$2,$3,$4,$5,$6,$7,'pending',false)
      ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name, category=EXCLUDED.category,
        description=EXCLUDED.description, service_area=EXCLUDED.service_area, phone=EXCLUDED.phone,
        price_from=EXCLUDED.price_from, approval_status='pending', verified=false
      RETURNING *
    `, [req.user.id, display_name.trim(), category.trim(), description, service_area.trim(), phone, Math.max(0, Number(price_from) || 0)]);
    res.status(201).json({ provider: result.rows[0], message: "Application saved. An administrator must approve it before it appears publicly." });
  } catch (err) { next(err); }
});

// Admin-only manual provider creation and provider approval.
router.post("/admin", auth, allowRoles("admin"), async (req, res, next) => {
  try {
    const { display_name, category, description = "", service_area, phone = "", price_from = 0, user_id = null, verified = false } = req.body;
    if (!display_name?.trim() || !category?.trim() || !service_area?.trim()) return res.status(400).json({ error: "Name, category and service area are required." });
    const result = await req.app.locals.pool.query(`
      INSERT INTO providers(user_id,display_name,category,description,service_area,phone,price_from,approval_status,verified)
      VALUES($1,$2,$3,$4,$5,$6,$7,'approved',$8) RETURNING *
    `, [user_id, display_name.trim(), category.trim(), description, service_area.trim(), phone, Math.max(0, Number(price_from) || 0), Boolean(verified)]);
    res.status(201).json({ provider: result.rows[0] });
  } catch (err) { next(err); }
});

router.get("/admin/pending", auth, allowRoles("admin"), async (req, res, next) => {
  try {
    const result = await req.app.locals.pool.query(
      "SELECT p.*,u.email FROM providers p LEFT JOIN users u ON u.id=p.user_id WHERE p.approval_status='pending' ORDER BY p.created_at ASC"
    );
    res.json({ providers: result.rows });
  } catch (err) { next(err); }
});

router.patch("/admin/:id/approval", auth, allowRoles("admin"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be approved or rejected." });
    const result = await req.app.locals.pool.query(
      "UPDATE providers SET approval_status=$1,verified=$2 WHERE id=$3 RETURNING *",
      [status, status === "approved", req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Provider not found." });
    res.json({ provider: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
