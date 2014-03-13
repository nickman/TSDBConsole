 


//chrome.app.runtime.onLaunched.addListener(function(launchData) {
console.info("Initializing Connect Modal....");
// tsdbConsoleApp.module('connectModal',['ui.bootstrap','dialogs'])
tsdbConsoleApp.controller('MyCtrl', function($scope, Data) {
    $scope.knownConnections = Data.get().then(function(data){
      $scope.facilities = [];
      for(var i = 0; i < data.length; i++) {
          $scope.facilities.push(data[i].id);
      }
    });
    //$scope.comparator = Comparators.year;
    
    $scope.$watch('selected', function(fac) {
       $scope.$broadcast("rowSelected", fac);
    });



})
  .service('Data', function() {

  var dbReady = $.Deferred();
  var dbReadyPromise = dbReady.promise();

  var connectionDb = new IDBStore({
    dbVersion: 1,
    storeName: 'connections',
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function(){
    
      console.log('[T] Connection Store Ready');
      dbReady.resolve();  
    },
    indexes: [
      { name: 'url', keyPath: 'url', unique: true, multiEntry: false }
    ]
  }); 

    this.get = function() {
        return loadKnownConnections();
    };


  var loadKnownConnections = function() {
    var d = $.Deferred();
    dbReadyPromise.then(function() {
      
      console.info("[T] Fetching all known connections...")
      var kcCount = 0;    
      
      connectionDb.getAll(function(data){
        var connections = [];
        data.forEach(function(kc){
          kcCount++;
          //connections.push(kc);
        });    
        d.resolve(connections);  
      }, function(err) { console.error("Failed to load data", err)});      
    });
    return d.promise();
  }


  });


tsdbConsoleApp.controller('connectModal',function($scope,$rootScope,$timeout,$modal){
    $scope.knownConnectionsX = [
      //{id: 34, url: 'ws://localhost/tsdbws', isDefault: false},
    
    ];

    $scope.open = function () {
      var modalInstance = null;
      loadKnownConnections($scope.knownConnectionsX).then(function(conns){
        modalInstance = $modal.open({
          templateUrl: '/controllers/connect/connect.html',
          controller: ModalInstanceCtrl,
          resolve: {
            knownConnections: function () {
              return loadKnownConnections();
            }
          }
        });
        modalInstance.result.then(
          // Something was selected
          function (selectedItem) {
            $scope.selected = selectedItem;
            console.info('Modal Instance Selected: [%O]', selectedItem);
            storeConnection(selectedItem);
          }, 
          // Dialog was dismissed
          function () {
            console.info('Selected: [%O], Modal dismissed at: [%s]', $scope.selected,  new Date());
          });

    });


  };

  var connectionDb = new IDBStore({
    dbVersion: 1,
    storeName: 'connections',
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function(){
      console.log('Connection Store Ready');
      connectionDb.getAll(function(data) {console.info("ALL DATA: %O", data)});
    },
    indexes: [
      { name: 'url', keyPath: 'url', unique: true, multiEntry: false }
    ]
  }); 

  var switchDefault = function(id) {
    console.info("Setting default connection to [%s]", id);
    var onItem = function (item, cursor, transaction) {
      item.isDefault = (item.id == id);
      cursor.update(item);
    };

    connectionDb.iterate(onItem, {
      index: 'url',      
      writeAccess: true,
      onEnd: function() {
        console.info("Connection [%s] set to Default", id);
      }
    });
    
  }

  var storeConnection = function(kConn) {
    console.info("Storing [%O]...", kConn);
    var foundRecord = null;
    var onItem = function (item) {
      console.log('got item: [%O]', item);
      foundRecord = item;
    };
    var finishStore = function() {
      if(foundRecord==null) {
        var onsuccess = function(id){
          console.log('Saved new Connection with ID: [%s]' , id);
        }
        var onerror = function(error){
          console.error('Connection save failure', error);
        }         
        connectionDb.put(kConn, onsuccess, onerror);        
      } else {
        if(kConn.isDefault &&  !foundRecord.isDefault) {
          switchDefault(foundRecord.id);
        }
      }
    }
    var keyRange = connectionDb.makeKeyRange({
      lower: kConn.url,
      upper: kConn.url
    });
    connectionDb.iterate(onItem, {
      index: 'url',
      keyRange: keyRange,
      onEnd: finishStore
    });

  }   

  var loadKnownConnections = function() {
    var d = $.Deferred();
    console.info("Fetching all known connections...")
    var kcCount = 0;    
    
    connectionDb.getAll(function(data){
      var connections = [];
      data.forEach(function(kc){
        kcCount++;
        connections.push(kc);
      });    
      d.resolve(connections);  
    }, onerror);
    return d.promise();
  }


});
var ModalInstanceCtrl = function ($scope, $modalInstance, knownConnections) {
  console.info("Modal loading. Scope: [%O], Modal: [%O], KC:[%O]", $scope, $modalInstance, knownConnections);
  $scope.knownConnections = knownConnections;
  $scope.selected = null;
  $scope.f = {d: false};

  console.info("Modal loaded. KC:[%O]", $scope.knownConnections);

  $scope.ok = function () {
    var selectedConnection = {
      url : $scope.f.url.toLowerCase(),
      isDefault : $scope.f.d
    };
    console.info("Selected [%O]", selectedConnection);
    $modalInstance.close(selectedConnection);    
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};

console.info("Connect Modal Initialized");


tsdbConsoleApp.factory('ConnectionModel', function ($rootScope) {
    var statuses = [
        {name: 'Connected'},
        {name: 'Disconnected'}
    ];

    var connectionDb = new IDBStore({
      dbVersion: 1,
      storeName: 'connections',
      keyPath: 'id',
      autoIncrement: true,
      onStoreReady: function(){
        console.log('Connection Store Ready');
      }
    });    

    var knownConnections = [
      {id: 0, url: 'ws://localhost:/tsdbws', default: true}
        //  {id: 1, url: 'ws://localhost:/tsdbws', default: true}
      
    ];

    var getStatuses = function () {
        return statuses;
    };

    var getKnownConnections = function () {
        return knownConnections;
    };

    var deleteKnownConnection = function (id) {
        knownConnections.remove(function (s) {
            return s.id == id;
        });
        connectionDb.remove(id, this.onsuccess, this.onerror);
    };

    var createKnownConnection = function (newStory) {
        newStory.id = new Date().getTime();
        stories.push(newStory);

        $rootScope.$broadcast('storiesChanged')
    };

    var setDefaultKnownConnection = function(id) {

    };

    var onsuccess = function(id){
      console.info("Stored Know Connection ID [%s]", id);
    }
    var onerror = function(error){
      console.error("Known Connection Store Failure: [%O]", error);
    }
     
    console.info("Fetching all known connections...")
    var kcCount = 0;
    connectionDb.getAll(function(data){
      data.forEach(function(kc){
        kcCount++;
        console.info("Retrieved KC: [%O]", kc);
        knownConnections.push(kc);
      });      
      console.info("Cached [%s] KnownConnections", kcCount);
    }, onerror);


    return {
        getStatuses: getStatuses,
        getKnownConnections: getKnownConnections,
        deleteKnownConnection: deleteKnownConnection,
        createKnownConnection: createKnownConnection,
        setDefaultKnownConnection: setDefaultKnownConnection        
    };
});




/*
var ModalDemoCtrl = function ($scope, $modal, $log) {

  $scope.items = ['item1', 'item2', 'item3'];

  $scope.open = function () {

    var modalInstance = $modal.open({
      templateUrl: 'myModalContent.html',
      controller: ModalInstanceCtrl,
      resolve: {
        items: function () {
          return $scope.items;
        }
      }
    });

    modalInstance.result.then(function (selectedItem) {
      $scope.selected = selectedItem;
    }, function () {
      $log.info('Modal dismissed at: ' + new Date());
    });
  };
};

// Please note that $modalInstance represents a modal window (instance) dependency.
// It is not the same as the $modal service used above.

var ModalInstanceCtrl = function ($scope, $modalInstance, items) {

  $scope.items = items;
  $scope.selected = {
    item: $scope.items[0]
  };

  $scope.ok = function () {
    $modalInstance.close($scope.selected.item);
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};
*/

/*

angular.module('todoList', [], function () {

}).controller('myCtrl', function ($scope) {

        $scope.todos = [
            {
                text: "Hello"
            }, {
                text: "World"
            }
        ]
})


var myApp = angular.module('myApp',['scrollable-table'])
  .service('Data', function() {
    this.get = function() {
        return [{
          facility: "Atlanta",
          code: "C-RD34",
          cost: 540000,
          conditionRating: 52,
          extent: 100,
          planYear: 2014
        }, {
          facility: "Seattle",
          code: "CRDm-4",
          cost: 23000,
          conditionRating: 40,
          extent: 88,
          planYear: 2014
        }]
 
    };
  });

// when sorting by year, sort by year and then replace %
.service("Comparators", function() { 
  this.year = function(r1, r2) {
    if(r1.planYear === r2.planYear) {
      if (r1.extent === r2.extent) return 0;
      return r1.extent > r2.extent ? 1 : -1;
    } else if(!r1.planYear || !r2.planYear) {
      return !r1.planYear && !r2.planYear ? 0 : (!r1.planYear ? 1 : -1);
    }
    return r1.planYear > r2.planYear ? 1 : -1;
  };
})
.controller('MyCtrl', function($scope, Data, Comparators) {
    $scope.visibleProjects = Data.get();
    $scope.comparator = Comparators.year;
    $scope.facilities = [];
    for(var i = 0; i < $scope.visibleProjects.length; i++) {
        $scope.facilities.push($scope.visibleProjects[i].facility);
    }
    
    $scope.$watch('selected', function(fac) {
       $scope.$broadcast("rowSelected", fac);
    });
})
;
*/