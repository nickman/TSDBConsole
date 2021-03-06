var cstatus_icons = [
  "/img/red-light-16X16.png",
  "/img/amber-light-16X16.png",
  "/img/green-light-16X16.png"
];

document.domain = chrome.runtime.id;

function loadApp(appName) {
  var appId = appName + "_app";
  var uri = '/app/' + appName + '/' + appName + '.html';
  console.info('Loading App [%s]', uri);

  /*
  $.get( chrome.runtime.getURL(uri), function( data ) {  
    $( "#desktop_content" ).html( data ).css('display', 'block').css('width', '90%').css('height', '90%');
  });
*/

  var h = $('#desktop_content').height(), w = $('#desktop_content').width();
  $('#desktop_content').empty().append($('<iframe id="' + appId + '" src="' + chrome.runtime.getURL(uri) + '"></iframe>')
    //.css('display', 'block')
    .css('width', w)
    .css('height', h)); //.width($('#desktop_content').width()));
  
}

function appNewWindow(appName) {
  var appId = appName + "_app";
  var uri = '/app/' + appName + '/' + appName + '.html';
  console.info('Opening App [%s]', uri);
  chrome.app.window.create(uri, {id:"dashboardEditor"});
}


function buildApp(appName) {
  $('#desktop_content').empty();
  var appId = appName + "_app";
  var uri = '/app/' + appName + '/' + appName + '.html';
  console.info('Building App [%s]', uri);
  $.get(chrome.runtime.getURL(uri), function(data){
    $('#desktop_content').append($(data));
  });

}

function loadWebView(appName) {    
  console.info('Loading WebView [%s]', appName);

}


function initialize() {
  $('body').layout({ applyDemoStyles: true, showErrorMessages: false, showDebugMessages: false, noAlert: true });
  // ====================================
  //	Buttons
  // ====================================
  //$('#nativetsd-btn').button({icons: {primary: 'ui-icon-tsd'}}).css({ width: '100%'})
  $('#nativetsd-btn').button({icons: {primary: 'ui-icon-tsd'}})
  .click(function(e){
    if($('#nativetsd_app').length==0) {
      console.info('Loading WebView [%s]', 'nativetsd');
      loadApp('nativetsd');
    } else {
      $('#nativetsd_app').remove();
    }
  });
  //$('#dashboard-btn').button({icons: {primary: 'ui-dashboard-tsd'}}).css({ width: '100%'})
  $('#dashboard-btn').button({icons: {primary: 'ui-dashboard-tsd'}})
  .click(function(e){
    console.info('Loading Dashboard');
    appNewWindow('dashboard');
  });

  $('#status-btn').button({ disabled: true }).css({ width: '100%'})
  .click(function(e){
    console.info("Status:%o", e);
  });


  var maxWidth = 0;
  $('#tabs span.ui-button-text').each(function(index, btn) {
    var w = parseFloat($(btn).css('width').replace('px', ''));
    console.info("W:%s", w);
    if(w > maxWidth) {
      maxWidth = w;
    }
  });
  $('#tabs span.ui-button-text').css('width', "" + maxWidth + "px");
  console.info("Max Width: %s", maxWidth);

  
  // ====================================
  // Connect button
  $('#serverUrlBtn').button({
    icons: {
      primary: "ui-icon-gear",
      secondary: "ui-icon-triangle-1-s"
    },text: false});
  
$('#heliosimg').click(function() { chrome.permissions.request({origins: ["*://localhost/ws"]}, function(a) { console.info("Granted:%o", a); }); });  
}

$(document).ready(function() { 
    console.info("App Loaded");
    initialize();
});




