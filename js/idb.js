

var xschema = null;
var executableSchema = null;
var initialized = false;

$(document).ready(function() { 
    console.info("Initializing DB....");
    initDb();
    console.info("Initialized DB");
});

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

function dataFx(objectStore, data) {    
  return function _datafx_(tx) {
    

    var promise = null;
    for(index in data) {
      if(data[index]!=null) {        
        if(promise==null) {
          promise = tx.objectStore(objectStore).add(data[index]);
        } else {
          promise.then(tx.objectStore(objectStore).add(data[index]));
        }
        console.info("Added data to store [%s] --> [%s]", objectStore, JSON.stringify(data[index]));
      }
    }
    return promise;
  }
}


function prepareSchema(config) {
  var schema = {};
  var createdObjectStores = [];
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
      if(cfg.commands!=null) {                
          console.info("[Data] for [%s], Items: [%s]", osName, cfg.commands.length);
          schema[version].push(dataFx(osName, cfg.commands));
      }
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
  var schema = prepareSchema(config);
  var execSchema = {};
  var maxVersion = config.version;
  for(var version = 1; version <= maxVersion; version++) {
    console.info("Staging [%s] functions for Version [%s]", schema[version].length, version);
    var vx = version;
    var schv = schema[version];
    execSchema[version] = schema[version].length==0 ? function(tx){} : function(tx){          
      var r = null;
      for(f in schv) {
        var fx = schv[f];        
        if(isPromise(r)) {
          r.then(fx(tx));
        } else {
          r = fx(tx);          
        }      
      }
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
  try {
    var p = getJSON("/js/idb.json").then(function(result){
      var config = JSON.parse(result);
      var schema = executeSchema(config);
      var openPromise = $.indexedDB(config.dbname, {
        "version" : config.version,
        "upgrade" : function(transaction){
          console.info("DB UPGRADE: [%O]", arguments);          
        }        
        ,"schema" : schema
      });
      openPromise.done(function(){
        console.info("DB Open/Upgade Complete: [%O]", arguments);
        d.resolve();
        initialized = true;
      });
      openPromise.progress(function(){
        console.info("DB Upgrade In Process: [%O]", arguments);
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


// "/js/test-data.json"
// executeJson("/js/test-data.json").then(function(x) { console.info("Complete: [%O]", x); });

function executeJson(src, target) {
  if(src==null) return;
  var url = null;
  if($.isPlainObject(src)) {
    url = window.URL.createObjectURL(new Blob([JSON.stringify(src)], {type: 'text/json'}));
  } else {
    url = src;
  }
  var promises = [];
  getJSON(url).then(function(result){
    try { window.URL.revokeObjectURL(url); } catch (e) {}
    var dbName = null;
    var osName = null;
    var isArr = $.isArray(result);
    var cmds = JSON.parse(isArr ? result[0] : result);
    // cmds could be an array
    var cmdArray = null;
    if($.isArray(cmds)) {
      cmdArray = cmds;
    } else {
      cmdArray = [cmds];
    }
    console.info("Processing [%s] JSON DB Commands", cmdArray.length);
    $.each(cmdArray, function(idx, cmd){
      if(cmd.database==null) {
        if(target==null || target.database==null || target.objectstore==null || ) throw "JSON did not contain 'database' and/or 'objectstore' and none supplied in target";
        dbName = target.database;
        osName = target.objectstore;
      } else {
        dbName = cmd.database;
        osName = cmd.objectstore;
      }
      promises.push(executeParsedCommands(dbName, osName, cmd));
    });
  });
  return $.when(promises);
}

function executeParsedCommands(dbName, osName, commands) {
  var transactionPromise = $.indexedDB(dbName).transaction(osName);  
  transactionPromise.done(function(event){
    console.info("Commands TX Complete: [%O]", event);
  });

  var promises = [transactionPromise];
  transactionPromise.progress(function(tx){
    var objectStore = tx.objectStore(osName);
    $.each(commands.commands, function(idx, cmd){
        switch(cmd.command) {
          case "insert":
            console.group("Processing [%s] inserts against [%s/%s]", cmd.data.length, dbName, osName);
            $.each(cmd.data, function(idx, data) {
              //console.info("Adding [%s]", JSON.stringify(data));
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
}


/*
function executeParsedCommands(dbName, osName, commands) {
  var transactionPromise = $.indexedDB(dbName).transaction(osName);  
  transactionPromise.done(function(event){
    console.info("Commands TX Complete: [%O]", event);
  });

  var promises = [transactionPromise];
  transactionPromise.progress(function(tx){
    var objectStore = tx.objectStore("objectStoreName");
    $.each(commands.commands, function(idx, cmd){
        switch(cmd.command) {
          case "insert":
            console.info("Processing [%s] inserts against [%s/%s]", cmd.data.length, dbName, osName);
            $.each(cmd.data, function(idx, data) {
              promises.add(objectStore.add(data));
            }); 
            console.info("Inserts complete [%s/%s/%s]", cmd.data.length, dbName, osName);
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
}

 */


/*

{
  "dbname": "OpenTSDB",
  "version" : 1,
  "objectStores" : {
    "directories" : {
      "versions" : {
        "1" : {
          "keyPath" : "id",
          "autoIncrement" : true,
              "indexes" : {
                "nameIndex" : {
                  "field" : "name",
                  "unique" : true
                }           
            },
            "commands" : [
              {
                "command" : "insert",
                "data" : [
                  {"name" : "Default"}
                ]
              }
            ]

[
  {
    "database" : "OpenTSDB",
    "objectstore" : "directories",
    "commands" : [
      {
        "command" : "insert",
        "data" : [
            {"name" : "java.runtime.name"},
            {"name" : "sun.boot.library.path"},
            {"name" : "java.vm.version"},
            {"name" : "java.vm.vendor"},
            {"name" : "java.vendor.url"},
            {"name" : "path.separator"},


*/


function saveSnapshot(tsdurl) {
  var dirs = [];
  var iterationPromise  = $.indexedDB("OpenTSDB").objectStore("directories").each(function(item){
    dirs.push(item.value.name);
  });
  iterationPromise.done(function(result, event){
    if(result==null) {
      console.info("Retrieved Directories: [%O]", dirs);
    }
  });

  var dlg = $( "#dialog_saveSnapshot" ).dialog({ 
    width: 900, 
    height: 300,
    modal: true,    
    closeOnEscape: true, 
    buttons: {
      Save : function() {
        $('#dialog_saveSnapshotErr').remove();
        var self = this;
        try {
          persistSnapshot($('#dialog_saveSnapshot')).then(
            function() {
              // Complete
              $.jGrowl("Snapshot Saved")
              $( self ).dialog( "close" );              
            },
            function(error, event) {
              // Error
            }
          );          
        } catch (errors) {

            var msg = "<div id='dialog_saveSnapshotErr'><font color='red'>ERROR:<ul>";
            if($.isArray(errors)) {
              $.each(errors, function(index, m) {
                msg += "<li>" + m + "</li>";
              });
            } else {
              console.error("Save Snapshot Error: %O", errors);
              msg += "<li>" + errors.message + "<ul><li>" + errors.stack + "</li></ul></li>";
            }
            msg += "</ul></font></div>";
            $('#dialog_saveSnapshot').append(msg);   
            msg = null;         
        }
      },
      Cancel: function() {
          $('#dialog_saveSnapshotErr').remove();
          $( this ).dialog( "close" );
      }
    }
  });
  console.info("Save Dialog: %O", dlg);
  $('#snapshot').val(decodeURIComponent(tsdurl));
  $('#category').combobox(dirs);

}



function persistSnapshot() {
  // title, category, snapshot
  var errors = [];
  var title = $('#title').val();  
  if(title==null || title.trim()=="") {
    errors.push("Title was empty");
  }
  var category = $('#category').val();
  if(category==null || category.trim()=="") {
    errors.push("Directory was empty");
  }
  var snapshot = $('#snapshot').val();
  if(snapshot==null || snapshot.trim()=="") {
    errors.push("Snapshot was empty");
  }
  if(errors.length > 0) {
    throw(errors);
  }
  return doPersistCategory(category).then(doPersistSnapshot(category, title, snapshot))
}

function doPersistCategory(category) {
  console.info("Saving Category: [%O]", category);
  var d = $.Deferred();
  var promise = d.promise();
  var objectStore = $.indexedDB("OpenTSDB").objectStore("directories");
  objectStore.get(category).done(function(x) {
    if(x==null) {
      var addPr = objectStore.add({name: category});
        addPr.done(function(){
          d.resolve();
        });
        addPr.fail(function(error, event){
          console.error("Failed to save category: %O - %O", error, event);
          d.reject(error);
        });      
    } else {
      d.resolve();
    }
  });
  return promise;
}

function doPersistSnapshot(category, title, snapshot) {
  console.info("Saving Snapshot: [%O]", arguments);
  var d = $.Deferred();
  var promise = d.promise();
  var key = [category, title, snapshot].join("##")
  var objectStore = $.indexedDB("OpenTSDB").objectStore("snapshots");
  objectStore.get(key).done(function(x) {
    if(x==null) {
      var value = {'fullKey': key, 'title': title, 'category': category, 'snapshot': snapshot, 'urlparts' : parseURL(snapshot) };
      var addPr = objectStore.add(value);
        addPr.done(function(){
          console.info("Saved Snapshot [%s]", key);
          d.resolve();
        });
        addPr.fail(function(error, event){
          console.error("Failed to save snapshot: %O", error);
          d.reject(error);
        });      
    } else {
      d.resolve();
    }
  });
  return promise;
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

