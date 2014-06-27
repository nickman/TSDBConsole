

var xschema = null;
var executableSchema = null;
var initialized = false;


$(document).ready(function() { 
    console.info("Initializing DB....");
    initDb().then(function(){
      console.info("Initialized DB");
    });
    
});

function reinitDb() {
  initialized = false;
  deleteDatabase('OpenTSDB');
  initDb().then(function(){
    console.info("Initialized DB");
  });  
}

function getJSON(url) {
  var d = $.Deferred();
  var promise = d.promise();

  var uri = url;
  var xhr = new XMLHttpRequest();
  xhr.onerror = function(err) { 
    console.error("Failed to get dbConfig from [" + uri + "]"); 
    d.reject(err);
  },
  xhr.onload = function(data) { 
    var b = data.currentTarget.response;
    d.resolve(b);
  },
  xhr.open('GET', uri, true);
  xhr.send();
  return promise;
}

function deleteDatabase(name) {
  var dbRequest = window.indexedDB.deleteDatabase(name);
  dbRequest.onsuccess = function(evt){ console.info("Database [" + name + "] deleted.") }
  dbRequest.onerror = function(evt){ console.error("Failed to delete Database [" + name + "]: --> Error:[%O]", evt)}
}

function objectStoreFx(name, keyPath, autoIncrement) {
  return function _storefx_(tx) {
    var fxName = "ObjectStoreFunction:" + ([name, keyPath, autoIncrement].join("/"));
    console.info("======== Creating ObjectStore [%s], kp: [%s], autoIncr: [%s] ========", name, keyPath, autoIncrement);
    return objectStoreInstance = tx.createObjectStore(name, {
      keyPath: keyPath,
      autoIncrement: autoIncrement
    });

  }
}

function indexFx(objectStore, indexName, field, unique) {
  return function _indexfx_(tx) {
    var fxName = "IndexFunction:" + ([objectStore, indexName, field, unique].join("/"));
    console.info("======== Creating Index [%s] on store [%s], field: [%s], unique: [%s] ========", indexName, objectStore, field, unique);
    var pr = tx.objectStore(objectStore).createIndex(field, {"unique" : unique, "multiEntry" : false}, indexName); 
    console.info("IndexFX [%O]", pr);
    /*
    pr.then(function(){
      console.info("Completed [%s]", fxName);
    });
    */
    return pr;
  }
}

function dataFx(cfg) {    
  return function _datafx_(tx) {
    var p =executeJson(cfg.commands, {transaction: tx, database: cfg.database, objectstore: cfg.objectstore});
    console.info("JSON Execution Promise: %O", p) ;
    return p;
  }
}


function prepareSchema(config) {
  var schema = {};
  var createdObjectStores = [];
  var DBNAME = config.dbname;
  for(var i = 1; i <= config.version; i++) {
    schema[i] = [];
  }
  for(os in config.objectStores) {    
    var osName = os;
    var osCfg = config.objectStores[os];
    for(v in osCfg.versions) {
      var version = v;
      var cfg = osCfg.versions[v];      
      if(cfg.keyPath) {        
        schema[version].push(objectStoreFx(osName, cfg.keyPath, cfg.autoIncrement));        
      }
      if(cfg.indexes) {
        for(ind in cfg.indexes) {
          var indexName = ind;
          var indexCfg = cfg.indexes[ind];
          schema[version].push(indexFx(osName, indexName, indexCfg.field, indexCfg.unique));
        }
      }
      /*
      if(cfg.commands!=null && $.isArray(cfg.commands) && cfg.commands.length > 0) {                
          console.info("Staging [%s] Data Items for [%s]", cfg.commands.length, osName);
          cfg.database = DBNAME;
          cfg.objectstore = osName;
          schema[version].push(dataFx(cfg));
      }
      */
    }    
  }
  xschema = schema;
  return schema;
}

function isPromise(value) {
    if(value==null) return false;
    if (typeof value.then !== "function") {
        return false;
    }
    var promiseThenSrc = String($.Deferred().then);
    var valueThenSrc = String(value.then);
    return promiseThenSrc === valueThenSrc;
}

function executeSchema(config) {
  console.info("Preparing IndexedDB Upgrade Schema");
  var schema = prepareSchema(config);
  var execSchema = {};
  var maxVersion = config.version;
  for(var version = 1; version <= maxVersion; version++) {
    console.info("Staging [%s] functions for Version [%s]", schema[version].length, version);
    var vx = version;
    var schv = schema[version];
    execSchema[version] = schema[version].length==0 ? function(tx){} : function(tx){    
      console.info("Executing DB Upgrade Stage [%s]", version);        
      var r = null;
      $.each(schv, function(idx, fx){
        console.info("Invoking [%s]", fx.name);
        if(isPromise(r)) {
          r.then(fx(tx));
        } else {
          r = fx(tx);          
        }      
      });  
      //console.info("Schema Execution Promise: %O", r.state());
      return r;
    }
  }
  executableSchema = execSchema;
  return execSchema;
}

function initDb() {
  if(initialized) return;
  var d = $.Deferred();
  var promise = d.promise(); 
  var upgrades = [];
  try {
    var p = getJSON("/js/idb.json").then(function(result){
      var config = JSON.parse(result);
      console.info("Upgrade Config: %O", config);
      var openPromise = $.indexedDB(config.dbname, {
        //"version" : config.version,
        "upgrade" : function(transaction){
          console.info("DB UPGRADE");          
        }        
        ,"schema" : executeSchema(config)
      });      
      openPromise.done(function(db, event){
        console.info("DB Open/Upgrade Complete: [%s]. Upgrades: [%s]", db.name, JSON.stringify(upgrades));
        var promises = [];
        $.each(upgrades, function(vidx, upgradeVersion) {
          $.each(config.objectStores, function(oidx, objectStore) {
            if(objectStore.versions[upgradeVersion]) {
              var cfg = objectStore.versions[upgradeVersion];
              if(cfg.commands) {
                if(cfg.commands.length>0) {
                  console.info("Executing data commands for data store [%s], version [%s]", oidx, upgradeVersion);
                  promises.push(executeJson(cfg.commands, {database: db.name, objectstore: oidx}));
                }
              }
            }
          });
        });
        $.when(promises).then(function(){
          console.info("ALL DB UPGRADES AND DATA OPS COMPLETE");
          d.resolve();
          initialized = true;
        });
      });
      openPromise.progress(function(db, versionChangeEvent){
        console.info("DB Upgrade In Process: version %s --> %s", versionChangeEvent.oldVersion, versionChangeEvent.newVersion);
        upgrades.push(versionChangeEvent.newVersion);
        
      });
      openPromise.fail(function(){
        console.error("DB Upgrade Failed: [%O]", arguments);
      });

    });
    p.then(
      function() { 
        if(d!=null) {
          d.resolve(); 
        } else {
          console.error("No promise to resolve")
        }
      },
      function(event, err) { 
        console.error("initDb error: %O", arguments);
        d.reject(err); 
      }
    );
  } catch (e) {
    d.reject(e);
  }
  return promise;
}


function doInitDb() {
  initDb().then(
    function() {
      console.info("DB Init Complete");
    }
  );
}

function listIndexes(dbn) {
  var op = window.indexedDB.open(dbn);
  var db = null;
  var tx = null;
  op.onsuccess = function(event) {
    try {
      db = event.target.result;
      console.info("DB: %O", db);
      //for(var x = 0, y = db.objectStoreNames.length; x < y; x++) {
      $.each(db.objectStoreNames, function(t, osn) {        
        tx = db.transaction(osn, "readwrite");
        var store = tx.objectStore(osn);
        console.info("Store: %O", store);
        console.group("[DBXInterface] Index Names on DB [%s], ObjectStore [%s], Indexes: [%s]", db.name, store.name, JSON.stringify(store.indexNames));
        for(var x = 0, y = store.indexNames.length; x < y; x++) {
          console.info(store.indexNames[x]);
        }
        console.groupEnd();      
      });
    } finally {
      if(db!=null) try { db.close(); } catch(e) {}
    }
  }
}

// var dbhandler = function(items) { $.each(items, function(index, item) { console.info("Item: [%s]", item.name); }); };
// list({db: "OpenTSDB", ostore: "categories", index: "nameIndex"}).then(dbhandler)
// // var gFilter = function(item) { return item.indexOf("groovy")!=-1; }


function listTest(match) {
  var dbhandler = function(items) { $.each(items, function(index, item) { console.info("Item: [%s]", item.name); }); };
  var gFilter = function(item) { if(item.name==null) return false; return item.name.indexOf(match)!=-1; }
  dbList({db: "OpenTSDB", ostore: "categories", comp: gFilter}).then(dbhandler);
}

function listKeyTest(match) {
  var dbhandler = function(items) { $.each(items, function(index, item) { console.info("Item: [%s]", item.name); }); };
  var gFilter = function(item) { if(item.name==null) return false; return item.name.indexOf(match)!=-1; }
  dbList({db: "OpenTSDB", ostore: "categories", comp: gFilter}, match).then(dbhandler);
}

function dump(dbName, osName) {

}



function list(dbName, osName) {
  var d = $.Deferred();
  var promise = d.promise(); 
  var items = [];
  var iterationPromise = $.indexedDB(dbName)
        .objectStore(osName)
          .each(function(item){
            items.push(item.value);
            d.progress(item.value);
          }); 
  iterationPromise.done(function(result, event){
    if(result==null) {
      d.resolve(items);
    }
  });
    
  return promise;  
}


function dbList(query, keys) {
  // db, ostore, comp, index,  keys
  var values = [];
  var d = $.Deferred();
  var promise = d.promise(); 
  var index = query.index;
  var append = function(item) {
      if(query.comp!=null) {
        try {
          if(query.comp(item.value)) {
            values.push(item.value);  
          }
        } catch (e) {}
      } else {
        values.push(item.value);
      }    
  }
  var iterationPromise = null;
  try {
    if(query.index!=null) {
      // THIS IS BROKEN
      iterationPromise = $.indexedDB(query.db)
        .objectStore(query.ostore)
          .index(query.index)
            .each(append); 
    } else {
      iterationPromise = $.indexedDB(query.db)
        .objectStore(query.ostore)
          .each(append); 
    }
    iterationPromise.done(function(result, event){
      if(result==null) {
        d.resolve(values);
      }
    });
    
    iterationPromise.fail(function(error, event){
      console.error("DB Lookup Failure. error: [%O], event: [%O]", error, event!=null ? event.stack : null);
      d.reject(error, event);
    });
  } catch(e) {
    d.reject(e);
  }
  return promise;
}

function pick(idx) {
  if(arguments.length < 2) return null;
  for(var x = 1, y = arguments.length; x < y; x++) {
    if(arguments[x]!=null) {
      if(arguments[x][idx]!=null) {
        return arguments[x][idx];
      }
    }
  }
  return null;
}

function arr(obj) {
  if(obj==null) return [];
  if($.isArray(obj)) return obj;
  return [obj];
}


// "/js/test-data.json"
// executeJson("/js/test-data.json").then(function(x) { console.info("Complete: [%O]", x); });

function executeJson(src, target) {
  console.info("Executing JSON DB Commands: [%O], target: [%O]", src, target);
  if(src==null) return;
  var url = null;
  if($.isPlainObject(src) || $.isArray(src)) {
    url = window.URL.createObjectURL(new Blob([JSON.stringify(src)], {type: 'text/json'}));
  } else {
    url = src;
  }
  var promises = [];
  getJSON(url).then(function(result){
    try { window.URL.revokeObjectURL(url); } catch (e) {}
    var isArr = $.isArray(result);
    var cmds = JSON.parse(isArr ? result[0] : result);
    var cmdArray = arr(cmds);
    console.info("Processing [%s] JSON DB Commands", cmdArray.length);
    $.each(cmdArray, function(idx, cmd){
      var dbName = pick('database', cmd, target);
      var osName = pick('objectstore', cmd, target);
      if(pick('transaction', target)!=null) {
        promises.push(executeParsedCommands(target.transaction, osName, dbName, cmd));  
      } else {
        if(dbName==null || osName==null) throw "JSON did not contain 'transaction' or 'database' and/or 'objectstore' and none supplied in target";
        
        var txpromise = $.indexedDB(dbName).transaction(osName);
        promises.push(txpromise);
        txpromise.progress(function (tx){
          promises.push(executeParsedCommands(tx, osName, dbName, cmd));  
        });
        txpromise.fail(function (event){
          console.error("Failed to start TX [%O]", event);
        });
        txpromise.done(function (event){
          console.info("Non Upgrade Transaction Completed")
        });

      }
    });
  });
  return $.when(promises);
}

function executeParsedCommands(tx, osName, dbName, commands) {
  try {

    var promises = [];
    var objectStore = tx.objectStore(osName);
    var jcmds = arr(commands);
    $.each(jcmds, function(idx, cmds){
      $.each(arr(cmds), function(idx2, cmd){
        if(!cmd.command && $.isArray(cmd.commands) && cmd.commands.length >0 && cmd.commands[0].command) {
          cmd = cmd.commands[0];
        }
        switch(cmd.command) {
          case "insert":
            console.group("Processing [%s] inserts against [%s/%s]", cmd.data.length, dbName, osName);
            $.each(cmd.data, function(idx, data) {
              console.info("Adding [%s]", JSON.stringify(data));
              promises.push(objectStore.add(data));
            }); 
            console.info("Inserts complete [%s/%s/%s]", cmd.data.length, dbName, osName);
            console.groupEnd();
            break;
          case "delete":
            console.info("Processing [%s] deletes against [%s/%s]", cmd.data.length, dbName, osName);
            $.each(cmd.data, function(idx, data) {
              promises.delete(objectStore.add(data));
            });            
            break;
          case "update":
            throw "Update not supported yet";
            break;
          default:
            console.warn("Unrecognized Command [%s]", cmd.command);
        }
      });
    });      
    return $.when(promises);
  } catch (e) {
    console.error("executeParsedCommands failed: %O", e);
    throw e;
  }
}

function saveItems(dbName, osName, object) {  
  var d = $.Deferred();
  var p = d.promise();
  if(object==null) {
    d.resolve();
  } else {
    var txpromise = $.indexedDB(dbName).transaction(osName);  
    txpromise.progress(function (tx){
        console.group("Saving items to [%s/%s]", dbName, osName);
        var os = tx.objectStore(osName);
        var toSaves = arr(object);
        $.each(toSaves, function(idx, item){
          os.add(item);
          console.info("Saved [%s]", JSON.stringify(item));
        });
    });
    txpromise.fail(function (event){
      console.groupEnd();
      console.error("Failed to start TX [%O]", event);
      d.reject(event.type);
    });
    txpromise.done(function (event){
      console.groupEnd();
      console.info("Save complete");
    });
  }
  return p;
}


// This function creates a new anchor element and uses location
// properties (inherent) to get the desired URL data. Some String
// operations are used (to normalize results across browsers).
// Originally from http://james.padolsey.com/javascript/parsing-urls-with-the-dom/
function parseURL(url) {
    var a =  document.createElement('a');
    a.href = url;
    return {
        source: url,
        protocol: a.protocol.replace(':',''),
        host: a.hostname,
        port: a.port,
        query: a.search,
        params: (function(){
            var ret = {},
                seg = a.search.replace(/^\?/,'').split('&'),
                len = seg.length, i = 0, s;
            for (;i<len;i++) {
                if (!seg[i]) { continue; }
                s = seg[i].split('=');
                ret[s[0]] = s[1];
            }
            return ret;
        })(),
        file: (a.pathname.match(/\/([^\/?#]+)$/i) || [,''])[1],
        hash: a.hash.replace('#',''),
        path: a.pathname.replace(/^([^\/])/,'/$1'),
        relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [,''])[1],
        segments: a.pathname.replace(/^\//,'').split('/')
    };
}

