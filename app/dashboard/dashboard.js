/**
 * Console OpenTSDB Custom Dashboard Editor
 * Whitehead, 2014
 */ 

var dlg = null;

var dlgTitle = 'OpenTSDB Console: Select Chart Snapshot';
var comboCategories = null;
var comboTitles = null;
var contentWindow = null;

/*
var dlgContent = "<div id='dialog_pickSnapshot' style='display: none;'>  \
    <form> \
      <fieldset id='snapshotFieldset'> \
        <label for='category'>Category:</label> \
        <input type='text' name='category' id='category' class='text ui-widget-content ui-corner-all' value='' style='width: 85%'> \
        <br> \
        <label for='title'>Title:</label> \
        <input type='text' name='title' id='title' class='text ui-widget-content ui-corner-all' value='' style='width: 85%'>  \
      </fieldset> \
    </form></div>";
*/



var toolDlg = '<div id="dashboardtoolbar"><ul><li><a id="nativechart-btn" style="cursor: pointer; color: #333;">Native Chart</a></li></ul></div>';
    
  



document.domain = chrome.runtime.id;
$(document).ready(function() { 
  //$('#dashboardcontainer').empty().append($('<iframe id="sandboxDashboard" src="' + chrome.runtime.getURL("/app/dashboard/sandbox-dashboard.html") + '"></iframe>')
  var iframeSrc = '<iframe id="sandboxDashboard" src="' + chrome.runtime.getURL("/app/dashboard/sandbox-dashboard.html") + '" width="' + $(window).width() + '" height="' + $(window).height() + '"></iframe>';
  $('#dashboardcontainer').empty().height($(window).height).width($(window).width).append(iframeSrc);
  contentWindow = $('#sandboxDashboard')[0].contentWindow;
  $('#sandboxDashboard').height($(window).height()).width($(window).width());
  console.info("IFRAME: [%s]", iframeSrc);
  
  //registerImageHandler();
  makeDialog();
	$('#tabs').append($('#dashboardtoolbar'));
  $( toolDlg ).dialog({
    
  }).draggable().resizable();

	$('#nativechart-btn').button({icons: {primary: 'ui-icon-tsd'}})
		.click(function(e){
  		console.info("Adding Native Chart");
  		pickSnapshot();
  	});


});

function makeDialog() {
  if(dlg==null) {
    dlg = "";
    $.get("/app/dashboard/pickSnapshotDialog.html", function(dlgContent){
      // dialog_pickSnapshot
      
      dlg = $(dlgContent).filter("#dialog_pickSnapshot").dialog({
        title: dlgTitle,
        autoOpen: false,
        closeOnEscape: true,
        modal: true,
        width: $(window).width()/2,
        height: 'auto',
        position: ['center', 'center'],
        create: function(event, ui) {
          dbList({db: "OpenTSDB", ostore: "directories"}).then(function(cats){
            $.each(cats, function(index, cat) {
              var itemval= '<option value="' + cat.name + '">' + cat.name + '</option>';
              $("#psCatList").append(itemval);
            });
          });
          $("#psCatList").on( "select", function(){
            var selectedCat = $("#psCatList option:selected").text();
            if(selectedCat==null || selectedCat=="") return;
            $("#psTitleList").empty();
            var filter = function(item) {
              return (item.category==selectedCat);
            }
            dbList({db: "OpenTSDB", ostore: "snapshots", comp: filter}).then(function(shots){
              $.each(shots, function(index, shot) {
                var itemval= '<option value="' + cat.category + '">' + cat.category + '</option>';
                $("#psTitleList").append(itemval);
              });
            });

          });
        },
        open:  function(event, ui) {
          //clearBoth();
          //popDirectories();
          $("#psCatList").width("90%");
          $("#psTitleList").width("90%");
          $("#psCatFilter").width("90%");
          $("#psTitleFilter").width("90%");

        },
        buttons: {
          Go : function() {
            $('#dialog_saveSnapshotErr').remove();
            addNativeChart($('#category').val(), $('#title').val());
            $( this ).dialog( "close" );
          },
          Cancel: function() {
              $('#dialog_saveSnapshotErr').remove();
              $( this ).dialog( "close" );
          }
        }      
      });

    });
  }
}

function addNativeChart(directory, title) {
  console.info("Adding Native Chart [%s / %s]", directory, title);
  var snapshot = null;
  var iterationPromise  = $.indexedDB("OpenTSDB").objectStore("snapshots").each(function(item){
    if(item.value.category==directory && item.value.title==title) {
      snapshot = item.value;
    }
  });
  iterationPromise.done(function(result, event){
    if(result==null) {
      if(snapshot!=null) {
        console.info("Inserting dashboard [%O]", snapshot);
        var def = {
          data: snapshot,
          type: "newtile",
          widgetTitle: snapshot.title, 
          widgetId: "id" + snapshot.id,       
          imgUrl: snapshot.snapshot,
          imgId: ("img" + ("id" + snapshot.id)),
          widgetContent: "<img id='" + ("img" + ("id" + snapshot.id)) + "' src='/img/loading.gif'>"
        };
        contentWindow.postMessage(def, "*");
      }
    }
  }); 


}


function clearBoth() {
  clearDirs();
  clearTitles();  
}

function clearDirs() {
  $('#category').val("");
  comboCategories.setSelectOptions([]);
}

function clearTitles() {
  $('#title').val("");
  comboTitles.setSelectOptions([]);
}

function pickSnapshot() {
  dlg.dialog("open");

}

function popDirectories() {
  var dirs = [];
  var iterationPromise  = $.indexedDB("OpenTSDB").objectStore("directories").each(function(item){
    dirs.push(item.value.name);
  });
  iterationPromise.done(function(result, event){
    if(result==null) {
      console.info("Retrieved Directories: [%O]", dirs);
      comboCategories.setSelectOptions(dirs);
      if(dirs.length>0) {
        $('#category').val(dirs[0]);
        popTitles(dirs[0]);
      }
    }
  }); 
}

function popTitles(directory) {
  var titles = [];
  $('#title').val('');
  var iterationPromise  = $.indexedDB("OpenTSDB").objectStore("snapshots").each(function(item){
    if(item.value.category==directory) {
      titles.push(item.value.title);
    }
  });
  iterationPromise.done(function(result, event){
    if(result==null) {
      console.info("Retrieved Titles: [%O]", titles);
      comboTitles.setSelectOptions(titles);
/*
      if(titles.length>0) {
        $('#title').val(titles[0]);
      }
*/      
    }
  }); 
}



/*
    var x = { 
        widgetTitle : "System CPU Summary", //Title of the widget
        widgetId: "id008", //unique id for the widget
        imgUrl: "http://localhost:8080/q?start=5m-ago&ignore=2550&m=sum:sys.cpu%7Bcpu=*,type=combined%7D&o=&yrange=%5B0:%5D&wxh=500x300&png" //content for the widget

    }
        var handle = null;
        function go() {
          $("#dashplate").sDashboard("addWidget", { widgetTitle: "System CPU Summary", widgetId: "id008", widgetContent: "<div id='id008img'>"});
          var remoteImage = new RAL.RemoteImage({ src: "http://opentsdb:8080/q?start=5m-ago&ignore=3380&m=sum:sys.cpu%7Bcpu=*,type=combined,host=PP-WK-NWHI-01%7D&o=&yrange=%5B0:%5D&nokey&wxh=500x300&png", width: 377, height: 190});        
          var container = document.querySelector('#id008img');        
          container.appendChild(remoteImage.element);
          //RAL.Queue.add(remoteImage, false);
          handle = RAL.Queue.start();
        }

        function go() {
          $("#dashplate").sDashboard("addWidget", { widgetTitle: "System CPU Summary", widgetId: "id008", widgetContent: "<img id='id008img' src='" + x.imgUrl+ "'>"});
          var remoteImage = new RAL.RemoteImage({ src: "http://opentsdb:8080/q?start=5m-ago&ignore=3380&m=sum:sys.cpu%7Bcpu=*,type=combined,host=PP-WK-NWHI-01%7D&o=&yrange=%5B0:%5D&nokey&wxh=500x300&png", width: 377, height: 190});        
          var container = document.querySelector('#id008img');        
          container.appendChild(remoteImage.element);
          //RAL.Queue.add(remoteImage, false);
          handle = RAL.Queue.start();
        }


    
    function blob() {
      $("#dashplate").sDashboard("addWidget", { widgetTitle: "System CPU Summary", widgetId: "id008", widgetContent: "<img id='id008img' src='/img/loading.gif'>"});
      var url = "http://localhost:8080/q?start=5m-ago&ignore=9&m=sum:sys.cpu%7Bcpu=*,type=combined%7D&o=&yrange=%5B0:%5D&nokey&wxh=377x180&png";
      var xhr = new XMLHttpRequest();

      xhr.onerror = function() { console.error(arguments); },
      xhr.onload = function(data) { 
        var blob = data.currentTarget.response;
        console.info("Blob Retrieved: [%O]", blob);         
        var img = $('#id008img')[0];
        window.URL.revokeObjectURL(img.src);
        img.src = window.URL.createObjectURL(blob);
      },
      xhr.open('GET', url, true);
      xhr.responseType = "blob";
      xhr.send();

    }

-webkit-transform: scale3d(1,1,1);

chrome.alarms.create("alarm1", {name: "alarm1", scheduledTime: (Date.now() + 10000)});

function handle(msg, sender, sendFunction) {
  
}

chrome.runtime.onMessage.addListener(

//var remoteImage = new RAL.RemoteImage("http://opentsdb:8080/q?start=5m-ago&ignore=3380&m=sum:sys.cpu%7Bcpu=*,type=combined,host=PP-WK-NWHI-01%7D&o=&yrange=%5B0:%5D&nokey&wxh=500x300&png");        

    }
]
*/
