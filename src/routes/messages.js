const router = require("express").Router();
const { auth } = require("../middleware/auth");

router.get("/:bookingId", auth, async (req, res, next) => {
  try {
    const access = await req.app.locals.pool.query(`
      SELECT b.customer_id,p.user_id AS provider_user_id
      FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=$1`, [req.params.bookingId]);
    const row = access.rows[0];
    if (!row) return res.status(404).json({ error: "Booking not found." });
    if (req.user.role !== "admin" && req.user.id !== row.customer_id && req.user.id !== row.provider_user_id) {
      return res.status(403).json({ error: "You don't have access to this conversation." });
    }
    const result = await req.app.locals.pool.query(`
      SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.booking_id=$1 ORDER BY m.created_at ASC`, [req.params.bookingId]);
    res.json({ messages: result.rows });
  } catch (err) { next(err); }
});

router.post("/", auth, async (req, res, next) => {
  try {
    const { booking_id, body } = req.body;
    if (!booking_id || !body?.trim()) return res.status(400).json({ error: "Booking and message are required." });
    const access = await req.app.locals.pool.query(`
      SELECT b.customer_id,p.user_id AS provider_user_id
      FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=$1`, [booking_id]);
    const row = access.rows[0];
    if (!row) return res.status(404).json({ error: "Booking not found." });
    if (req.user.id !== row.customer_id && req.user.id !== row.provider_user_id && req.user.role !== "admin") {
      return res.status(403).json({ error: "You don't have access to this conversation." });
    }
    const recipient = req.user.id === row.customer_id ? row.provider_user_id : row.customer_id;
    if (!recipient) return res.status(400).json({ error: "This provider has no linked account for in-app messaging." });
    const result = await req.app.locals.pool.query(
      "INSERT INTO messages(booking_id,sender_id,recipient_id,body) VALUES($1,$2,$3,$4) RETURNING *",
      [booking_id, req.user.id, recipient, body.trim()]
    );
    res.status(201).json({ message: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
