
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const url = window.DM_SUPABASE_URL;
  const key = window.DM_SUPABASE_ANON_KEY;

  let client = null;
  let kind = "income";
  let loading = false;

  const today = (() => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  })();

  const money = n =>
    "₹" + Number(n || 0).toLocaleString("en-IN", {
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

  async function loadRecords() {
    if (!client || loading) return;

    loading = true;
    $("refreshBtn").disabled = true;

    try {
      const { data, error } = await client
        .from("transactions")
        .select("id,description,amount,kind,category,entry_date,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        $("records").innerHTML =
          '<div class="empty">Database Error: ' +
          escapeHtml(error.message) + "</div>";
        return;
      }

      let income = 0;
      let expense = 0;

      const records = data || [];

      records.forEach(r => {
        if (r.entry_date === today) {
          if (r.kind === "income") income += Number(r.amount);
          if (r.kind === "expense") expense += Number(r.amount);
        }
      });

      $("incomeTotal").textContent = money(income);
      $("expenseTotal").textContent = money(expense);
      $("balanceTotal").textContent = money(income - expense);

      if (!records.length) {
        $("records").innerHTML =
          '<div class="empty">No transactions yet.</div>';
        return;
      }

      $("records").innerHTML = records.map(r => {
        const isIncome = r.kind === "income";

        return `
          <div class="record">
            <div class="record-icon ${isIncome ? "" : "out"}">
              ${isIncome ? "↙" : "↗"}
            </div>
            <div class="record-info">
              <b>${escapeHtml(r.description)}</b>
              <small>
                ${escapeHtml(r.category || "Other")}
                •
                ${new Date(r.entry_date + "T00:00:00")
                  .toLocaleDateString("en-IN")}
              </small>
            </div>
            <div class="record-amount ${isIncome ? "in" : "out-amount"}">
              ${isIncome ? "+" : "−"}${money(r.amount)}
            </div>
          </div>
        `;
      }).join("");

    } catch (error) {
      $("records").innerHTML =
        '<div class="empty">' +
        escapeHtml(error.message || "Could not load records.") +
        "</div>";
    } finally {
      loading = false;
      $("refreshBtn").disabled = false;
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

      if (error) {
        msg("authMsg", error.message);
        return;
      }

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

    if (!description || !Number.isFinite(amount) ||
        amount <= 0 || !date) {
      msg("entryMsg", "Enter valid description, amount and date.");
      return;
    }

    $("saveBtn").disabled = true;
    msg("entryMsg", "Saving...");

    try {
      const { data: userData, error: userError } =
        await client.auth.getUser();

      if (userError) throw userError;

      if (!userData.user) {
        msg("entryMsg", "Please login again.");
        showAuth();
        return;
      }

      const { error } = await client
        .from("transactions")
        .insert({
          description,
          amount,
          kind,
          category,
          entry_date: date,
          user_id: userData.user.id
        });

      if (error) throw error;

      msg("entryMsg", "Saved successfully!");

      $("description").value = "";
      $("amount").value = "";

      await loadRecords();

    } catch (error) {
      msg("entryMsg", error.message || "Saving failed.");
    } finally {
      $("saveBtn").disabled = false;
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

    document.querySelectorAll(".seg").forEach(button => {
      button.addEventListener("click", () => {
        kind = button.dataset.kind;

        document.querySelectorAll(".seg").forEach(item => {
          item.classList.toggle("active", item === button);
        });
      });
    });

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
      if (event === "SIGNED_OUT" || !session) {
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
