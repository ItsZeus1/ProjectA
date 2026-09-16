/* ============================================================
   GAME DATA
   ============================================================ */
const GAMES = [
  { name: "Fortnite",         category: "PC / Console", type: "pc",     currency: "V-Bucks",         from: "$4.99",  sale: false, gradient: "linear-gradient(150deg,#4B2AAD,#8C3FE0)" },
  { name: "PUBG Mobile",      category: "Mobile",       type: "mobile", currency: "UC",               from: "$1.99",  sale: true,  gradient: "linear-gradient(150deg,#B58500,#F2B705)" },
  { name: "Free Fire",        category: "Mobile",       type: "mobile", currency: "Diamonds",         from: "$0.99",  sale: true,  gradient: "linear-gradient(150deg,#8A1E1E,#E0473F)" },
  { name: "Mobile Legends",   category: "Mobile",       type: "mobile", currency: "Diamonds",         from: "$1.49",  sale: false, gradient: "linear-gradient(150deg,#0F3D66,#1F8FCB)" },
  { name: "Call of Duty: Mobile", category: "Mobile",   type: "mobile", currency: "CP",               from: "$2.49",  sale: false, gradient: "linear-gradient(150deg,#242424,#5C6B21)" },
  { name: "Genshin Impact",   category: "PC / Console", type: "pc",     currency: "Genesis Crystals",  from: "$0.99",  sale: false, gradient: "linear-gradient(150deg,#1E5C8A,#63B7D9)" },
  { name: "Valorant",         category: "PC / Console", type: "pc",     currency: "VP",               from: "$4.49",  sale: false, gradient: "linear-gradient(150deg,#7A0F1F,#D9273F)" },
  { name: "Roblox",           category: "PC / Console", type: "pc",     currency: "Robux",            from: "$1.99",  sale: false, gradient: "linear-gradient(150deg,#1F2937,#4B5563)" },
];

/* ============================================================
   RENDER GAME GRID (index.html only)
   ============================================================ */
const gameGrid = document.getElementById("gameGrid");

function renderGames(filter = "all", query = "") {
  if (!gameGrid) return;
  gameGrid.innerHTML = "";

  const q = query.trim().toLowerCase();
  const filtered = GAMES.filter(g => {
    const matchesFilter = filter === "all" || g.type === filter;
    const matchesQuery = !q || g.name.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  if (filtered.length === 0) {
    gameGrid.innerHTML = `<div class="col-12"><p class="tf-small text-center py-5">No games match "${escapeHtml(query)}". Try another search.</p></div>`;
    return;
  }

  filtered.forEach(g => {
    const col = document.createElement("div");
    col.className = "col-lg-3 col-md-4 col-6";
    col.innerHTML = `
      <div class="tf-game-card">
        <div class="tf-game-art" style="background:${g.gradient}">
          ${g.sale ? '<span class="tf-game-badge">SALE</span>' : ""}
          <span class="tf-game-art-title">${escapeHtml(g.name)}</span>
        </div>
        <div class="tf-game-body">
          <span class="tf-game-cat">${g.category} · ${g.currency}</span>
          <span class="tf-game-from">Top up from <b>${g.from}</b></span>
          <button type="button" class="btn tf-btn-accent w-100 mt-1 tf-topup-btn">Top up</button>
        </div>
      </div>`;
    gameGrid.appendChild(col);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

if (gameGrid) {
  renderGames();

  // filter buttons
  document.querySelectorAll(".tf-filter [data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tf-filter [data-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const search = document.getElementById("gameSearch");
      renderGames(btn.dataset.filter, search ? search.value : "");
    });
  });

  // search box
  const searchInput = document.getElementById("gameSearch");
  const searchForm = searchInput ? searchInput.closest("form") : null;
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const activeFilter = document.querySelector(".tf-filter .active");
      renderGames(activeFilter ? activeFilter.dataset.filter : "all", searchInput.value);
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const activeFilter = document.querySelector(".tf-filter .active");
      renderGames(activeFilter ? activeFilter.dataset.filter : "all", searchInput.value);
    });
  }

  // clicking a top-up button sends the user to log in first
  gameGrid.addEventListener("click", (e) => {
    if (e.target.classList.contains("tf-topup-btn")) {
      window.location.href = "login.html";
    }
  });
}

/* ============================================================
   AUTH PAGE (login.html only)
   ============================================================ */

// Tab switching triggered by "Sign up" / "Log in" text links
document.querySelectorAll("[data-switch-to]").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetTab = document.getElementById(link.dataset.switchTo);
    if (targetTab && window.bootstrap) {
      new bootstrap.Tab(targetTab).show();
    }
  });
});

// Method toggle: phone vs email, scoped per form (login / signup)
document.querySelectorAll(".tf-method-toggle").forEach(group => {
  const method = group.querySelectorAll("[data-method]")[0]?.dataset.method;
  const pane = method === "login" ? document.getElementById("login-pane") : document.getElementById("signup-pane");
  if (!pane) return;

  group.querySelectorAll("button[data-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      group.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.target; // "phone" or "email"
      pane.querySelectorAll(".tf-field-group[data-field]").forEach(field => {
        field.classList.toggle("d-none", field.dataset.field !== target);
      });
    });
  });
});

// Show/hide password
document.querySelectorAll(".tf-toggle-pw").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = btn.previousElementSibling;
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "Hide" : "Show";
  });
});

// Password strength meter (signup only)
const signupPassword = document.getElementById("signupPassword");
const strengthMeter = document.querySelector(".tf-pw-strength");
if (signupPassword && strengthMeter) {
  signupPassword.addEventListener("input", () => {
    const val = signupPassword.value;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val) && val.length >= 10) score++;

    strengthMeter.classList.remove("weak", "medium", "strong");
    if (val.length === 0) return;
    if (score <= 1) strengthMeter.classList.add("weak");
    else if (score === 2) strengthMeter.classList.add("medium");
    else strengthMeter.classList.add("strong");
  });
}

// Simple validation helper: which identifier field is currently visible
function getActiveIdentifierInput(pane) {
  const visibleGroup = pane.querySelector(".tf-field-group:not(.d-none)");
  return visibleGroup ? visibleGroup.querySelector("input") : null;
}

function validateField(input, testFn) {
  if (!input) return true;
  const ok = testFn(input.value.trim());
  input.classList.toggle("is-invalid", !ok);
  return ok;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9\s-]{6,15}$/;

// LOGIN FORM
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pane = document.getElementById("login-pane");
    const identifierInput = getActiveIdentifierInput(pane);
    const isEmailField = identifierInput && identifierInput.type === "email";

    const identifierOk = validateField(identifierInput, v =>
      isEmailField ? emailPattern.test(v) : phonePattern.test(v)
    );
    const passwordInput = document.getElementById("loginPassword");
    const passwordOk = validateField(passwordInput, v => v.length >= 8);

    const alertBox = document.getElementById("loginAlert");
    if (identifierOk && passwordOk) {
      alertBox.classList.remove("d-none");
      loginForm.querySelectorAll("input").forEach(i => i.disabled = true);
      loginForm.querySelector("button[type=submit]").disabled = true;
    } else {
      alertBox.classList.add("d-none");
    }
  });
}

// SIGNUP FORM
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pane = document.getElementById("signup-pane");
    const identifierInput = getActiveIdentifierInput(pane);
    const isEmailField = identifierInput && identifierInput.type === "email";

    const nameInput = document.getElementById("signupName");
    const nameOk = validateField(nameInput, v => v.length >= 2);

    const identifierOk = validateField(identifierInput, v =>
      isEmailField ? emailPattern.test(v) : phonePattern.test(v)
    );

    const passwordInput = document.getElementById("signupPassword");
    const passwordOk = validateField(passwordInput, v => v.length >= 8);

    const termsInput = document.getElementById("agreeTerms");
    const termsOk = termsInput.checked;
    termsInput.classList.toggle("is-invalid", !termsOk);

    const alertBox = document.getElementById("signupAlert");
    if (nameOk && identifierOk && passwordOk && termsOk) {
      alertBox.classList.remove("d-none");
      signupForm.querySelectorAll("input").forEach(i => i.disabled = true);
      signupForm.querySelector("button[type=submit]").disabled = true;
    } else {
      alertBox.classList.add("d-none");
    }
  });
}

// If arriving via #signup anchor, open the sign-up tab automatically
if (window.location.hash === "#signup") {
  const signupTab = document.getElementById("signup-tab");
  window.addEventListener("DOMContentLoaded", () => {
    if (signupTab && window.bootstrap) new bootstrap.Tab(signupTab).show();
  });
}
