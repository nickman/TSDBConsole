chrome.app.runtime.onLaunched.addListener(function(launchData) {
    var opt = {
        width: Math.round(window.screen.availWidth*0.95),
        height: Math.round(window.screen.availHeight*0.8),
		left : Math.round((screen.width/2)-(Math.round(window.screen.availWidth*0.95)/2)),
    	top : Math.round((screen.height/2)-(Math.round(window.screen.availHeight*0.8)/2))
    };

    chrome.app.window.create('index.html', opt, function (win) {
        win.launchData = launchData;
    });

});