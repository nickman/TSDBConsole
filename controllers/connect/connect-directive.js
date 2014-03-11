
//chrome.app.runtime.onLaunched.addListener(function(launchData) {
console.info("Initializing Connect Modal....");
// tsdbConsoleApp.module('connectModal',['ui.bootstrap','dialogs'])
tsdbConsoleApp.controller('connectModal',function($scope,$rootScope,$timeout,$modal){
  $scope.knownConnections = [
    {id: 34, url: 'ws://localhost/tsdbws', isDefault: false},
    {id: 35, url: 'ws://localhost:4242/tsdbws', isDefault: true}
  ];

  $scope.open = function () {

    var modalInstance = $modal.open({
      templateUrl: '/controllers/connect/connect.html',
      controller: ModalInstanceCtrl,
      resolve: {
        knownConnections: function () {
          loadKnownConnections();
          return $scope.knownConnections;
        }
      }
    });


    modalInstance.result.then(
      // Something was selected
      function (selectedItem) {
        $scope.selected = selectedItem;
        console.info('Modal Instance Selected: [%O]', selectedItem);
      }, 
      // Dialog was dismissed
      function () {
        console.info('Selected: [%O], Modal dismissed at: [%s]', $scope.selected,  new Date());
      });
  };

  var connectionDb = new IDBStore({
    dbVersion: 2,
    storeName: 'connections',
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function(){
      console.log('Connection Store Ready');
    },
    indexes: [
      { name: 'url', keyPath: 'url', unique: true, multiEntry: false }
    ]
  });    

  var loadKnownConnections = function() {
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
  }


});
var ModalInstanceCtrl = function ($scope, $modalInstance, knownConnections) {
  $scope.knownConnections = knownConnections;
  $scope.selected = null;

  //{    
  //  knownConnection: $scope.knownConnections[0]
  //};
  //console.info("SELECTED: [%O]", $scope.selected.knownConnection);

  $scope.ok = function () {

    $modalInstance.close($scope.selected.knownConnection);
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
<div ng-controller="ModalDemoCtrl">
    <script type="text/ng-template" id="myModalContent.html">
        <div class="modal-header">
            <h3>I'm a modal!</h3>
        </div>
        <div class="modal-body">
            <ul>
                <li ng-repeat="item in items">
                    <a ng-click="selected.item = item">{{ item }}</a>
                </li>
            </ul>
            Selected: <b>{{ selected.item }}</b>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" ng-click="ok()">OK</button>
            <button class="btn btn-warning" ng-click="cancel()">Cancel</button>
        </div>
    </script>

    <button class="btn btn-default" ng-click="open()">Open me!</button>
    <div ng-show="selected">Selection from a modal: {{ selected }}</div>
</div>

*/