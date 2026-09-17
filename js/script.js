/* =========================================================
   NOVA TOPUP — Shared JavaScript
   Handles: mobile nav toggle, live game search/filter,
   login form validation, dynamic footer year.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });

    // Close mobile menu after clicking a link
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
      });
    });
  }

  /* ---------- Game search / filter ---------- */
  var searchInput = document.getElementById("gameSearch");
  var gamesGrid = document.getElementById("gamesGrid");
  var resultCount = document.getElementById("resultCount");
  var emptyState = document.getElementById("emptyState");

  if (searchInput && gamesGrid) {
    var cards = Array.prototype.slice.call(gamesGrid.querySelectorAll(".game-card"));

    function filterGames() {
      var query = searchInput.value.trim().toLowerCase();
      var visibleCount = 0;

      cards.forEach(function (card) {
        var haystack = card.getAttribute("data-name") || "";
        var isMatch = haystack.indexOf(query) !== -1;
        card.style.display = isMatch ? "" : "none";
        if (isMatch) visibleCount++;
      });

      if (resultCount) {
        resultCount.textContent = visibleCount + (visibleCount === 1 ? " game available" : " games available");
      }

      if (emptyState) {
        emptyState.classList.toggle("show", visibleCount === 0);
      }
    }

    searchInput.addEventListener("input", filterGames);
  }

  /* ---------- Top Up button demo action ---------- */
  document.querySelectorAll(".topup-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".game-card");
      var gameTitle = card ? card.querySelector(".game-title").textContent : "this game";
      btn.textContent = "Added ✓";
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = "Top Up";
        btn.disabled = false;
      }, 1500);
      console.log("Top-up requested for: " + gameTitle);
    });
  });

  /* ---------- Login form validation ---------- */
  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    var emailField = document.getElementById("emailField");
    var passwordField = document.getElementById("passwordField");
    var emailInput = document.getElementById("email");
    var passwordInput = document.getElementById("password");
    var formStatus = document.getElementById("formStatus");

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var valid = true;

      if (!isValidEmail(emailInput.value.trim())) {
        emailField.classList.add("invalid");
        valid = false;
      } else {
        emailField.classList.remove("invalid");
      }

      if (passwordInput.value.length < 6) {
        passwordField.classList.add("invalid");
        valid = false;
      } else {
        passwordField.classList.remove("invalid");
      }

      if (valid) {
        formStatus.classList.add("show");
        loginForm.reset();
        // In a real app this would call an authentication API.
        // Here we simply simulate a short delay before returning home.
        setTimeout(function () {
          window.location.href = "home.html";
        }, 1200);
      }
    });

    // Clear error state as the user types
    [emailInput, passwordInput].forEach(function (input) {
      input.addEventListener("input", function () {
        input.closest(".field").classList.remove("invalid");
      });
    });
  }

});
