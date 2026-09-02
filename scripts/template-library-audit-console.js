(() => {
  const PROJECT_REF = "pnbllxdlskljcakyaylt";
  const AUDIT_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/template-library-audit`;
  const STATE_KEY = "tayar-template-library-audit-v1";

  function readAuth() {
    const raw = localStorage.getItem("tayar-auth");
    if (!raw) throw new Error("Tayar login session not found");

    const session = JSON.parse(raw);
    const token = session?.access_token;
    if (!token) throw new Error("Tayar access token not found");
    return token;
  }

  function freshState() {
    return {
      status: "idle",
      offset: 0,
      total: null,
      scanned: 0,
      valid: 0,
      invalid: 0,
      missing: 0,
      issues: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return freshState();
    try {
      return { ...freshState(), ...JSON.parse(raw) };
    } catch {
      return freshState();
    }
  }

  function saveState(state) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  async function post(body) {
    const response = await fetch(AUDIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${readAuth()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Audit returned invalid JSON (HTTP ${response.status})`);
    }

    if (!response.ok) {
      throw new Error(data?.error || `Audit failed (HTTP ${response.status})`);
    }

    return data;
  }

  async function run() {
    let state = loadState();
    if (state.status === "running") {
      console.log("Resuming previous template audit.");
    }

    state.status = "running";
    saveState(state);

    try {
      while (state.status === "running") {
        const page = await post({ offset: state.offset, limit: 8 });

        state.total = Number(page.total || 0);
        state.scanned += Number(page.scanned || 0);
        state.valid += Number(page.valid || 0);
        state.invalid += Number(page.invalid || 0);
        state.missing += Number(page.missing || 0);
        state.issues.push(...(page.issues || []));
        state.offset = page.nextOffset === null ? state.offset : Number(page.nextOffset);
        if (state.issues.length > 2000) {
          state.issues = state.issues.slice(-2000);
        }

        if (page.nextOffset === null) {
          state.status = "completed";
        }

        saveState(state);
        console.log("Tayar template audit progress", {
          status: state.status,
          scanned: state.scanned,
          total: state.total,
          valid: state.valid,
          invalid: state.invalid,
          missing: state.missing,
          issueSamples: state.issues.slice(-10),
        });

        if (page.nextOffset === null) break;
      }

      return state;
    } catch (error) {
      state.status = "paused";
      saveState(state);
      console.error("Tayar template audit paused:", error);
      throw error;
    }
  }

  window.TayarTemplateAudit = {
    start: run,
    resume: run,
    pause() {
      const state = loadState();
      state.status = "paused";
      saveState(state);
      console.log("Template audit pause requested.");
    },
    reset() {
      localStorage.removeItem(STATE_KEY);
      console.log("Template audit state reset.");
    },
    status() {
      const state = loadState();
      console.log(state);
      return state;
    },
  };

  console.log(
    "Tayar template audit loaded. Use TayarTemplateAudit.start(), status(), pause(), resume(), or reset().",
  );
})();
