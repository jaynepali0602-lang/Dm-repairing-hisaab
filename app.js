
(() => {
"use strict";

const $ = id => document.getElementById(id);
const url = window.DM_SUPABASE_URL;
const key = window.DM_SUPABASE_ANON_KEY;

let client = null;
let kind = "income";
let activeFilter = "all";
let records = [];
let loading = false;

const today = (() => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
})();

const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", {
  maximumFractionDigits: 2
});

function msg(id, value) {
  const el = $(id);
  if (el) el.textContent = value || "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function showAuth() {
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
}

async function showApp() {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  await loadRecords();
}

// LOGIN
async function login() {
  if (!client) {
    msg("authMsg", "Supabase connection not ready. Check config.js.");
    return;
  }

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    msg("authMsg", "Enter email and password.");
    return;
  }

  $("loginBtn").disabled = true;
  msg("authMsg", "Signing in...");

  try {
    const { error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    msg("authMsg", "Login successful!");
    await showApp();

  } catch (error) {
    msg("authMsg", error.message || "Login failed.");
  } finally {
    $("loginBtn").disabled = false;
  }
}

// LOGOUT
async function logout() {
  if (!client) return;

  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;

    records = [];
    showAuth();

  } catch (error) {
    msg("authMsg", error.message);
  }
}

// TRANSACTION TYPE
function updateKindFields() {
  const ledger = kind === "udhar" || kind === "jama";

  $("personField").classList.toggle("hidden", !ledger);
  $("itemField").classList.toggle("hidden", !ledger);

  const labels = {
    income: "Save transaction",
    expense: "Save expense",
    udhar: "Save Udhar",
    jama: "Save Jama"
  };

  $("saveBtn").innerHTML = labels[kind] + " <span>→</span>";
}

// DASHBOARD
function updateDashboard() {
  let income = 0;
  let expense = 0;
  let udhar = 0;
  let jama = 0;

  records.forEach(r => {
    const amount = Number(r.amount || 0);

    if (r.entry_date === today) {
      if (r.kind === "income") income += amount;
      if (r.kind === "expense") expense += amount;
    }

    if (r.kind === "udhar") udhar += amount;
    if (r.kind === "jama") jama += amount;
  });

  $("incomeTotal").textContent = money(income);
  $("expenseTotal").textContent = money(expense);
  $("balanceTotal").textContent = money(income - expense);
  $("udharTotal").textContent = money(udhar);
  $("jamaTotal").textContent = money(jama);
}

function kindName(value) {
  return ({
    income: "Income",
    expense: "Expense",
    udhar: "Udhar",
    jama: "Jama"
  })[value] || value;
}

// HISTORY
function renderRecords() {
  const filtered = activeFilter === "all"
    ? records
    : records.filter(r => r.kind === activeFilter);

  if (!filtered.length) {
    $("records").innerHTML =
      '<div class="empty">No transactions found.</div>';
    return;
  }

  $("records").innerHTML = filtered.map(r => {
    const positive = r.kind === "income" || r.kind === "jama";

    const date = r.entry_date
      ? new Date(r.entry_date + "T00:00:00").toLocaleDateString("en-IN")
      : "Date unavailable";

    return `
      <div class="record" data-id="${escapeHtml(r.id)}">
        <div class="record-icon ${positive ? "" : "out"}">
          ${r.kind === "income" ? "↙" :
            r.kind === "expense" ? "↗" :
            r.kind === "udhar" ? "−" : "+"}
        </div>

        <div class="record-info">
          <b>${escapeHtml(r.description)}</b>
          <small>
            ${escapeHtml(kindName(r.kind))}
            • ${escapeHtml(r.category || "Other")}
            • ${escapeHtml(date)}
          </small>

          ${r.person_name
            ? `<small>${escapeHtml(r.person_name)}</small>`
            : ""}
        </div>

        <div class="record-amount ${positive ? "in" : "out-amount"}">
          ${positive ? "+" : "−"}${money(r.amount)}
        </div>
      </div>
    `;
  }).join("");
}

// LOAD HISTORY
async function loadRecords() {
  if (!client || loading) return;

  loading = true;
  $("refreshBtn").disabled = true;

  try {
    const { data, error } = await client
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    records = data || [];

    updateDashboard();
    renderRecords();

  } catch (error) {
    $("records").innerHTML =
      `<div class="empty">Error: ${escapeHtml(error.message)}</div>`;
  } finally {
    loading = false;
    $("refreshBtn").disabled = false;
  }
}

// SAVE TRANSACTION
async function saveTransaction() {
  if (!client) {
    msg("entryMsg", "Supabase connection unavailable.");
    return;
  }

  const description = $("description").value.trim();
  const amount = Number($("amount").value);
  const date = $("entryDate").value;
  const category = $("category").value;

  const person = $("personName").value.trim();
  const item = $("itemName").value.trim();
  const paymentMode = $("paymentMode").value;
  const notes = $("notes").value.trim();

  if (!description || !Number.isFinite(amount) ||
      amount <= 0 || !date) {
    msg("entryMsg", "Enter valid description, amount and date.");
    return;
  }

  if ((kind === "udhar" || kind === "jama") && !person) {
    msg("entryMsg", "Enter person or supplier name.");
    return;
  }

  $("saveBtn").disabled = true;
  msg("entryMsg", "Saving transaction...");

  try {
    const { data: userData, error: userError } =
      await client.auth.getUser();

    if (userError) throw userError;
    if (!userData.user) throw new Error("Please login again.");

    const entry = {
      description,
      amount,
      kind,
      category,
      entry_date: date,
      user_id: userData.user.id,
      person_name: person || null,
      item_name: item || null,
      payment_mode: paymentMode,
      notes: notes || null
    };

    const { error } = await client
      .from("transactions")
      .insert(entry);

    if (error) throw error;

    msg("entryMsg", "Saved successfully!");

    $("description").value = "";
    $("amount").value = "";
    $("personName").value = "";
    $("itemName").value = "";
    $("notes").value = "";

    await loadRecords();
    toast("Transaction saved successfully!");

  } catch (error) {
    msg("entryMsg", error.message || "Saving failed.");
  } finally {
    $("saveBtn").disabled = false;
  }
}

// TRANSACTION DETAILS
function showDetails(id) {
  const r = records.find(item => String(item.id) === String(id));
  if (!r) return;

  const date = r.entry_date
    ? new Date(r.entry_date + "T00:00:00").toLocaleDateString("en-IN")
    : "Unavailable";

  const fields = [
    ["Description", r.description],
    ["Transaction type", kindName(r.kind)],
    ["Amount", money(r.amount)],
    ["Person / Supplier", r.person_name],
    ["Item / Spare", r.item_name],
    ["Category", r.category],
    ["Payment mode", r.payment_mode],
    ["Date", date],
    ["Notes", r.notes]
  ];

  $("detailContent").innerHTML = fields.map(([label, value]) => `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value || "—")}</b>
    </div>
  `).join("");

  $("detailModal").classList.remove("hidden");
}

function closeDetails() {
  $("detailModal").classList.add("hidden");
}

// START APP
function startApp() {

  // Events are attached BEFORE checking configuration.
  // This ensures the Sign in button always responds.

  $("loginBtn").addEventListener("click", login);

  $("password").addEventListener("keydown", event => {
    if (event.key === "Enter") login();
  });

  $("logoutBtn").addEventListener("click", logout);
  $("saveBtn").addEventListener("click", saveTransaction);
  $("refreshBtn").addEventListener("click", loadRecords);
  $("closeModal").addEventListener("click", closeDetails);

  $("detailModal").addEventListener("click", event => {
    if (event.target === $("detailModal")) closeDetails();
  });

  $("records").addEventListener("click", event => {
    const record = event.target.closest(".record");
    if (record) showDetails(record.dataset.id);
  });

  document.querySelectorAll(".seg").forEach(button => {
    button.addEventListener("click", () => {
      kind = button.dataset.kind;

      document.querySelectorAll(".seg").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      updateKindFields();
      msg("entryMsg", "");
    });
  });

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;

      document.querySelectorAll(".filter").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderRecords();
    });
  });

  $("entryDate").value = today;

  $("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  updateKindFields();

  if (!url || !key ||
      url.includes("PASTE_") || key.includes("PASTE_")) {

    $("setupNotice").classList.remove("hidden");
    $("loginBtn").disabled = false;
    msg("authMsg", "Check Supabase configuration in config.js.");
    return;
  }

  if (!window.supabase) {
    msg("authMsg", "Supabase library not loaded. Check internet connection.");
    return;
  }

  try {
    client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    msg("authMsg", "Connection error: " + error.message);
    return;
  }

  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;

    if (data.session) {
      showApp();
    } else {
      showAuth();
    }

  }).catch(error => {
    showAuth();
    msg("authMsg", error.message);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      records = [];
      showAuth();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .catch(() => {});
    });
  }
}

startApp();

})();
      
