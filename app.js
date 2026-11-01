(() => {
 const $ = id => document.getElementById(id);
 const url = window.DM_SUPABASE_URL, key = window.DM_SUPABASE_ANON_KEY;
 const configured = url && key && !url.includes("PASTE_") && !key.includes("PASTE_");
 let client = null, kind = "income";
 const authView=$("authView"), appView=$("appView");
 const today = new Date().toISOString().slice(0,10);
 $("entryDate").value=today;
 $("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 if(!configured){$("setupNotice").classList.remove("hidden");$("loginBtn").disabled=true;$("authMsg").textContent="Complete Supabase setup in config.js first.";return;}
 if(!window.supabase){$("authMsg").textContent="Could not load Supabase. Check your internet connection.";return;}
 client=window.supabase.createClient(url,key);
 const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
 function msg(id,s){$(id).textContent=s||"";}
 async function sessionCheck(){const {data}=await client.auth.getSession();if(data.session)showApp();else showAuth();}
 function showAuth(){authView.classList.remove("hidden");appView.classList.add("hidden");$("logoutBtn").classList.add("hidden");}
 async function showApp(){authView.classList.add("hidden");appView.classList.remove("hidden");$("logoutBtn").classList.remove("hidden");await loadRecords();}
 $("loginBtn").onclick=async()=>{const email=$("email").value.trim(),password=$("password").value;if(!email||!password){msg("authMsg","Enter email and password.");return;}$("loginBtn").disabled=true;msg("authMsg","Signing in…");const {error}=await client.auth.signInWithPassword({email,password});$("loginBtn").disabled=false;if(error){msg("authMsg",error.message);return;}msg("authMsg","");await showApp();};
 $("logoutBtn").onclick=async()=>{await client.auth.signOut();showAuth();};
 document.querySelectorAll(".seg").forEach(b=>b.onclick=()=>{kind=b.dataset.kind;document.querySelectorAll(".seg").forEach(x=>x.classList.toggle("active",x===b));});
 $("saveBtn").onclick=async()=>{const description=$("description").value.trim(),amount=Number($("amount").value),date=$("entryDate").value,category=$("category").value;if(!description||!amount||amount<=0||!date){msg("entryMsg","Description, valid amount and date are required.");return;}const {data:{user}}=await client.auth.getUser();$("saveBtn").disabled=true;const {error}=await client.from("transactions").insert({description,amount,kind,category,entry_date:date,user_id:user.id});$("saveBtn").disabled=false;if(error){msg("entryMsg",error.message);return;}msg("entryMsg","Saved successfully.");$("description").value="";$("amount").value="";await loadRecords();};
 $("refreshBtn").onclick=loadRecords;
 async function loadRecords(){const {data,error}=await client.from("transactions").select("id,description,amount,kind,category,entry_date,created_at").order("created_at",{ascending:false}).limit(100);if(error){$("records").innerHTML='<div class="empty">Could not load records. Check database setup and access policies.</div>';return;}let income=0,expense=0;data.forEach(r=>{if(r.entry_date===today){if(r.kind==="income")income+=Number(r.amount);else expense+=Number(r.amount);}});$("incomeTotal").textContent=money(income);$("expenseTotal").textContent=money(expense);$("balanceTotal").textContent=money(income-expense);if(!data.length){$("records").innerHTML='<div class="empty">No transactions yet. Add your first entry above.</div>';return;}$("records").innerHTML=data.map(r=>`<div class="record"><div class="record-icon ${r.kind==="expense"?"out":""}">${r.kind==="income"?"↙":"↗"}</div><div class="record-info"><b>${escapeHtml(r.description)}</b><small>${escapeHtml(r.category||"Other")} • ${new Date(r.entry_date+"T00:00:00").toLocaleDateString("en-IN")}</small></div><div class="record-amount ${r.kind==="income"?"in":"out-amount"}">${r.kind==="income"?"+":"−"}${money(r.amount)}</div></div>`).join("");}
 function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 client.auth.onAuthStateChange((_event,session)=>{if(session)showApp();else showAuth();});
 sessionCheck();
 if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();