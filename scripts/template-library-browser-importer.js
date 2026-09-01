(() => {
  const PROJECT_REF = "pnbllxdlskljcakyaylt";
  const ROOT_FOLDER_ID = "1NLQlCySD88ZbeHt6E2q88c4FsvHzfzBi";
  const ROOT_PATH = "office-11000";
  const STATE_KEY = "tayar-template-import-24billions-v2";
  const DISCOVER_URL =
    `https://${PROJECT_REF}.supabase.co/functions/v1/template-library-drive-discover`;
  const SYNC_URL =
    `https://${PROJECT_REF}.supabase.co/functions/v1/template-library-sync`;
  const PAGE_SIZE = 120;
  const SYNC_BATCH_SIZE = 2;
  const MAX_FAILURES_TO_KEEP = 200;
  const ALLOWED_FORMATS = new Set([
    "xlsx", "xls", "csv",
    "docx", "doc",
    "pptx", "ppt",
    "pdf", "pbix",
    "zip", "txt",
    "png", "jpg", "jpeg",
    "unknown",
  ]);

  let running = false;

  function readAuth() {
    const raw = localStorage.getItem("tayar-auth");
    if (!raw) throw new Error("Tayar login session not found");

    const session = JSON.parse(raw);
    const token = session?.access_token;
    if (!token) throw new Error("Tayar access token not found");
    return token;
  }

  function defaultState() {
    return {
      version: 2,
      status: "idle",
      queue: [{ id: ROOT_FOLDER_ID, path: ROOT_PATH, offset: 0 }],
      seenFolderIds: [ROOT_FOLDER_ID],
      stats: {
        pages: 0,
        processedFolders: 0,
        discoveredFiles: 0,
        discoveredFolders: 0,
        imported: 0,
        skipped: 0,
        reused: 0,
        failed: 0,
        bytesImported: 0,
      },
      failures: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();

    try {
      const parsed = JSON.parse(raw);
      return parsed?.version === 2 ? parsed : defaultState();
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function addFailure(state, failure) {
    state.failures.push({
      ...failure,
      at: new Date().toISOString(),
    });
    if (state.failures.length > MAX_FAILURES_TO_KEEP) {
      state.failures.splice(0, state.failures.length - MAX_FAILURES_TO_KEEP);
    }
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
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
      throw new Error(`HTTP ${response.status}: invalid JSON response`);
    }

    if (!response.ok) {
      const message = data?.error || `HTTP ${response.status}`;
      const error = new Error(message);
      error.httpStatus = response.status;
      throw error;
    }

    return data;
  }

  function categoryFor(file) {
    const format = String(file?.format || "").toLowerCase();
    if (["xlsx", "xls", "csv"].includes(format)) return "spreadsheets";
    if (["docx", "doc", "txt"].includes(format)) return "documents";
    if (["pptx", "ppt"].includes(format)) return "presentations";
    if (format === "pbix") return "power-bi";
    if (format === "pdf") return "pdf";
    if (format === "zip") return "bundles";
    if (["png", "jpg", "jpeg"].includes(format)) return "images";
    return "office-bundle";
  }

  function isSystemJunkFile(name) {
    const value = String(name || "").trim().toLowerCase();
    return value === ".ds_store"
      || value === "thumbs.db"
      || value === "desktop.ini"
      || value.startsWith("._");
  }

  function normalizeFiles(files) {
    return (files || []).filter((file) =>
      file?.id
      && file?.downloadUrl
      && file?.name
      && !isSystemJunkFile(file.name)
      && ALLOWED_FORMATS.has(String(file.format || "unknown").toLowerCase())
    );
  }

  function isSystemJunkFailure(failure) {
    if (isSystemJunkFile(failure?.file)) return true;
    return Array.isArray(failure?.files)
      && failure.files.length > 0
      && failure.files.every((name) => isSystemJunkFile(name));
  }

  function summarizeState(state) {
    const systemFailures = (state.failures || []).filter(isSystemJunkFailure);
    const realFailures = (state.failures || []).filter((failure) => !isSystemJunkFailure(failure));

    return {
      status: state.status,
      queueRemaining: state.queue.length,
      pages: state.stats.pages,
      processedFolders: state.stats.processedFolders,
      discoveredFiles: state.stats.discoveredFiles,
      discoveredFolders: state.stats.discoveredFolders,
      imported: state.stats.imported,
      skipped: state.stats.skipped,
      reused: state.stats.reused,
      failed: state.stats.failed,
      bytesImported: state.stats.bytesImported,
      systemFailureCount: systemFailures.length,
      realFailureCount: realFailures.length,
      realFailures,
      updatedAt: state.updatedAt,
    };
  }

  function enqueueFolders(state, folders) {
    const seen = new Set(state.seenFolderIds);
    for (const folder of folders || []) {
      if (!folder?.id || seen.has(folder.id)) continue;
      state.queue.push({
        id: folder.id,
        path: folder.path || folder.name || "folder",
        offset: 0,
      });
      state.seenFolderIds.push(folder.id);
      seen.add(folder.id);
      state.stats.discoveredFolders += 1;
    }
  }

  async function syncBatch(state, folder, files) {
    const assets = files.map((file) => ({
      title: file.name,
      category: categoryFor(file),
      format: file.format || "unknown",
      sourcePageUrl: `https://drive.google.com/drive/folders/${folder.id}`,
      downloadUrl: file.downloadUrl,
      filename: file.name,
    }));

    try {
      const result = await postJson(SYNC_URL, {
        label: "24billions-office-11000-recursive-import",
        assets,
      });

      state.stats.imported += Number(result.imported || 0);
      state.stats.skipped += Number(result.skipped || 0);
      state.stats.reused += Number(result.reused || 0);
      state.stats.failed += Number(result.failed || 0);
      state.stats.bytesImported += Number(result.bytesImported || 0);

      for (const entry of result.results || []) {
        if (entry?.status === "failed") {
          addFailure(state, {
            type: "asset",
            folderId: folder.id,
            folderPath: folder.path,
            id: entry.id || null,
            file: entry.title || "Unknown template",
            sourceDownloadUrl: entry.sourceDownloadUrl || "",
            error: entry.error || "Import failed",
          });
        }
      }
    } catch (error) {
      const httpStatus = Number(error?.httpStatus || 0);
      if (httpStatus === 401 || httpStatus === 403) throw error;

      state.stats.failed += files.length;
      addFailure(state, {
        type: "batch",
        folderId: folder.id,
        folderPath: folder.path,
        files: files.map((file) => file.name),
        error: error instanceof Error ? error.message : "Batch import failed",
      });
    }

    saveState(state);
  }

  async function run() {
    if (running) {
      console.log("Tayar template importer is already running.");
      return;
    }

    running = true;
    let state = loadState();

    if (state.status === "completed") {
      console.log("Import is already completed. Use TayarTemplateImport.reset() to start over.");
      running = false;
      return;
    }

    state.status = "running";
    saveState(state);

    try {
      while (state.queue.length > 0) {
        state = loadState();
        if (state.status === "paused") break;

        const folder = state.queue[0];

        let discovery;
        try {
          discovery = await postJson(DISCOVER_URL, {
            folderId: folder.id,
            path: folder.path,
            offset: folder.offset || 0,
            pageSize: PAGE_SIZE,
          });
        } catch (error) {
          state.status = "paused";
          addFailure(state, {
            type: "folder",
            folderId: folder.id,
            folderPath: folder.path,
            offset: folder.offset || 0,
            error: error instanceof Error ? error.message : "Folder discovery failed",
          });
          saveState(state);
          throw error;
        }

        state.stats.pages += 1;
        const files = normalizeFiles(discovery.files);
        state.stats.discoveredFiles += files.length;
        enqueueFolders(state, discovery.folders);

        // Persist discovery progress immediately. This is essential for folders
        // that contain only subfolders and no direct files.
        saveState(state);

        for (let index = 0; index < files.length; index += SYNC_BATCH_SIZE) {
          state = loadState();
          if (state.status === "paused") break;

          const batch = files.slice(index, index + SYNC_BATCH_SIZE);
          await syncBatch(state, folder, batch);
        }

        state = loadState();
        if (state.status === "paused") break;

        const currentIndex = state.queue.findIndex((item) => item.id === folder.id);
        if (currentIndex === -1) {
          throw new Error("Importer queue lost the current folder state");
        }

        if (discovery.nextOffset !== null && discovery.nextOffset !== undefined) {
          state.queue[currentIndex].offset = discovery.nextOffset;
        } else {
          state.queue.splice(currentIndex, 1);
          state.stats.processedFolders += 1;
        }

        saveState(state);

        console.log("Tayar import progress — folder page completed", {
          currentFolder: folder.path,
          queueRemaining: state.queue.length,
          ...state.stats,
        });
      }

      state = loadState();
      if (state.queue.length === 0) {
        state.status = "completed";
        saveState(state);
        console.log("FULL TAYAR TEMPLATE IMPORT COMPLETED", summarizeState(state));
      } else if (state.status === "paused") {
        console.log("Tayar template import paused.", state.stats);
      }
    } catch (error) {
      state = loadState();
      state.status = "paused";
      saveState(state);
      console.error("Tayar template import paused after an error:", error);
    } finally {
      running = false;
    }
  }

  window.TayarTemplateImport = {
    start: run,
    resume: run,
    pause() {
      const state = loadState();
      state.status = "paused";
      saveState(state);
      console.log("Pause requested. The current request will finish first.");
    },
    status() {
      const state = loadState();
      console.log(state);
      return state;
    },
    summary() {
      const summary = summarizeState(loadState());
      console.log("Tayar template import summary", summary);
      return summary;
    },
    reset() {
      if (running) {
        throw new Error("Pause the importer before resetting it");
      }
      const state = defaultState();
      saveState(state);
      console.log("Tayar template importer reset.", state);
      return state;
    },
  };

  console.log(
    "TayarTemplateImport ready. Use .start(), .status(), .summary(), .pause(), or .resume().",
  );
})();
