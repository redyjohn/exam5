(() => {
  const DATA = window.BIM_DATA;
  const STORAGE_KEY = "bim-practice-progress-v2";
  const app = document.getElementById("app");

  const state = {
    view: "home",
    category: "all",
    index: 0,
    shuffled: false,
    order: [],
    flashOrder: [],
    showAnswer: false,
    flashFlipped: false,
    caseId: null,
    caseRevealed: false,
  };

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveProgress(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function markStatus(id, status) {
    const p = loadProgress();
    p[id] = { status, at: Date.now() };
    saveProgress(p);
  }

  function getStatus(id) {
    return loadProgress()[id]?.status || "unseen";
  }

  function qaList() {
    return DATA.questions.filter((q) => q.type === "qa" || q.type === "scenarios");
  }

  function filteredQuestions() {
    let list = qaList();
    if (state.category !== "all") {
      list = list.filter((q) => q.category === state.category);
    }
    if (!state.order.length) {
      state.order = list.map((_, i) => i);
    }
    return list;
  }

  function shuffleIndices(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function rebuildOrder() {
    const list = qaList().filter(
      (q) => state.category === "all" || q.category === state.category
    );
    state.order = state.shuffled
      ? shuffleIndices(list.length)
      : list.map((_, i) => i);
    state.index = 0;
    state.showAnswer = false;
  }

  function flashList() {
    return qaList().filter(
      (q) =>
        q.type === "qa" &&
        (state.category === "all" || q.category === state.category)
    );
  }

  function rebuildFlashOrder(doShuffle) {
    const list = flashList();
    state.flashOrder = doShuffle
      ? shuffleIndices(list.length)
      : list.map((_, i) => i);
    state.index = 0;
    state.flashFlipped = false;
  }

  function currentFlash() {
    const list = flashList();
    if (!list.length) return null;
    if (state.flashOrder.length !== list.length) {
      rebuildFlashOrder(false);
    }
    const idx = state.flashOrder[state.index] ?? 0;
    return { q: list[idx], list, pos: state.index };
  }

  function currentQuestion() {
    const list = filteredQuestions();
    if (!list.length) return null;
    const idx = state.order[state.index] ?? 0;
    return { q: list[idx], list, pos: state.index };
  }

  function catName(id) {
    return DATA.categories.find((c) => c.id === id)?.name || id;
  }

  function countKnown() {
    const p = loadProgress();
    return Object.values(p).filter((x) => x.status === "known").length;
  }

  function hasCases() {
    return Array.isArray(DATA.cases) && DATA.cases.length > 0;
  }

  function setNavActive() {
    document.querySelectorAll(".nav button").forEach((btn) => {
      if (btn.dataset.nav === "cases") btn.hidden = !hasCases();
      btn.classList.toggle("active", btn.dataset.nav === state.view);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl(str) {
    return escapeHtml(str).replace(/\n/g, "<br>");
  }

  function starHtml(q) {
    const n = Number(q.stars) || 0;
    if (n <= 0) return "";
    return `<span class="star-mark" aria-label="${n} 星重點">${"★".repeat(n)}</span> `;
  }

  /* ---------- Views ---------- */

  function renderHome() {
    const totalQa = qaList().length;
    const cases = (DATA.cases || []).length;
    const known = countKnown();
    const cats = DATA.categories
      .map((c) => {
        const n =
          c.id === "case"
            ? cases
            : DATA.questions.filter((q) => q.category === c.id).length;
        return `
        <button type="button" class="cat-card" data-open-cat="${c.id}">
          <div class="cat-bar" style="background:${c.color}"></div>
          <div class="count">${n} 題</div>
          <h3>${escapeHtml(c.name)}</h3>
          <p>${escapeHtml(c.desc)}</p>
        </button>`;
      })
      .join("");

    const brand = DATA.meta.brand || "BIM";
    const title = DATA.meta.title || "BIM 顧客服務管理師";
    const hero = DATA.meta.hero || "";
    const caseBtn = hasCases()
      ? `<button type="button" class="btn btn-ghost" data-nav="cases">案例演練</button>`
      : "";
    const midStat = hasCases()
      ? `<div class="stat"><strong>${cases}</strong><span>綜合案例</span></div>`
      : `<div class="stat"><strong>${DATA.categories.length}</strong><span>單元</span></div>`;

    app.innerHTML = `
      <section class="hero">
        <p class="hero-brand">${escapeHtml(brand)}</p>
        <h1>${escapeHtml(title)}｜考試練習</h1>
        <p>${escapeHtml(hero)}</p>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" data-nav="practice">開始練習</button>
          <button type="button" class="btn btn-ghost" data-nav="flash">閃卡背誦</button>
          ${caseBtn}
        </div>
        <div class="stats-row">
          <div class="stat"><strong>${totalQa}</strong><span>問答題</span></div>
          ${midStat}
          <div class="stat"><strong>${known}</strong><span>已掌握</span></div>
        </div>
      </section>
      <h2 class="section-title">依單元練習</h2>
      <div class="cat-grid">${cats}</div>
    `;
  }

  function renderPractice() {
    const cur = currentQuestion();
    if (!cur) {
      app.innerHTML = `<div class="empty">此單元尚無題目</div>`;
      return;
    }
    const { q, list, pos } = cur;
    const chips = [
      { id: "all", name: "全部" },
      ...DATA.categories.filter((c) => c.id !== "case"),
    ]
      .map(
        (c) =>
          `<button type="button" class="chip ${
            state.category === c.id ? "active" : ""
          }" data-filter="${c.id}">${escapeHtml(c.name)}</button>`
      )
      .join("");

    let body = "";
    if (q.type === "scenarios") {
      body = renderScenarios(q);
    } else {
      body = `
        <div class="card">
          <div class="q-meta">
            <span class="badge">${escapeHtml(catName(q.category))}</span>
            <span class="q-num">第 ${pos + 1} / ${list.length} 題</span>
          </div>
          <p class="question-text">${starHtml(q)}${nl(q.q)}</p>
          <label for="user-answer" class="progress-mini">寫下你的答案</label>
          <textarea id="user-answer" class="answer-box" placeholder="先回想再對照參考答案…"></textarea>
          <div class="card-actions">
            <button type="button" class="btn btn-primary" data-action="reveal">顯示參考答案</button>
            <button type="button" class="btn btn-ghost" data-action="prev">上一題</button>
            <button type="button" class="btn btn-ghost" data-action="next">下一題</button>
          </div>
          ${
            state.showAnswer
              ? `<div class="model-answer"><h4>參考答案</h4>${nl(q.a)}</div>
                 <div class="self-rate">
                   <span>自我評分：</span>
                   <button type="button" class="btn btn-sm btn-primary" data-rate="known">已掌握</button>
                   <button type="button" class="btn btn-sm btn-amber" data-rate="review">再複習</button>
                 </div>`
              : ""
          }
        </div>`;
    }

    app.innerHTML = `
      <div class="toolbar">
        <h2>題目練習</h2>
        <div class="filters">${chips}</div>
      </div>
      <div class="toolbar" style="margin-top:-0.5rem">
        <span class="progress-mini">進度：已掌握 ${countKnown()} 題</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="shuffle">
          ${state.shuffled ? "取消隨機" : "隨機出題"}
        </button>
      </div>
      ${body}
    `;
  }

  function renderScenarios(q) {
    const items = q.scenarios
      .map(
        (s, i) => `
      <div class="scenario-item" data-si="${i}">
        <strong>${i + 1}. ${escapeHtml(s.prompt)}</strong>
        <input type="text" placeholder="寫一句朋友式互動話語…" data-scenario-input="${i}" />
        <div class="ok">參考：${escapeHtml(s.answer)}</div>
      </div>`
      )
      .join("");

    return `
      <div class="card">
        <div class="q-meta">
          <span class="badge">${escapeHtml(catName(q.category))}</span>
        </div>
        <p class="question-text">${nl(q.q)}</p>
        <div class="scenario-list">${items}</div>
        <div class="card-actions">
          <button type="button" class="btn btn-primary" data-action="reveal-scenarios">全部顯示參考</button>
          <button type="button" class="btn btn-ghost" data-action="prev">上一題</button>
          <button type="button" class="btn btn-ghost" data-action="next">下一題</button>
          <button type="button" class="btn btn-sm btn-primary" data-rate="known">標記已掌握</button>
        </div>
      </div>`;
  }

  function renderFlash() {
    const cur = currentFlash();
    if (!cur) {
      app.innerHTML = `<div class="empty">此單元無可閃卡題目</div>`;
      return;
    }
    const { q, list, pos } = cur;
    const chips = [
      { id: "all", name: "全部" },
      ...DATA.categories.filter((c) => c.id !== "case"),
    ]
      .map(
        (c) =>
          `<button type="button" class="chip ${
            state.category === c.id ? "active" : ""
          }" data-filter="${c.id}">${escapeHtml(c.name)}</button>`
      )
      .join("");

    app.innerHTML = `
      <div class="toolbar">
        <h2>閃卡背誦</h2>
        <div class="filters">${chips}</div>
      </div>
      <div class="toolbar" style="margin-top:-0.5rem">
        <p class="progress-mini" style="margin:0">第 ${pos + 1} / ${list.length} 張 · 點擊卡片翻面</p>
        <button type="button" class="btn btn-sm btn-ghost" data-action="shuffle-flash">隨機出題</button>
      </div>
      <div class="flash-wrap">
        <div class="flash-card ${state.flashFlipped ? "flipped" : ""}" data-action="flip" role="button" tabindex="0">
          <div class="flash-face front">
            <div class="flash-hint">${escapeHtml(catName(q.category))} · 問題</div>
            <div class="flash-body">
              <p>${starHtml(q)}${nl(q.q)}</p>
            </div>
          </div>
          <div class="flash-face back">
            <div class="flash-hint">參考答案</div>
            <div class="flash-body">
              <p>${nl(q.a)}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="card-actions" style="margin-top:1.25rem">
        <button type="button" class="btn btn-ghost" data-action="prev">上一張</button>
        <button type="button" class="btn btn-ghost" data-action="next">下一張</button>
        <button type="button" class="btn btn-sm btn-primary" data-rate="known">已掌握</button>
        <button type="button" class="btn btn-sm btn-amber" data-rate="review">再複習</button>
      </div>
    `;
  }

  function renderCases() {
    if (state.caseId) {
      renderCaseDetail();
      return;
    }
    const links = (DATA.cases || [])
      .map(
        (c) => `
      <button type="button" class="case-link" data-case="${c.id}">
        <h3>${escapeHtml(c.title)}</h3>
        <p>依環境／商品／人員服務構面分析優良與缺失</p>
      </button>`
      )
      .join("");

    app.innerHTML = `
      <div class="toolbar"><h2>服務綜合篇 · 案例分析</h2></div>
      <p class="progress-mini" style="margin-bottom:1rem">先閱讀情境，自行列出至少 10 項優良／缺失，再對照參考解答。</p>
      <div class="case-list">${links}</div>
    `;
  }

  function renderCaseDetail() {
    const c = DATA.cases.find((x) => x.id === state.caseId);
    if (!c) {
      state.caseId = null;
      renderCases();
      return;
    }

    const dims = Object.entries(c.answer)
      .map(([name, data]) => {
        const good = (data.good || [])
          .map((x) => `<li>${escapeHtml(x)}</li>`)
          .join("") || "<li>（無）</li>";
        const bad = (data.bad || [])
          .map((x) => `<li>${escapeHtml(x)}</li>`)
          .join("") || "<li>（無）</li>";
        return `
        <div class="dim-block">
          <h4>${escapeHtml(name)}</h4>
          <div class="dim-cols">
            <div class="col-good"><h5>優良</h5><ul>${good}</ul></div>
            <div class="col-bad"><h5>缺失</h5><ul>${bad}</ul></div>
          </div>
        </div>`;
      })
      .join("");

    app.innerHTML = `
      <div class="toolbar">
        <h2>${escapeHtml(c.title)}</h2>
        <button type="button" class="btn btn-sm btn-ghost" data-action="back-cases">返回案例列表</button>
      </div>
      <div class="card">
        <p class="question-text" style="font-size:1rem">${escapeHtml(c.instruction)}</p>
        <div class="story-box">${escapeHtml(c.story)}</div>
        ${c.reference ? `<div class="ref-box">${escapeHtml(c.reference)}</div>` : ""}
        <label class="progress-mini">你的分析筆記（環境／商品／人員 · 優良與缺失）</label>
        <textarea class="user-notes" id="case-notes" placeholder="環境服務優良：…&#10;環境服務缺失：…&#10;商品服務…&#10;人員服務…"></textarea>
        <div class="card-actions">
          <button type="button" class="btn btn-primary" data-action="reveal-case">顯示參考解答</button>
          <button type="button" class="btn btn-sm btn-primary" data-rate-case="known">標記已練習</button>
        </div>
        ${
          state.caseRevealed
            ? `<div style="margin-top:1.25rem"><h3 class="section-title" style="margin-top:0">參考解答</h3><div class="dim-grid">${dims}</div></div>`
            : ""
        }
      </div>
    `;
  }

  function renderProgress() {
    const all = [
      ...qaList().map((q) => ({
        id: q.id,
        label: q.q.slice(0, 42) + (q.q.length > 42 ? "…" : ""),
        cat: catName(q.category),
      })),
      ...(DATA.cases || []).map((c) => ({
        id: c.id,
        label: c.title,
        cat: "服務綜合篇",
      })),
    ];
    const known = all.filter((x) => getStatus(x.id) === "known").length;
    const review = all.filter((x) => getStatus(x.id) === "review").length;
    const pct = all.length ? Math.round((known / all.length) * 100) : 0;

    const items = all
      .map((x) => {
        const st = getStatus(x.id);
        const label =
          st === "known" ? "已掌握" : st === "review" ? "再複習" : "未練習";
        return `
        <div class="progress-item">
          <div>
            <span class="status-dot ${st}"></span>
            <strong style="font-weight:500">${escapeHtml(x.label)}</strong>
            <div class="progress-mini">${escapeHtml(x.cat)} · ${label}</div>
          </div>
        </div>`;
      })
      .join("");

    app.innerHTML = `
      <div class="toolbar">
        <h2>學習進度</h2>
        <button type="button" class="btn btn-sm btn-ghost" data-action="reset-progress">清除進度</button>
      </div>
      <div class="card">
        <p class="progress-mini">已掌握 ${known} / ${all.length}（再複習 ${review}）</p>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="progress-list">${items}</div>
      </div>
    `;
  }

  function render(opts = {}) {
    setNavActive();
    if (state.view === "home") renderHome();
    else if (state.view === "practice") renderPractice();
    else if (state.view === "flash") renderFlash();
    else if (state.view === "cases") renderCases();
    else if (state.view === "progress") renderProgress();
    if (!opts.keepScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function flipFlash() {
    state.flashFlipped = !state.flashFlipped;
    const card = document.querySelector(".flash-card");
    if (card) {
      card.classList.toggle("flipped", state.flashFlipped);
      card.querySelectorAll(".flash-body").forEach((el) => {
        el.scrollTop = 0;
      });
    } else {
      render({ keepScroll: true });
    }
  }

  function go(view) {
    state.view = view;
    if (view === "cases") {
      state.caseId = null;
      state.caseRevealed = false;
    }
    if (view === "practice") {
      rebuildOrder();
      state.showAnswer = false;
    }
    if (view === "flash") {
      rebuildFlashOrder(false);
    }
    render();
  }

  function currentId() {
    if (state.view === "cases" && state.caseId) return state.caseId;
    if (state.view === "flash") return currentFlash()?.q?.id;
    return currentQuestion()?.q?.id;
  }

  function move(delta) {
    const list =
      state.view === "flash" ? flashList() : filteredQuestions();
    if (!list.length) return;
    state.index = (state.index + delta + list.length) % list.length;
    state.showAnswer = false;
    state.flashFlipped = false;
    render();
  }

  let flashPointer = null;

  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".flash-card")) {
      flashPointer = { x: e.clientX, y: e.clientY };
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-nav],[data-open-cat],[data-filter],[data-action],[data-rate],[data-rate-case],[data-case]");
    if (!t) return;

    if (t.dataset.nav) {
      go(t.dataset.nav);
      return;
    }
    if (t.dataset.openCat) {
      const id = t.dataset.openCat;
      if (id === "case") {
        go("cases");
      } else {
        state.category = id;
        go("practice");
      }
      return;
    }
    if (t.dataset.filter) {
      state.category = t.dataset.filter;
      if (state.view === "flash") rebuildFlashOrder(false);
      else rebuildOrder();
      state.flashFlipped = false;
      render();
      return;
    }
    if (t.dataset.case) {
      state.caseId = t.dataset.case;
      state.caseRevealed = false;
      render();
      return;
    }
    if (t.dataset.rate) {
      const id = currentId();
      if (id) markStatus(id, t.dataset.rate);
      move(1);
      return;
    }
    if (t.dataset.rateCase) {
      markStatus(state.caseId, t.dataset.rateCase);
      render();
      return;
    }
    if (t.dataset.action) {
      const a = t.dataset.action;
      if (a === "reveal") {
        state.showAnswer = true;
        render();
      } else if (a === "next") move(1);
      else if (a === "prev") move(-1);
      else if (a === "shuffle") {
        state.shuffled = !state.shuffled;
        rebuildOrder();
        render();
      } else if (a === "shuffle-flash") {
        rebuildFlashOrder(true);
        render();
      } else if (a === "flip") {
        if (flashPointer) {
          const dx = e.clientX - flashPointer.x;
          const dy = e.clientY - flashPointer.y;
          flashPointer = null;
          if (dx * dx + dy * dy > 64) return;
        }
        const body = e.target.closest(".flash-body");
        if (body) {
          const rect = body.getBoundingClientRect();
          if (e.clientX >= rect.right - 16) return;
        }
        flipFlash();
      } else if (a === "reveal-scenarios") {
        document.querySelectorAll(".scenario-item").forEach((el) => el.classList.add("revealed"));
      } else if (a === "reveal-case") {
        state.caseRevealed = true;
        render();
      } else if (a === "back-cases") {
        state.caseId = null;
        state.caseRevealed = false;
        render();
      } else if (a === "reset-progress") {
        if (confirm("確定清除所有學習進度？")) {
          localStorage.removeItem(STORAGE_KEY);
          render();
        }
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea, input")) return;
    if (state.view === "flash") {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flipFlash();
      } else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
    }
  });

  // Init order
  rebuildOrder();
  render();
})();
