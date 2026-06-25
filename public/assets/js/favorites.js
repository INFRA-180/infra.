(function () {
  "use strict";

  const globalObject = typeof window !== "undefined"
    ? window
    : (typeof self !== "undefined" ? self : {});

  const FAVORITES_DB_NAME = "infra_favorites_v1";
  const FAVORITES_DB_STORE = "infra_favorites";
  const FAVORITES_STORAGE_KEY = "infra_favorites_v1_entries";
  const FAVORITES_RESET_VERSION = "audiofix212-20260618";
  const FAVORITES_RESET_STORAGE_KEY = "infra_favorites_reset_version";
  const FAVORITES_RESET_DB_MARKER = "__infra_favorites_reset_audiofix212__";
  const FAVORITES_LEGACY_CATALOG_SEEN_KEY = "infra_favorites_catalog_seen_v1";

  const constants = Object.freeze({
    DB_NAME: FAVORITES_DB_NAME,
    DB_STORE: FAVORITES_DB_STORE,
    STORAGE_KEY: FAVORITES_STORAGE_KEY,
    RESET_VERSION: FAVORITES_RESET_VERSION,
    RESET_STORAGE_KEY: FAVORITES_RESET_STORAGE_KEY,
    RESET_DB_MARKER: FAVORITES_RESET_DB_MARKER,
    LEGACY_CATALOG_SEEN_KEY: FAVORITES_LEGACY_CATALOG_SEEN_KEY
  });

  function createFavoritesStorage(options) {
    const settings = options || {};
    const state = settings.state || {};
    const normalizeEntries = typeof settings.normalizeEntries === "function"
      ? settings.normalizeEntries
      : function (entries) { return Array.isArray(entries) ? entries : []; };
    let dbPromise = null;

    function setDbSupported(value) {
      state.favoritesDbSupported = Boolean(value);
    }

    function isDbSupported() {
      return state.favoritesDbSupported !== false;
    }

    function openDb() {
      if (!isDbSupported()) return Promise.resolve(null);
      if (dbPromise) return dbPromise;
      if (!("indexedDB" in globalObject)) {
        setDbSupported(false);
        return Promise.resolve(null);
      }

      dbPromise = new Promise(function (resolve) {
        let request;
        try {
          request = globalObject.indexedDB.open(FAVORITES_DB_NAME, 1);
        } catch (_err) {
          setDbSupported(false);
          resolve(null);
          return;
        }

        request.onupgradeneeded = function () {
          const db = request.result;
          if (!db.objectStoreNames.contains(FAVORITES_DB_STORE)) {
            const store = db.createObjectStore(FAVORITES_DB_STORE, { keyPath: "path" });
            store.createIndex("added_at", "added_at", { unique: false });
          }
        };
        request.onsuccess = function () {
          resolve(request.result || null);
        };
        request.onerror = function () {
          setDbSupported(false);
          resolve(null);
        };
        request.onblocked = function () {
          resolve(null);
        };
      });

      return dbPromise;
    }

    function withStore(mode, callback) {
      return openDb().then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          let transaction;
          try {
            transaction = db.transaction(FAVORITES_DB_STORE, mode);
            const store = transaction.objectStore(FAVORITES_DB_STORE);
            callback(store, resolve);
          } catch (_err) {
            resolve(null);
          }
        });
      });
    }

    function readLocalEntries() {
      try {
        if (!globalObject.localStorage) return [];
        const raw = globalObject.localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_err) {
        return [];
      }
    }

    function writeLocalEntries(entries) {
      try {
        if (!globalObject.localStorage) return false;
        globalObject.localStorage.setItem(
          FAVORITES_STORAGE_KEY,
          JSON.stringify(normalizeEntries(entries || []))
        );
        return true;
      } catch (_err) {
        return false;
      }
    }

    function persistOrder(entries) {
      const ordered = normalizeEntries(entries || []);
      return withStore("readwrite", function (store, resolve) {
        if (!ordered.length) {
          resolve(true);
          return;
        }
        let pending = ordered.length;
        let failed = false;
        ordered.forEach(function (entry, index) {
          const clean = Object.assign({}, entry, { sort_index: (index + 1) * 1000 });
          let request;
          try {
            request = store.put(clean);
          } catch (_err) {
            failed = true;
            pending -= 1;
            if (pending <= 0) resolve(!failed);
            return;
          }
          request.onsuccess = function () {
            pending -= 1;
            if (pending <= 0) resolve(!failed);
          };
          request.onerror = function () {
            failed = true;
            pending -= 1;
            if (pending <= 0) resolve(false);
          };
        });
      });
    }

    function deleteEntry(path) {
      return withStore("readwrite", function (store, resolve) {
        let request;
        try {
          request = store.delete(path);
        } catch (_err) {
          resolve(false);
          return;
        }
        request.onsuccess = function () { resolve(true); };
        request.onerror = function () { resolve(false); };
      });
    }

    function readResetVersion() {
      try {
        return Boolean(
          globalObject.localStorage &&
          globalObject.localStorage.getItem(FAVORITES_RESET_STORAGE_KEY) === FAVORITES_RESET_VERSION
        );
      } catch (_err) {
        return false;
      }
    }

    function writeResetVersion() {
      try {
        if (!globalObject.localStorage) return false;
        globalObject.localStorage.setItem(FAVORITES_RESET_STORAGE_KEY, FAVORITES_RESET_VERSION);
        globalObject.localStorage.removeItem(FAVORITES_LEGACY_CATALOG_SEEN_KEY);
        return true;
      } catch (_err) {
        return false;
      }
    }

    function replaceStoreWithResetMarker() {
      return withStore("readwrite", function (store, resolve) {
        let clearRequest;
        try {
          clearRequest = store.clear();
        } catch (_err) {
          resolve(false);
          return;
        }
        clearRequest.onerror = function () { resolve(false); };
        clearRequest.onsuccess = function () {
          let markerRequest;
          try {
            markerRequest = store.put({
              path: FAVORITES_RESET_DB_MARKER,
              added_at: 0,
              sort_index: 0
            });
          } catch (_err) {
            resolve(false);
            return;
          }
          markerRequest.onsuccess = function () { resolve(true); };
          markerRequest.onerror = function () { resolve(false); };
        };
      });
    }

    return Object.freeze({
      constants,
      openDb,
      withStore,
      readLocalEntries,
      writeLocalEntries,
      persistOrder,
      deleteEntry,
      readResetVersion,
      writeResetVersion,
      replaceStoreWithResetMarker
    });
  }

  globalObject.InfraFavorites = Object.freeze({
    constants,
    createStorage: createFavoritesStorage
  });
})();
