(() => {
  const CFG = window.HOGAR_CONFIG;
  if (!CFG?.supabaseUrl || CFG.supabaseUrl.startsWith("PEGAR_")) {
    document.getElementById("boot").textContent =
      "Falta configurar js/config.js con tu URL y anon key de Supabase.";
    return;
  }

  const { createClient } = supabase;
  const sb = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

  const PEOPLE = [
    { id: "guadalupe", name: "Guadalupe", short: "Guada", initial: "G" },
    { id: "emanuel", name: "Emanuel", short: "Ema", initial: "E" },
  ];

  const CATS = {
    income: ["Sueldo", "Aguinaldo", "Freelance", "Extra", "Otro"],
    shared: [
      "Alquiler",
      "Expensas",
      "Luz",
      "Gas",
      "Agua",
      "Internet",
      "Supermercado",
      "Verdulería",
      "Carnicería",
      "Delivery",
      "Transporte",
      "Hogar",
      "Salud",
      "Mascotas",
      "Otro",
    ],
    personal: [
      "Ropa",
      "Salidas",
      "Delivery",
      "Hobby",
      "Transporte",
      "Belleza",
      "Salud",
      "Capacitación",
      "Gustos",
      "Otro",
    ],
  };

  const FIXED_HINTS = ["Alquiler", "Expensas", "Luz", "Gas", "Agua", "Internet"];

  const TYPE_META = {
    income: {
      kicker: "Ingreso",
      title: "Cargar tu ingreso",
      banner: "Lo ven los dos. Suma a tu sueldo y define tu % de la casa.",
      icon: "ING",
    },
    shared: {
      kicker: "Gasto de casa",
      title: "Gasto compartido",
      banner: "Lo ven los dos. Se reparte en proporción a los sueldos.",
      icon: "CASA",
    },
    personal: {
      kicker: "Gasto personal",
      title: "Gasto privado",
      banner: "Solo vos lo ves. No se reparte ni aparece en la cuenta del otro.",
      icon: "YO",
    },
  };

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
  const monthFmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
  const dayFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

  const state = {
    session: null,
    profile: null,
    txs: [],
    view: "resumen",
    month: toMonth(new Date()),
    loginWho: "guadalupe",
    editingId: null,
    form: { type: "shared", person: "guadalupe", category: "Supermercado" },
    loading: false,
    channel: null,
  };

  function toMonth(d) {
    const x = d instanceof Date ? d : new Date(d + "T12:00:00");
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  }

  function parseAmount(v) {
    const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function person(id) {
    return PEOPLE.find((p) => p.id === id);
  }

  function pct(n) {
    const v = Math.round(n * 1000) / 10;
    return `${v}%`.replace(".0%", "%");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mySlug() {
    return state.profile?.slug || null;
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  }

  function openSheet(id) {
    document.getElementById(id).hidden = false;
  }

  function closeSheet(id) {
    document.getElementById(id).hidden = true;
    if (id === "sheet") state.editingId = null;
  }

  function showApp(loggedIn) {
    document.getElementById("boot").hidden = true;
    document.getElementById("login-screen").hidden = loggedIn;
    document.getElementById("app").hidden = !loggedIn;
    document.getElementById("btn-add").hidden = !loggedIn;
  }

  /* ========== Auth ========== */

  async function loadProfile(userId) {
    const { data, error } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  }

  async function fetchTxs() {
    const { data, error } = await sb
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.txs = (data || []).map((row) => ({
      id: row.id,
      type: row.type,
      person: row.person,
      amount: Number(row.amount),
      category: row.category,
      date: row.date,
      note: row.note || "",
      recurring: !!row.recurring,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));
  }

  function subscribeRealtime() {
    if (state.channel) sb.removeChannel(state.channel);
    state.channel = sb
      .channel("hogar-txs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        async () => {
          try {
            await fetchTxs();
            render();
          } catch {
            /* ignore */
          }
        }
      )
      .subscribe();
  }

  async function enterApp(session) {
    state.session = session;
    state.profile = await loadProfile(session.user.id);
    await fetchTxs();
    subscribeRealtime();
    document.getElementById("session-kicker").textContent = `Sesión de ${person(state.profile.slug).short}`;
    document.getElementById("settings-user").textContent =
      `Estás como ${person(state.profile.slug).name}. Casa e ingresos se sincronizan. Lo personal es privado.`;
    showApp(true);
    render();
  }

  async function boot() {
    paintLoginWho();
    const { data } = await sb.auth.getSession();
    if (data.session) {
      try {
        await enterApp(data.session);
      } catch (err) {
        console.error(err);
        document.getElementById("boot").hidden = true;
        document.getElementById("login-screen").hidden = false;
        showLoginError("Tu usuario no tiene perfil. Revisá seed-profiles.sql.");
      }
    } else {
      showApp(false);
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        state.session = null;
        state.profile = null;
        state.txs = [];
        if (state.channel) sb.removeChannel(state.channel);
        showApp(false);
      }
      if (event === "SIGNED_IN" && session && !state.profile) {
        try {
          await enterApp(session);
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  function paintLoginWho() {
    const wrap = document.getElementById("login-who");
    wrap.innerHTML = "";
    PEOPLE.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pill ${p.id}${state.loginWho === p.id ? " active" : ""}`;
      b.textContent = p.short; // Guada / Ema
      b.addEventListener("click", () => {
        state.loginWho = p.id;
        paintLoginWho();
      });
      wrap.appendChild(b);
    });
  }

  function showLoginError(msg) {
    const el = document.getElementById("login-error");
    el.textContent = msg;
    el.hidden = !msg;
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoginError("");
    const email = CFG.users[state.loginWho]?.email;
    const password = document.getElementById("login-password").value;
    if (!email) {
      showLoginError("Falta el email de este usuario en config.js");
      return;
    }
    const btn = document.getElementById("login-submit");
    btn.disabled = true;
    btn.textContent = "Entrando…";
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    btn.textContent = "Entrar";
    if (error) {
      showLoginError("Contraseña incorrecta o usuario no creado en Supabase.");
      return;
    }
    try {
      await enterApp(data.session);
      document.getElementById("login-password").value = "";
    } catch (err) {
      console.error(err);
      showLoginError("Entraste, pero falta el perfil en la tabla profiles.");
      await sb.auth.signOut();
    }
  });

  /* ========== Data helpers ========== */

  function monthTxs(type) {
    return state.txs
      .filter((t) => toMonth(t.date) === state.month && (!type || t.type === type))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function calc(list) {
    const empty = { income: 0, sharedPaid: 0, personal: 0 };
    const by = { guadalupe: { ...empty }, emanuel: { ...empty } };
    const cats = { shared: {}, personal: {}, income: {} };

    for (const t of list) {
      const p = by[t.person];
      if (!p) continue;
      if (t.type === "income") {
        p.income += t.amount;
        cats.income[t.category] = (cats.income[t.category] || 0) + t.amount;
      }
      if (t.type === "shared") {
        p.sharedPaid += t.amount;
        cats.shared[t.category] = (cats.shared[t.category] || 0) + t.amount;
      }
      if (t.type === "personal") {
        p.personal += t.amount;
        cats.personal[t.category] = (cats.personal[t.category] || 0) + t.amount;
      }
    }

    const incomeTotal = by.guadalupe.income + by.emanuel.income;
    const sharedTotal = by.guadalupe.sharedPaid + by.emanuel.sharedPaid;
    const myPersonal = by[mySlug()]?.personal || 0;
    const bothHaveIncome = by.guadalupe.income > 0 && by.emanuel.income > 0;
    const hasIncome = incomeTotal > 0;
    const share = {
      guadalupe: bothHaveIncome ? by.guadalupe.income / incomeTotal : 0.5,
      emanuel: bothHaveIncome ? by.emanuel.income / incomeTotal : 0.5,
    };
    const should = {
      guadalupe: sharedTotal * share.guadalupe,
      emanuel: sharedTotal * share.emanuel,
    };
    const delta = {
      guadalupe: by.guadalupe.sharedPaid - should.guadalupe,
      emanuel: by.emanuel.sharedPaid - should.emanuel,
    };
    const leftover = {
      guadalupe: by.guadalupe.income - should.guadalupe - by.guadalupe.personal,
      emanuel: by.emanuel.income - should.emanuel - by.emanuel.personal,
    };

    let owing = null;
    if (Math.abs(delta.guadalupe) > 1) {
      owing =
        delta.guadalupe > 0
          ? { from: "emanuel", to: "guadalupe", amount: delta.guadalupe }
          : { from: "guadalupe", to: "emanuel", amount: -delta.guadalupe };
    }

    const sharedCats = Object.keys(cats.shared);
    const fixedDone = FIXED_HINTS.filter((c) => sharedCats.includes(c));

    return {
      by,
      cats,
      incomeTotal,
      sharedTotal,
      myPersonal,
      hasIncome,
      bothHaveIncome,
      share,
      should,
      leftover,
      owing,
      delta,
      fixedDone,
    };
  }

  function deltaTag(amount) {
    if (Math.abs(amount) <= 1) return `<span class="tag ok">A mano</span>`;
    if (amount > 0) return `<span class="tag over">Pagó de más ${money.format(amount)}</span>`;
    return `<span class="tag under">Falta aportar ${money.format(-amount)}</span>`;
  }

  function renderBars(entries, fillClass) {
    if (!entries.length) return `<p class="empty">Todavía no hay datos acá.</p>`;
    const max = entries[0][1] || 1;
    return entries
      .map(
        ([name, amt]) => `
        <div class="bar-row">
          <span>${name}</span>
          <div class="bar-track"><div class="bar-fill ${fillClass || ""}" style="width:${Math.max(8, (amt / max) * 100)}%"></div></div>
          <b>${money.format(amt)}</b>
        </div>`
      )
      .join("");
  }

  function renderTxList(list, emptyMsg) {
    if (!list.length) return `<p class="empty">${emptyMsg}</p>`;
    return list
      .map((t) => {
        const p = person(t.person);
        const scope =
          t.type === "shared" ? "Se reparte · visible" : t.type === "personal" ? "Privado · solo vos" : "Ingreso · visible";
        const sign = t.type === "income" ? "+" : "−";
        return `
          <button type="button" class="tx ${t.type} ${t.person}" data-id="${t.id}">
            <span class="tx-icon">${TYPE_META[t.type].icon}</span>
            <span>
              <b>${t.category}</b>
              <small>${p.short} · ${dayFmt.format(new Date(t.date + "T12:00:00"))}${t.note ? " · " + escapeHtml(t.note) : ""}${t.recurring ? " · fijo" : ""}</small>
              <span class="scope">${scope}</span>
            </span>
            <span class="amt">${sign}${money.format(t.amount)}</span>
          </button>`;
      })
      .join("");
  }

  function bindTxClicks(root) {
    root.querySelectorAll(".tx[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tx = state.txs.find((t) => t.id === btn.dataset.id);
        if (tx) openEdit(tx);
      });
    });
  }

  /* ========== Views ========== */

  function viewResumen(c) {
    const monthName = monthFmt.format(new Date(state.month + "-15T12:00:00"));
    const me = mySlug();
    let heroClass = "empty";
    let title = "Empecemos el mes con orden.";
    let lead = "Cargá tu sueldo y los gastos de casa. Lo personal es solo tuyo.";
    let actions = "";

    if (c.owing) {
      heroClass = "settle";
      const from = person(c.owing.from);
      const to = person(c.owing.to);
      title = `${from.short} le pasa ${money.format(c.owing.amount)} a ${to.short}.`;
      lead = c.bothHaveIncome
        ? `Equilibrio de casa: Guada ${pct(c.share.guadalupe)} · Ema ${pct(c.share.emanuel)}. Los personales no entran.`
        : "Falta un sueldo: por ahora el reparto es 50/50.";
      actions = `<div class="hero-actions"><button type="button" class="pill-btn" data-go="casa">Ver casa</button></div>`;
    } else if (c.sharedTotal > 0) {
      heroClass = "ok";
      title = "La casa está a mano.";
      lead = "Lo compartido coincide con la parte justa de cada uno.";
    } else if (c.bothHaveIncome) {
      title = "Sueldos listos. Falta la casa.";
      lead = `Juntos ${money.format(c.incomeTotal)}. Guada ${pct(c.share.guadalupe)} · Ema ${pct(c.share.emanuel)}.`;
      actions = `<div class="hero-actions"><button type="button" class="pill-btn" data-open="shared">Cargar gasto de casa</button></div>`;
    } else if (c.hasIncome) {
      title = "Falta el sueldo del otro.";
      lead = "Con un solo ingreso el reparto sigue 50/50.";
      actions = `<div class="hero-actions"><button type="button" class="pill-btn" data-open="income">Cargar mi ingreso</button></div>`;
    }

    const checks = [
      {
        done: c.by.guadalupe.income > 0,
        title: "Sueldo de Guadalupe",
        sub: c.by.guadalupe.income ? money.format(c.by.guadalupe.income) : "Todavía no",
      },
      {
        done: c.by.emanuel.income > 0,
        title: "Sueldo de Emanuel",
        sub: c.by.emanuel.income ? money.format(c.by.emanuel.income) : "Todavía no",
      },
      {
        done: c.sharedTotal > 0,
        title: "Gastos de casa",
        sub: c.sharedTotal ? money.format(c.sharedTotal) : "Alquiler, servicios, super…",
      },
      {
        done: c.fixedDone.length >= 2,
        title: "Fijos del hogar",
        sub: c.fixedDone.length ? `${c.fixedDone.length} cargados` : "Alquiler, expensas, luz…",
      },
    ];

    return `
      <section class="card hero ${heroClass}">
        <p class="kicker">${monthName} · ${person(me).short}</p>
        <h2>${title}</h2>
        <p class="lead">${lead}</p>
        ${actions}
        <div class="stat-row">
          <div class="stat"><span>Ingresos</span><strong>${money.format(c.incomeTotal)}</strong></div>
          <div class="stat"><span>Casa</span><strong>${money.format(c.sharedTotal)}</strong></div>
          <div class="stat"><span>Tu personal</span><strong>${money.format(c.myPersonal)}</strong></div>
        </div>
      </section>

      <section class="card">
        <div class="section-head"><div><h3>Checklist del mes</h3><p>Orden básico compartido</p></div></div>
        <div class="checklist">
          ${checks
            .map(
              (item) => `
            <div class="check-item ${item.done ? "done" : ""}">
              <span class="dot">${item.done ? "✓" : ""}</span>
              <div><b>${item.title}</b><small>${item.sub}</small></div>
            </div>`
            )
            .join("")}
        </div>
      </section>

      <section class="card">
        <div class="section-head"><div><h3>Reparto de la casa</h3><p>Solo compartidos · personales privados</p></div></div>
        <div class="split-track" aria-hidden="true">
          <div class="g" style="width:${c.share.guadalupe * 100}%"></div>
          <div class="e" style="width:${c.share.emanuel * 100}%"></div>
        </div>
        <div class="split-grid">
          <div class="split-card guadalupe">
            <div class="who">Guadalupe</div>
            <div class="pct">${pct(c.share.guadalupe)}</div>
            <div class="meta">Le toca ${money.format(c.should.guadalupe)}</div>
          </div>
          <div class="split-card emanuel">
            <div class="who">Emanuel</div>
            <div class="pct">${pct(c.share.emanuel)}</div>
            <div class="meta">Le toca ${money.format(c.should.emanuel)}</div>
          </div>
        </div>
      </section>

      <section class="people">
        ${PEOPLE.map((p) => {
          const d = c.by[p.id];
          const isMe = p.id === me;
          return `
            <article class="person ${p.id}">
              <div class="person-top">
                <div class="avatar ${p.id}">${p.initial}</div>
                <div>
                  <h4>${p.name}${isMe ? " · vos" : ""}</h4>
                  <p>${c.bothHaveIncome ? `${pct(c.share[p.id])} de la casa` : "Esperando ambos sueldos"}</p>
                </div>
              </div>
              <div class="metric"><span>Cobró</span><b>${money.format(d.income)}</b></div>
              <div class="metric"><span>Pagó de casa</span><b>${money.format(d.sharedPaid)}</b></div>
              <div class="metric"><span>Le corresponde</span><b>${money.format(c.should[p.id])}</b></div>
              <div class="metric"><span>Personal</span><b>${isMe ? money.format(d.personal) : '<span class="private-badge">Privado</span>'}</b></div>
              ${deltaTag(c.delta[p.id])}
              ${isMe ? `<div class="leftover ${p.id}">Te queda ${money.format(c.leftover[p.id])}</div>` : `<div class="leftover ${p.id}">Parte de casa ok · personales ocultos</div>`}
            </article>`;
        }).join("")}
      </section>

      <section class="card">
        <div class="section-head">
          <div><h3>Últimos movimientos</h3><p>Tocá para editar · personales ajenos no aparecen</p></div>
        </div>
        <div class="tx-list">${renderTxList(monthTxs().slice(0, 10), "Todavía no hay movimientos este mes.")}</div>
      </section>
    `;
  }

  function viewCasa(c) {
    const entries = Object.entries(c.cats.shared).sort((a, b) => b[1] - a[1]);
    return `
      <div class="callout casa">Gastos compartidos: los ven y editan los dos. Se reparte según sueldos.</div>
      <section class="card hero ${c.owing ? "settle" : c.sharedTotal ? "ok" : "empty"}">
        <p class="kicker">Gastos de casa</p>
        <h2>${c.sharedTotal ? money.format(c.sharedTotal) : "Sin gastos de casa"}</h2>
        <p class="lead">${
          c.owing
            ? `${person(c.owing.from).name} le debe ${money.format(c.owing.amount)} a ${person(c.owing.to).short}.`
            : c.sharedTotal
              ? `A mano. Guada ${pct(c.share.guadalupe)} · Ema ${pct(c.share.emanuel)}.`
              : "Cargá alquiler, servicios o super."
        }</p>
        <div class="hero-actions"><button type="button" class="pill-btn" data-open="shared">+ Gasto de casa</button></div>
      </section>
      <section class="card">
        <div class="section-head"><div><h3>Por categoría</h3></div></div>
        <div class="bars">${renderBars(entries)}</div>
      </section>
      <section class="card">
        <div class="section-head"><div><h3>Movimientos de casa</h3><p>Visibles para ambos</p></div></div>
        <div class="tx-list">${renderTxList(monthTxs("shared"), "No hay gastos de casa este mes.")}</div>
      </section>
    `;
  }

  function viewPersonal(c) {
    const me = mySlug();
    const list = monthTxs("personal");
    return `
      <div class="callout personal">Solo ves <strong>tus</strong> gastos personales. ${
        me === "guadalupe" ? "Emanuel" : "Guadalupe"
      } no puede verlos, y vos tampoco ves los de la otra persona.</div>
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Tu personal · ${person(me).short}</h3>
            <p>Privado en la nube</p>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat"><span>Gastaste</span><strong>${money.format(c.myPersonal)}</strong></div>
          <div class="stat"><span>Te queda</span><strong>${money.format(c.leftover[me])}</strong></div>
          <div class="stat"><span>Parte de casa</span><strong>${money.format(c.should[me])}</strong></div>
        </div>
        <div class="hero-actions"><button type="button" class="pill-btn soft" data-open="personal">+ Gasto personal</button></div>
      </section>
      <section class="card">
        <div class="section-head"><div><h3>Tus movimientos</h3><p>Badge “Privado · solo vos”</p></div></div>
        <div class="tx-list">${renderTxList(list, "Todavía no cargaste gastos personales.")}</div>
      </section>
    `;
  }

  function viewIngresos(c) {
    const entries = Object.entries(c.cats.income).sort((a, b) => b[1] - a[1]);
    return `
      <div class="callout income">Los ingresos se ven entre los dos. Cada uno carga el suyo.</div>
      <section class="card hero ${c.bothHaveIncome ? "ok" : "empty"}">
        <p class="kicker">Ingresos del mes</p>
        <h2>${c.incomeTotal ? money.format(c.incomeTotal) : "Sin ingresos"}</h2>
        <p class="lead">${
          c.bothHaveIncome
            ? `Guada ${money.format(c.by.guadalupe.income)} (${pct(c.share.guadalupe)}) · Ema ${money.format(c.by.emanuel.income)} (${pct(c.share.emanuel)}).`
            : "Cargá ambos sueldos para el reparto proporcional."
        }</p>
        <div class="hero-actions"><button type="button" class="pill-btn" data-open="income">+ Mi ingreso</button></div>
      </section>
      <section class="card">
        <div class="section-head"><div><h3>Por categoría</h3></div></div>
        <div class="bars">${renderBars(entries, "income")}</div>
      </section>
      <section class="card">
        <div class="section-head"><div><h3>Movimientos de ingreso</h3><p>Visibles para ambos</p></div></div>
        <div class="tx-list">${renderTxList(monthTxs("income"), "No hay ingresos este mes.")}</div>
      </section>
    `;
  }

  function render() {
    if (!state.profile) return;
    const c = calc(monthTxs());
    document.getElementById("btn-month").textContent = monthFmt.format(new Date(state.month + "-15T12:00:00"));
    document.querySelectorAll("#tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === state.view);
    });

    const root = document.getElementById("view-root");
    if (state.view === "casa") root.innerHTML = viewCasa(c);
    else if (state.view === "personal") root.innerHTML = viewPersonal(c);
    else if (state.view === "ingresos") root.innerHTML = viewIngresos(c);
    else root.innerHTML = viewResumen(c);

    bindTxClicks(root);
    root.querySelectorAll("[data-go]").forEach((b) => {
      b.addEventListener("click", () => {
        state.view = b.dataset.go;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    root.querySelectorAll("[data-open]").forEach((b) => {
      b.addEventListener("click", () => openNew(b.dataset.open));
    });
  }

  /* ========== Form ========== */

  function paintPills(container, selected, onPick, locked) {
    container.innerHTML = "";
    PEOPLE.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pill ${p.id}${selected === p.id ? " active" : ""}`;
      b.textContent = p.name;
      b.disabled = !!locked && p.id !== selected;
      if (!locked) b.addEventListener("click", () => onPick(p.id));
      container.appendChild(b);
    });
  }

  function paintForm() {
    const { type, person: who, category } = state.form;
    const meta = TYPE_META[type];
    const me = mySlug();
    document.getElementById("form-kicker").textContent = meta.kicker;
    document.getElementById("sheet-title").textContent = state.editingId ? "Editar movimiento" : meta.title;
    const banner = document.getElementById("form-banner");
    banner.className = `form-banner ${type}`;
    banner.textContent = meta.banner;

    const whoField = document.getElementById("who-field");
    const whoLabel = document.getElementById("who-label");
    if (type === "shared") {
      whoField.hidden = false;
      whoLabel.textContent = "Quién pagó";
      paintPills(document.getElementById("form-who"), who, (id) => {
        state.form.person = id;
        paintForm();
      });
    } else {
      whoField.hidden = false;
      whoLabel.textContent = type === "income" ? "Quién cobró" : "A nombre de";
      state.form.person = me;
      paintPills(document.getElementById("form-who"), me, () => {}, true);
    }

    const chips = document.getElementById("category-chips");
    chips.innerHTML = "";
    CATS[type].forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.className = c === category ? "active" : "";
      b.addEventListener("click", () => {
        state.form.category = c;
        paintForm();
      });
      chips.appendChild(b);
    });

    document.getElementById("recurring-wrap").style.display = type === "shared" ? "" : "none";
    document.getElementById("btn-delete").hidden = !state.editingId;
    document.getElementById("btn-save").textContent = state.editingId ? "Guardar cambios" : "Guardar";
  }

  function openTypePicker() {
    openSheet("type-sheet");
  }

  function openNew(type) {
    closeSheet("type-sheet");
    state.editingId = null;
    state.form = {
      type,
      person: type === "shared" ? mySlug() : mySlug(),
      category: CATS[type][0],
    };
    document.getElementById("tx-form").reset();
    document.getElementById("date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("amount").value = "";
    document.getElementById("note").value = "";
    document.getElementById("recurring").checked = false;
    paintForm();
    openSheet("sheet");
    setTimeout(() => document.getElementById("amount").focus(), 80);
  }

  function openEdit(tx) {
    const me = mySlug();
    if (tx.type !== "shared" && tx.person !== me) {
      toast("No podés editar esto");
      return;
    }
    state.editingId = tx.id;
    state.form = { type: tx.type, person: tx.person, category: tx.category };
    document.getElementById("amount").value = String(tx.amount).replace(".", ",");
    document.getElementById("date").value = tx.date;
    document.getElementById("note").value = tx.note || "";
    document.getElementById("recurring").checked = !!tx.recurring;
    paintForm();
    openSheet("sheet");
  }

  /* ========== Events ========== */

  document.querySelectorAll("#tabs button").forEach((b) => {
    b.addEventListener("click", () => {
      state.view = b.dataset.view;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.getElementById("btn-prev-month").addEventListener("click", () => {
    const [y, m] = state.month.split("-").map(Number);
    state.month = toMonth(new Date(y, m - 2, 1));
    render();
  });
  document.getElementById("btn-next-month").addEventListener("click", () => {
    const [y, m] = state.month.split("-").map(Number);
    state.month = toMonth(new Date(y, m, 1));
    render();
  });
  document.getElementById("btn-month").addEventListener("click", () => {
    state.month = toMonth(new Date());
    render();
  });

  document.getElementById("btn-add").addEventListener("click", openTypePicker);
  document.getElementById("btn-settings").addEventListener("click", () => openSheet("settings-sheet"));

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closeSheet(el.dataset.close));
  });
  document.querySelectorAll("[data-pick]").forEach((b) => {
    b.addEventListener("click", () => openNew(b.dataset.pick));
  });

  document.getElementById("tx-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.loading) return;
    const amount = parseAmount(document.getElementById("amount").value);
    if (amount <= 0) {
      toast("Poné un monto mayor a 0");
      return;
    }

    const me = mySlug();
    let personId = state.form.person;
    if (state.form.type !== "shared") personId = me;

    const payload = {
      type: state.form.type,
      person: personId,
      amount,
      category: state.form.category,
      date: document.getElementById("date").value,
      note: document.getElementById("note").value.trim(),
      recurring: document.getElementById("recurring").checked && state.form.type === "shared",
      updated_at: new Date().toISOString(),
    };

    state.loading = true;
    document.getElementById("btn-save").textContent = "Guardando…";

    try {
      if (state.editingId) {
        const { error } = await sb.from("transactions").update(payload).eq("id", state.editingId);
        if (error) throw error;
        toast("Actualizado");
      } else {
        const { error } = await sb.from("transactions").insert({
          ...payload,
          created_by: state.session.user.id,
        });
        if (error) throw error;
        toast(
          payload.type === "personal"
            ? "Personal guardado (privado)"
            : payload.type === "shared"
              ? "Gasto de casa sincronizado"
              : "Ingreso sincronizado"
        );
        if (payload.type === "shared") state.view = "casa";
        if (payload.type === "personal") state.view = "personal";
        if (payload.type === "income") state.view = "ingresos";
      }
      await fetchTxs();
      closeSheet("sheet");
      render();
    } catch (err) {
      console.error(err);
      toast(err.message || "No se pudo guardar");
    } finally {
      state.loading = false;
      document.getElementById("btn-save").textContent = state.editingId ? "Guardar cambios" : "Guardar";
    }
  });

  document.getElementById("btn-delete").addEventListener("click", async () => {
    if (!state.editingId || !confirm("¿Eliminar este movimiento?")) return;
    try {
      const { error } = await sb.from("transactions").delete().eq("id", state.editingId);
      if (error) throw error;
      await fetchTxs();
      closeSheet("sheet");
      toast("Eliminado");
      render();
    } catch (err) {
      toast(err.message || "No se pudo eliminar");
    }
  });

  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = document.getElementById("new-password").value;
    const b = document.getElementById("new-password-2").value;
    const err = document.getElementById("password-error");
    err.hidden = true;
    if (a.length < 4) {
      err.textContent = "Mínimo 4 caracteres";
      err.hidden = false;
      return;
    }
    if (a !== b) {
      err.textContent = "Las contraseñas no coinciden";
      err.hidden = false;
      return;
    }
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) {
      err.textContent = error.message;
      err.hidden = false;
      return;
    }
    document.getElementById("password-form").reset();
    closeSheet("settings-sheet");
    toast("Contraseña actualizada");
  });

  document.getElementById("btn-logout").addEventListener("click", async () => {
    closeSheet("settings-sheet");
    await sb.auth.signOut();
    showApp(false);
  });

  boot();
})();
