const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("fixfinder_token") || "";
let currentUser = JSON.parse(localStorage.getItem("fixfinder_user") || "null");
let authMode = "register";
let toastTimer;

$("year").textContent = new Date().getFullYear();

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3300);
}
function headers() {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
const API_BASE_URL = "https://fix-finder-x45o.onrender.com";

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed. Please try again.");
  }

  return data;
}
function openAuth(mode = "register", role = "customer") {
  authMode = mode;
  $("authTitle").textContent = mode === "login" ? "Welcome back." : "Let's get you started.";
  $("authEyebrow").textContent = mode === "login" ? "GOOD TO SEE YOU AGAIN" : "WELCOME TO FIXFINDER";
  $("authSub").textContent = mode === "login" ? "Log in to continue to your account." : "Create your account to connect with your local community.";
  $("nameField").hidden = mode === "login";
  $("roleField").hidden = mode === "login";
  $("role").value = role;
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authSubmit").textContent = mode === "login" ? "Log in →" : "Create account →";
  $("switchText").textContent = mode === "login" ? "New to FixFinder?" : "Already have an account?";
  $("switchAuth").textContent = mode === "login" ? "Create account" : "Log in";
  $("authMessage").textContent = "";
  $("authDialog").showModal();
}
function logout() {
  token = ""; currentUser = null;
  localStorage.removeItem("fixfinder_token"); localStorage.removeItem("fixfinder_user");
  notify("You have been logged out.");
}
$("loginOpen").addEventListener("click", () => openAuth("login"));
$("registerOpen").addEventListener("click", () => openAuth("register"));
$("handymanJoin").addEventListener("click", () => openAuth("register", "handyman"));
$("modalClose").addEventListener("click", () => $("authDialog").close());
$("bookingClose").addEventListener("click", () => $("bookingDialog").close());
$("switchAuth").addEventListener("click", () => openAuth(authMode === "login" ? "register" : "login", $("role").value));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("authMessage").textContent = "";
  const payload = { email: $("email").value, password: $("password").value };
  if (authMode === "register") {
    payload.name = $("name").value;
    payload.role = $("role").value;
  }
  try {
    const result = await api(`/auth/${authMode}`, { method: "POST", body: JSON.stringify(payload) });
    token = result.token; currentUser = result.user;
    localStorage.setItem("fixfinder_token", token);
    localStorage.setItem("fixfinder_user", JSON.stringify(currentUser));
    $("authDialog").close();
    notify(`Welcome${currentUser.name ? `, ${currentUser.name}` : ""}!`);
    if (currentUser.role === "handyman" && authMode === "register") {
      showHandymanApplication();
    } else {
      updateAccountButton();
    }
  } catch (error) { $("authMessage").textContent = error.message; }
});

function updateAccountButton() {
  if (!currentUser) return;
  $("loginOpen").textContent = currentUser.name.split(" ")[0];
  $("loginOpen").onclick = () => {
    if (confirm(`Signed in as ${currentUser.name} (${currentUser.role}). Log out?`)) logout();
  };
  $("registerOpen").textContent = "My bookings";
  $("registerOpen").onclick = async () => {
    if (!token) return openAuth("login");
    try {
      const result = await api("/bookings/mine");
      const lines = result.bookings.map(b => `#${b.id} · ${b.display_name || b.category} · ${b.status}`).join("\n");
      alert(lines || "You don't have any bookings yet.");
    } catch (e) { notify(e.message); }
  };
}
function showHandymanApplication() {
  const category = prompt("What service do you offer? (e.g. Electrician, Plumber)");
  if (!category) { notify("You can complete your handyman profile later."); return; }
  const area = prompt("What area do you serve? (e.g. Wuse, Abuja)");
  if (!area) { notify("You can complete your handyman profile later."); return; }
  const phone = prompt("Phone number (optional)") || "";
  const price = prompt("Starting price in NGN (enter a number, or 0 if negotiable)") || "0";
  api("/providers/apply", { method: "POST", body: JSON.stringify({
    display_name: currentUser.name, category, service_area: area, phone, price_from: Number(price)
  })}).then(() => notify("Application submitted! It will appear publicly after admin approval."))
    .catch(e => notify(e.message));
  updateAccountButton();
}

async function searchProviders() {
  const search = $("searchInput").value.trim();
  const area = $("areaInput").value.trim();
  const container = $("providerResults");
  container.innerHTML = '<div class="empty-state">Finding available professionals…</div>';
  try {
    const params = new URLSearchParams({ search, area });
    const result = await api(`/providers?${params}`);
    renderProviders(result.providers);
    $("pros").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch]));
}
function renderProviders(providers) {
  const container = $("providerResults");
  if (!providers.length) {
    container.innerHTML = '<div class="empty-state">No approved professionals found for that search yet. Try another service or area, or check back soon.</div>';
    return;
  }
  container.innerHTML = providers.map(p => `
    <article class="provider-card">
      <div class="provider-top"><div class="provider-avatar">${escapeHtml((p.display_name || "?").charAt(0).toUpperCase())}</div>
        <div><h3>${escapeHtml(p.display_name)}</h3><div class="sub">${escapeHtml(p.category)} · ${escapeHtml(p.service_area)}</div></div>
        ${p.verified ? '<span class="verified">✓ Verified</span>' : ''}
      </div>
      <div class="provider-description">${escapeHtml(p.description || "Local professional ready to discuss your job.")}</div>
      <div class="provider-meta"><span>★ ${Number(p.average_rating).toFixed(1)} <span style="color:#858980">(${p.review_count} reviews)</span></span><span>From <strong>₦${Number(p.price_from).toLocaleString("en-NG")}</strong></span></div>
      <div class="provider-actions"><button class="btn btn-dark" onclick="startBooking(${p.id})">Request service ↗</button><button class="btn btn-quiet" onclick="showReviews(${p.id})">Reviews</button></div>
    </article>`).join("");
}
$("searchButton").addEventListener("click", searchProviders);
$("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") searchProviders(); });
$("areaInput").addEventListener("keydown", e => { if (e.key === "Enter") searchProviders(); });
document.querySelectorAll(".category-card").forEach(card => card.addEventListener("click", () => {
  $("searchInput").value = card.dataset.category;
  searchProviders();
}));

window.startBooking = (providerId) => {
  if (!currentUser || !token) { openAuth("login"); notify("Log in as a customer to request a service."); return; }
  if (currentUser.role !== "customer") { notify("Only customer accounts can create bookings."); return; }
  $("bookingProviderId").value = providerId;
  $("bookingMessage").textContent = "";
  $("bookingDialog").showModal();
};
$("bookingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/bookings", { method: "POST", body: JSON.stringify({
      provider_id: Number($("bookingProviderId").value),
      service_date: $("serviceDate").value || null,
      service_address: $("serviceAddress").value,
      details: $("jobDetails").value
    })});
    $("bookingDialog").close();
    $("bookingForm").reset();
    notify(`Booking request #${result.booking.id} sent!`);
  } catch (error) { $("bookingMessage").textContent = error.message; }
});
window.showReviews = async (providerId) => {
  try {
    const result = await api(`/reviews/provider/${providerId}`);
    const lines = result.reviews.map(r => `★ ${r.rating}/5 — ${r.customer_name}: ${r.comment || "(no comment)"}`).join("\n\n");
    alert(lines || "No reviews yet.");
  } catch (error) { notify(error.message); }
};

if (currentUser && token) updateAccountButton();
