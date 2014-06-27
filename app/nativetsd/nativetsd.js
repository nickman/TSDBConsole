/**
 * Console OpenTSDB Native Console WebView Loader
 * Whitehead, 2014
 */ 

document.domain = chrome.runtime.id;
var webView = null;

$(document).ready(function() { 
  
    $('#snap-btn').button({icons: {primary: 'ui-snap-tsd'}}).click(function(e){
      console.info('Taking Snap...');    
      getSnapshotUrl().then(
        function(snap) {
          console.info("Snapshot [%s]", snap); 
          saveSnapshot(snap);
      });
    });

    $('#snapclose-btn').button({icons: {primary: 'ui-close-tsd'}}).click(function(e){
        console.info('Closing Snap...');    
        $('body').children().remove();
    });


    console.info("Popping Dialog")
    $( "#dialog_openNativeConsole" ).dialog({ 
      width: 600, 
      modal: true,    
      closeOnEscape: true, 
      buttons: {
        Load : function() {
          var url = $('#tsdurl').val();
          $( this ).dialog( "close" );        
          loadWebView(url);

        },
        Cancel: function() {
            $( this ).dialog( "close" );
        }
      }
    });
  
});

function getSnapshotUrl() {
  var d = $.Deferred();
  webView.executeScript({code: "$('img.gwt-Image')[0].src"}, function(r) {     
    d.resolve(r[0]);
  });
  return d.promise();
}


function loadWebView(url) {
  console.info("Started WebView Window: [%s]", url);  
  window.addEventListener('message', function(e) {  
    console.info("MESSAGE: %O", e);
  });
  //$('body').append($('<webview id="foo" src="http://localhost:4242/#start=5m-ago&amp;m=sum:sys.cpu%7Bcpu=*,type=combined%7D&amp;o=&amp;yrange=%5B0:%5D&amp;key=out%20right%20top%20box&amp;wxh=1500x300&amp;autoreload=15" style="width:100%; height:100%" name="OpenTSDBWindow"></webview>'))
  $('#tsdwebview').append($('<webview id="tsdwebviewinstance" src="' + url + '" style="width:100%; height:100%" name="OpenTSDBWindow"></webview>'))
    webView = document.getElementById("tsdwebviewinstance");
    $('#activetsdurl').attr('value', url)

    console.info("WebView: %O", webView);      
    var loadstart = function() {
      console.info("Loading WebView Window");
    }
    var loadstop = function() {
      console.info("Loaded WebView Window");
      
      webView.executeScript({file: "/js/jquery/jquery-2.0.3.js"}, function(r) {      
        getSnapshotUrl().then(function(data){
          $('#activetsdurl').attr('value', data);
          console.info("Updated Active TSD URL: [%s]", data);
        }, function() {
          console.error("Failed to get URL: %O", arguments);

        });
      });
      //webView.executeScript({ file: "injects.js" }, function(results) { 
      webView.executeScript({ code: "window.addEventListener('message', function(e) { e.source.postMessage('message', '*'); } ); " }, function(results) { 
        console.info("Inject Results: %O", results); 
        webView.contentWindow.postMessage({msg:'Hello'}, '*');
        //webView.executeScript({ code: "GETIMGSRC()" }, function(results) { console.info("Invoke Results: %O", results); });
      });
    }
    var contentload = function() {
      console.info("ContentLoadeded in WebView Window");
    }

    var loadcommit = function() {
      console.info("LoadCommit in WebView Window");

    }




    var onMessage = function(msg) {
      console.info("MESSAGE: %O", msg);
    }

    webView.addEventListener("loadstart", loadstart);
    webView.addEventListener("loadstop", loadstop);    
    webView.addEventListener("contentload", contentload);    
    webView.addEventListener("loadcommit", loadcommit);    
    webView.addEventListener("message", onMessage);    
    webView.addEventListener("consolemessage", onMessage);    


}


// http://james.padolsey.com/javascript/parsing-urls-with-the-dom/



function saveSnapshot(tsdurl) {
  var dirs = [];
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
              console.error("Failed to save: %s", error);
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
  return $.when(doPersistCategory(category), doPersistSnapshot(category, title, snapshot));
}

function doPersistCategory(category) {
  console.info("Saving Category: [%O]", category);
  return saveItems('OpenTSDB', 'directories', category);
}

function doPersistSnapshot(category, title, snapshot) {
  console.info("Saving Snapshot: [%O]", arguments);
  var key = [category, title, snapshot].join("##")
  var value = {'fullKey': key, 'title': title, 'category': category, 'snapshot': snapshot, 'urlparts' : parseURL(snapshot) };
  return saveItems('OpenTSDB', 'snapshots', value);
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

