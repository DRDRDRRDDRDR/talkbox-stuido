/**
 * storage.js - IndexedDB 持久化存储
 */
window.TalkboxStudio = window.TalkboxStudio || {};

(function() {
  var DB_NAME = 'talkbox-studio';
  var DB_VERSION = 1;
  var STORE_PROJECTS = 'projects';
  var STORE_RECORDINGS = 'recordings';
  var db = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (db) return resolve(db);
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_PROJECTS)) d.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        if (!d.objectStoreNames.contains(STORE_RECORDINGS)) d.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  }

  function tx(storeName, mode) {
    return openDB().then(function(d) { return d.transaction(storeName, mode).objectStore(storeName); });
  }

  TalkboxStudio.Storage = {
    saveProject: function(project) {
      var now = Date.now();
      if (!project.id) project.id = 'proj_' + now;
      project.updatedAt = now;
      return tx(STORE_PROJECTS, 'readwrite').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.put(project);
          req.onsuccess = function() { resolve(project.id); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    loadProject: function(id) {
      return tx(STORE_PROJECTS, 'readonly').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.get(id);
          req.onsuccess = function() { resolve(req.result || null); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    listProjects: function() {
      return tx(STORE_PROJECTS, 'readonly').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.getAll();
          req.onsuccess = function() { resolve(req.result || []); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    deleteProject: function(id) {
      return tx(STORE_PROJECTS, 'readwrite').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.delete(id);
          req.onsuccess = function() { resolve(); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    saveRecording: function(blob, name) {
      var id = 'rec_' + Date.now();
      return tx(STORE_RECORDINGS, 'readwrite').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.put({ id: id, name: name || '录音_' + new Date().toLocaleString(), blob: blob, createdAt: Date.now() });
          req.onsuccess = function() { resolve(id); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    getRecording: function(id) {
      return tx(STORE_RECORDINGS, 'readonly').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.get(id);
          req.onsuccess = function() { resolve(req.result || null); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    listRecordings: function() {
      return tx(STORE_RECORDINGS, 'readonly').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.getAll();
          req.onsuccess = function() { resolve(req.result || []); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    },

    deleteRecording: function(id) {
      return tx(STORE_RECORDINGS, 'readwrite').then(function(store) {
        return new Promise(function(resolve, reject) {
          var req = store.delete(id);
          req.onsuccess = function() { resolve(); };
          req.onerror = function(e) { reject(e.target.error); };
        });
      });
    }
  };
})();