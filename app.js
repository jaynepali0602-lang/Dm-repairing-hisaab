
(() => {
"use strict";

const $ = id => document.getElementById(id);

const url = window.DM_SUPABASE_URL;
const key = window.DM_SUPABASE_ANON_KEY;

let client = null;
let kind = "income";
let filter = "all";
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

function msg(id, text) {
  $(id).textContent = text || "";
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

function toast(text) {
  const el = $("toast");
  el.textContent = text;
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

function getPayments(id) {
  return records.filter(r =>
    String(r.parent_id || "") === String(id)
  );
}

function getRemaining(record) {
  const paid = getPayments(record.id).reduce(
    (sum, p) => sum + Number(p.amount || 0), 0
  );
  return Math.max(0, Number(record.amount || 0) - paid);
}

function formatDate(date) {
  if (!date) return "Date unavailable";
  const d = new Date(date + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? "Date unavailable"
    : d.toLocaleDateString("en-IN");
}

const labels = {
  income: "Income",
  expense: "Expenses",
  udhar: "Udhar",
  jama: "Jama",
  udhar_payment: "Udhar Payment",
  jama_return: "Jama Return"
};

function getKindIcon(k) {
  return {
    income: "↙",
    expense: "↗",
    udhar: "U",
    jama: "J",
    udhar_payment: "✓",
    jama_return: "↩"
  }[k] || "•";
}

function getKindClass(k) {
  if (k === "income") return "";
  if (k === "expense") return "out";
  if (k === "udhar" || k === "udhar_payment") return "debt";
  return "deposit";
}

function getAmountClass(k) {
  if (k === "income") return "in";
  if (k === "expense") return "out-amount";
  if (k === "udhar" || k === "udhar_payment") return "debt-amount";
  return "deposit-amount";
}

function updateDashboard() {
  let income = 0;
  let expense = 0;
  let udhar = 0;
  let jama = 0;

  records.forEach(r => {
    if (r.entry_date === today) {
      if (r.kind === "income") income += Number(r.amount);
      if (r.kind === "expense") expense += Number(r.amount);
    }

    if (r.kind === "udhar") udhar += getRemaining(r);
    if (r.kind === "jama") jama += getRemaining(r);
  });

  $("incomeTotal").textContent = money(income);
  $("expenseTotal").textContent = money(expense);
  $("balanceTotal").textContent = money(income - expense);
  $("udharTotal").textContent = money(udhar);
  $("jamaTotal").textContent = money(jama);
}

function renderRecords() {
  const list = records.filter(r => {
    if (filter === "all") return true;
    return r.kind === filter;
  });

  if (!list.length) {
    $("records").innerHTML =
      '<div class="empty">No transactions found.</div>';
    return;
  }

  $("records").innerHTML = list.map(r => {
    const k = r.kind;
    const date = formatDate(r.entry_date);
    let subtitle = (labels[k] || k) + " • " + date;

    if (r.person_name) subtitle += " • " + r.person_name;

    let prefix = "+";
    if (k === "expense" || k === "udhar_payment" ||
        k === "jama_return") prefix = "−";

    let amountText = prefix + money(r.amount);

    if (k === "udhar" || k === "jama") {
      amountText = money(getRemaining(r));
      subtitle += " • Remaining";
    }

    return `
      <div class="record" data-record-id="${escapeHtml(r.id)}">
        <div class="record-icon ${getKindClass(k)}">
          ${getKindIcon(k)}
        </div>
        <div class="record-info">
          <b>${escapeHtml(r.description || labels[k] || "Transaction")}</b>
          <small>${escapeHtml(subtitle)}</small>
        </div>
        <div class="record-amount ${getAmountClass(k)}">
          ${amountText}
        </div>
        <div class="record-arrow">›</div>
      </div>`;
  }).join("");
}

async function loadRecords() {
  if (!client || loading) return;

  loading = true;
  $("refreshBtn").disabled = true;

  try {
    const { data, error } = await client
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    records = data || [];
    updateDashboard();
    renderRecords();

  } catch (error) {
    $("records").innerHTML =
      '<div class="empty">Could not load records: ' +
      escapeHtml(error.message) + '</div>';
  } finally {
    loading = false;
    $("refreshBtn").disabled = false;
  }
}

function updateKindUI() {
  document.querySelectorAll(".seg").forEach(button => {
    button.classList.toggle("active", button.dataset.kind === kind);
  });

  const special = kind === "udhar" || kind === "jama";

  $("personField").classList.toggle("hidden", !special);
  $("itemField").classList.toggle("hidden", !special);

  if (kind === "income") {
    $("description").placeholder = "e.g. Mobile repairing income";
  } else if (kind === "expense") {
    $("description").placeholder = "e.g. Shop electricity bill";
  } else if (kind === "udhar") {
    $("description").placeholder = "e.g. Spare parts purchased on credit";
  } else {
    $("description").placeholder = "e.g. Money deposited with Rahul";
  }
}

async function login() {
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

    msg("authMsg", "");
    await showApp();

  } catch (error) {
    msg("authMsg", error.message || "Login failed.");
  } finally {
    $("loginBtn").disabled = false;
  }
}

async function logout() {
  const { error } = await client.auth.signOut();

  if (error) {
    msg("authMsg", error.message);
    return;
  }

  showAuth();
}

async function saveTransaction() {
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
    msg("entryMsg", "Enter the person or supplier name.");
    return;
  }

  $("saveBtn").disabled = true;
  msg("entryMsg", "Saving...");

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
      notes: notes || null,
      payment_mode: paymentMode,
      parent_id: null
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

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>`;
}

function openDetails(id) {
  const r = records.find(x => String(x.id) === String(id));
  if (!r) return;

  const payments = getPayments(r.id);
  const isLedger = r.kind === "udhar" || r.kind === "jama";
  const remaining = isLedger ? getRemaining(r) : 0;
  const paid = isLedger ? Number(r.amount) - remaining : 0;

  let html = "";
  html += detailRow("Type", labels[r.kind] || r.kind);
  html += detailRow("Description", r.description);
  html += detailRow("Amount", money(r.amount));
  html += detailRow("Date", formatDate(r.entry_date));
  html += detailRow("Category", r.category);
  html += detailRow("Person / Supplier", r.person_name);
  html += detailRow("Item / Spare", r.item_name);
  html += detailRow("Payment mode", r.payment_mode);
  html += detailRow("Notes", r.notes);

  if (isLedger) {
    html += `
      <div class="detail-balance">
        <span>Original amount: ${money(r.amount)}</span>
        <div class="detail-row">
          <span>Paid / Returned</span>
          <strong>${money(paid)}</strong>
        </div>
        <strong>${money(remaining)}</strong>
        <span>Remaining balance</span>
      </div>`;
  }

  if (payments.length) {
    html += '<div class="payment-history"><h3>Payment history</h3>';

    payments.forEach(p => {
      html += `
        <div class="payment-item">
          <span>${escapeHtml(labels[p.kind] || p.kind)} • ${escapeHtml(formatDate(p.entry_date))}</span>
          <strong>${money(p.amount)}</strong>
        </div>`;
    });

    html += "</div>";
  }

  if (isLedger && remaining > 0) {
    html += `
      <div class="modal-actions">
        <button class="primary" id="makePayment">
          ${r.kind === "udhar" ? "Pay Udhar" : "Receive Jama"} →
        </button>
      </div>`;
  }

  $("detailContent").innerHTML = html;
  $("detailModal").classList.remove("hidden");

  const paymentButton = $("makePayment");

  if (paymentButton) {
    paymentButton.addEventListener("click", () => makePayment(r));
  }
}

async function makePayment(parent) {
  const remaining = getRemaining(parent);

  if (remaining <= 0) {
    toast("No remaining balance.");
    return;
  }

  const isUdhar = parent.kind === "udhar";

  const amountText = prompt(
    "Remaining: " + money(remaining) +
    "\nEnter " + (isUdhar ? "payment" : "returned amount") + " (₹):"
  );

  if (amountText === null) return;

  const amount = Number(amountText);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid amount.");
    return;
  }

  if (amount > remaining) {
    alert("Amount cannot be greater than remaining balance " + money(remaining));
    return;
  }

  const mode = prompt("Payment mode: Cash or Online", "Cash");
  if (mode === null) return;

  try {
    const { data: userData, error: userError } =
      await client.auth.getUser();

    if (userError) throw userError;
    if (!userData.user) throw new Error("Please login again.");

    const payment = {
      description: isUdhar
        ? "Payment to " + (parent.person_name || "supplier")
        : "Jama returned by " + (parent.person_name || "person"),
      amount,
      kind: isUdhar ? "udhar_payment" : "jama_return",
      category: isUdhar ? "Udhar Payment" : "Jama Return",
      entry_date: today,
      user_id: userData.user.id,
      person_name: parent.person_name || null,
      item_name: parent.item_name || null,
      notes: "Linked to " + parent.description,
      payment_mode: mode,
      parent_id: String(parent.id)
    };

    const { error } = await client
      .from("transactions")
      .insert(payment);

    if (error) throw error;

    toast("Payment saved successfully!");
    await loadRecords();
    openDetails(parent.id);

  } catch (error) {
    alert("Payment failed: " + error.message);
  }
}

function startApp() {
  $("entryDate").value = today;

  $("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  if (!url || !key ||
      url.includes("PASTE_") || key.includes("PASTE_")) {
    $("setupNotice").classList.remove("hidden");
    $("loginBtn").disabled = true;
    msg("authMsg", "Complete Supabase setup in config.js.");
    return;
  }

  if (!window.supabase) {
    msg("authMsg", "Supabase library not loaded.");
    return;
  }

  client = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  $("loginBtn").addEventListener("click", login);
  $("logoutBtn").addEventListener("click", logout);
  $("saveBtn").addEventListener("click", saveTransaction);
  $("refreshBtn").addEventListener("click", loadRecords);

  $("closeModal").addEventListener("click", () => {
    $("detailModal").classList.add("hidden");
  });

  $("detailModal").addEventListener("click", e => {
    if (e.target === $("detailModal")) {
      $("detailModal").classList.add("hidden");
    }
  });

  document.querySelectorAll(".seg").forEach(button => {
    button.addEventListener("click", () => {
      kind = button.dataset.kind;
      updateKindUI();
    });
  });

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;

      document.querySelectorAll(".filter").forEach(b => {
        b.classList.toggle("active", b === button);
      });

      renderRecords();
    });
  });

  $("records").addEventListener("click", e => {
    const row = e.target.closest(".record");
    if (row) openDetails(row.dataset.recordId);
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    if (data.session) showApp();
    else showAuth();
  }).catch(error => {
    showAuth();
    msg("authMsg", error.message);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      showAuth();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

startApp();
})();
                  
