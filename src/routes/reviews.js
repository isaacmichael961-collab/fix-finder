const router = require("express").Router();
const { auth, allowRoles } = require("../middleware/auth");

router.post("/", auth, allowRoles("customer"), async (req, res, next) => {
  try {
    const { booking_id, rating, comment = "" } = req.body;
    const score = Number(rating);
    if (!booking_id || !Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: "Choose a rating from 1 to 5." });
    const result = await req.app.locals.pool.query(`
      INSERT INTO reviews(booking_id,customer_id,provider_id,rating,comment)
      SELECT b.id,b.customer_id,b.provider_id,$3,$4 FROM bookings b
      WHERE b.id=$1 AND b.customer_id=$2 AND b.status='completed'
      RETURNING *`, [booking_id, req.user.id, score, String(comment).slice(0,2000)]);
    if (!result.rows[0]) return res.status(400).json({ error: "You can review only a completed booking you made." });
    res.status(201).json({ review: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "You have already reviewed this booking." });
    next(err);
  }
});

router.get("/provider/:providerId", async (req, res, next) => {
  try {
    const result = await req.app.locals.pool.query(`
      SELECT r.id,r.rating,r.comment,r.created_at,u.name AS customer_name
      FROM reviews r JOIN users u ON u.id=r.customer_id
      WHERE r.provider_id=$1 ORDER BY r.created_at DESC`, [req.params.providerId]);
    res.json({ reviews: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
