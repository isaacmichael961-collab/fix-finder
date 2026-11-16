const router = require("express").Router();
const { auth, allowRoles } = require("../middleware/auth");

router.post("/", auth, allowRoles("customer"), async (req, res, next) => {
  try {
    const { provider_id, service_date = null, service_address, details } = req.body;
    if (!provider_id || !service_address?.trim() || !details?.trim()) return res.status(400).json({ error: "Choose a handyman and provide the service address and job details." });
    const provider = await req.app.locals.pool.query("SELECT id FROM providers WHERE id=$1 AND approval_status='approved'", [provider_id]);
    if (!provider.rows[0]) return res.status(404).json({ error: "That handyman is not available for booking." });
    const result = await req.app.locals.pool.query(
      "INSERT INTO bookings(customer_id,provider_id,service_date,service_address,details) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [req.user.id, provider_id, service_date || null, service_address.trim(), details.trim()]
    );
    res.status(201).json({ booking: result.rows[0] });
  } catch (err) { next(err); }
});

router.get("/mine", auth, async (req, res, next) => {
  try {
    let result;
    if (req.user.role === "customer") {
      result = await req.app.locals.pool.query(`
        SELECT b.*,p.display_name,p.category,p.user_id AS provider_user_id
        FROM bookings b JOIN providers p ON p.id=b.provider_id
        WHERE b.customer_id=$1 ORDER BY b.created_at DESC`, [req.user.id]);
    } else if (req.user.role === "handyman") {
      result = await req.app.locals.pool.query(`
        SELECT b.*,p.display_name,p.category,u.name AS customer_name,u.id AS customer_user_id
        FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN users u ON u.id=b.customer_id
        WHERE p.user_id=$1 ORDER BY b.created_at DESC`, [req.user.id]);
    } else {
      result = await req.app.locals.pool.query(`
        SELECT b.*,p.display_name,p.category,u.name AS customer_name
        FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN users u ON u.id=b.customer_id
        ORDER BY b.created_at DESC LIMIT 200`);
    }
    res.json({ bookings: result.rows });
  } catch (err) { next(err); }
});

router.patch("/:id/status", auth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined", "completed", "cancelled"].includes(status)) return res.status(400).json({ error: "Invalid booking status." });
    const check = await req.app.locals.pool.query(`
      SELECT b.*,p.user_id AS provider_user_id FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=$1`, [req.params.id]);
    const booking = check.rows[0];
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    const isAdmin = req.user.role === "admin";
    const isProvider = req.user.role === "handyman" && booking.provider_user_id === req.user.id;
    const isCustomerCancel = req.user.role === "customer" && booking.customer_id === req.user.id && status === "cancelled";
    if (!isAdmin && !isProvider && !isCustomerCancel) return res.status(403).json({ error: "You cannot change this booking." });
    const result = await req.app.locals.pool.query("UPDATE bookings SET status=$1 WHERE id=$2 RETURNING *", [status, req.params.id]);
    res.json({ booking: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
