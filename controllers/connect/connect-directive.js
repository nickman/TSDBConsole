
//chrome.app.runtime.onLaunched.addListener(function(launchData) {
console.info("Initializing Connect Modal....");
// tsdbConsoleApp.module('connectModal',['ui.bootstrap','dialogs'])
tsdbConsoleApp.controller('connectModal',function($scope,$rootScope,$timeout,$modal){
  $scope.items = ['item1', 'item2', 'item3'];

  $scope.open = function () {

    var modalInstance = $modal.open({
      templateUrl: '/controllers/connect/connect.html',
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
      console.info('Modal dismissed at: ' + new Date());
    });
  };
});
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




