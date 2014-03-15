// the dbtable module declaration
angular.module('tsdb.dbtable', [])
	// =========================================================================
	//	Directive
	// =========================================================================
	.directive('dbTable', function() {
	    return {
	        // can be used as attribute or element
	        restrict: 'AE',
	        // the private scope
			scope: {},	        
	        // which markup this directive generates
        	template: 	'<button ng-click="decrement()">-</button>' +
                  		'<div></div>' +
                  		'<button ng-click="increment()">+</button>',	        
            // the directive linker
            link: function(scope, iElement, iAttrs) {
	            scope.value = 0;
	            scope.increment = function() {
	                scope.value++;
	            }
	            scope.decrement = function() {
	                scope.value--;
	            }
	        }	                  
	    };
	})
	// =========================================================================
	//	Controller
	// =========================================================================
	.controller('dbTableCtrl', function() {

	})

	// =========================================================================
	//	Service
	// =========================================================================
	.service('dbTableCtrl', function() {

	})
;	


function bootIndexedDb(dbName, storeName, ddlMap) {
	console.debug("Opening DB/Store [%s/%s]", dbName, storeName);
	
	var d = new $.Deferred();
	var p = d.promise();

	var response = {
		dbName: dbName,
		storeName: storeName,
		dbIsNew: false,
		dbVersion: -1
	};
	var request = indexedDB.open(dbName);
	request.onupgradeneeded = function() {
		response.dbIsNew = true;
		var db = request.result;
		console.debug("DB [%s] is new: [%O]", dbName, db);
	};
	request.onsuccess = function() {
  		db = request.result;
  		if(!response.dbIsNew) {
  			console.debug("DB [%s] existed: [%O]", dbName, db);
  		}
  		response.dbVersion = db.version;
  		d.resolve(response);
	};	

	return p;
};

function deleteIndexedDb(dbName) {
	console.debug("Deleting DB [%s]", dbName);
	var d = new $.Deferred();
	var p = d.promise();
	try {
		var request = indexedDB.deleteDatabase(dbName);
		console.info("req: %O", request);
		request.onsuccess = function(evt) {
			console.debug("Deleted Event: %O", evt);
			d.resolve(true);
		}
		request.onerror = function(event) {
			console.error("onerr: %O", arguments);
			console.error("Failed to delete DB [%s]", dbName);
			d.reject("Failed to delete DB [" + dbName + "]", err);
		}
	} catch (e) {
		console.error("Failed to delete DB [%s]", dbName, e);
		d.reject("Failed to delete DB [" + dbName + "]", e);
	}
	return p;
}






  // var connectionDb = new IDBStore({
  //   dbVersion: 1,
  //   storeName: 'connections',
  //   keyPath: 'id',
  //   autoIncrement: true,
  //   onStoreReady: function(){
    
  //     console.log('[T] Connection Store Ready');
  //     dbReady.resolve();  
  //   },
  //   indexes: [
  //     { name: 'url', keyPath: 'url', unique: true, multiEntry: false }
  //   ]
  // }); 
