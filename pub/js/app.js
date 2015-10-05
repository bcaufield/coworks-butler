(function() {
  'use strict';

  var app = angular.module('splash-page', [
    'ui.router',
    'ui.bootstrap'
  ]);

  app.config(['$stateProvider', '$urlRouterProvider', '$locationProvider',
    function($stateProvider, $urlRouterProvider, $locationProvider) {
      // For any unmatched url, redirect to login
      //$urlRouterProvider.otherwise("/login");
      $locationProvider.html5Mode(true);

      $stateProvider
        .state('login', {
          url: "/login",
          templateUrl: "login"
        })
        .state('admin', {
          url: "/admin",
          templateUrl: "admin"
        })
        .state('home', {
          url: "/home",
          templateUrl: "home.html"
        })
        .state('error.403', {
          url: "/error/403",
          templateUrl: "error-403"
        })
    }
  ]);

  app.controller('loginCtl', ['$scope', '$http', '$window',
    function($scope, $http, $window) {
      $scope.userinfo = {
        username: '',
        password: ''
      };

      $scope.config = {};
      $scope.loading = true;
      $scope.loggingIn = false;
      $scope.errorMsg = null;

      $http.get('api/admin/config')
        .success(function(data) {
          if (data && data.authType) {
            $scope.config = data;
          }
        })
        .finally(function() {
          $scope.loading = false;
        })

      $scope.login = function() {
        $scope.errorMsg = null;
        if ($scope.userinfo.username.length
          && $scope.userinfo.password.length
        ) {
          $scope.loggingIn = true;

          $http.post('api/auth', {
            username: $scope.userinfo.username,
            password: $scope.userinfo.password
          }).success(function(data) {
            if (data && data.success) {
              if (data.redirect) {
                $window.location.href = data.redirect;
              }
            } else if (data) {
              $scope.errorMsg = data.message || 'Unexpected Error';
            } else {
              $scope.errorMsg = 'Transport Error';
            }
          }).error(function(data) {
            if (data) {
              $scope.errorMsg = data.message || 'Unexpected Error';
            } else {
              $scope.errorMsg = 'Transport Error';
            }
          }).finally(function() {
            $scope.loggingIn = false;
          });
        } else {
          $scope.errorMsg = "Empty Username/Password";
        }
      };
    }
  ]);

  app.controller('adminCtl', ['$state', '$http',
    function($state, $http) {
      $http.get('/api/admin/check')
        .error(function() {
          $state.go('error.403');
        });
    }
  ]);

  app.controller('adminConfigCtl', ['$scope', '$http',
    function($scope, $http) {
      $scope.config = {
        authType: ''
      };

      $http.get('api/admin/config')
        .success(function(data) {
          if (data) {
            $scope.config = data;
          }
        });

      $scope.$watch('config.authType', function(newVal, oldVal) {
        if (oldVal
          && (newVal !== oldVal)
        ) {
          $http.post('api/admin/config', { config: $scope.config})
            .success(function(data) {
              $scope.config = data;
            });
        }
      });

    }
  ]);

  app.controller('adminLogsCtl', ['$scope', '$http',
    function($scope, $http) {
      $scope.rows = [];

      $scope.getLogs = function() {
        $http.get('api/admin/logs')
          .success(function(data) {
            if (data && data.rows) {
              $scope.rows = data.rows;
            }
          });
      };

      $scope.getLogs();
    }
  ]);
}());