var tsdbConsoleApp, appControllers;
tsdbConsoleApp = angular.module('tsdbConsole', ['ngAnimate', 'flexyLayout','ui.bootstrap']);
tsdbConsoleApp.controller('tsdbConsoleController', function ($scope) {
	$scope.greeting = 'Hello';
	$scope.person = 'World';
});
tsdbConsoleApp.controller('treeMenuController', function($scope) {
  var apple_selected;
  $scope.my_tree_handler = function(branch) {
    var _ref;
    $scope.output = "You selected: " + branch.label;
    if ((_ref = branch.data) != null ? _ref.description : void 0) {
      return $scope.output += '(' + branch.data.description + ')';
    }
  };
  $scope.example_treedata = [];
  $.get("tree-menu/tree-menu.json", function(data){    
    $scope.example_treedata = JSON.parse(data);
  });
});	

