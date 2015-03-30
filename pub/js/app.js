(function() {
  'use strict';

  var app = angular.module('splash-page', [
    'ui.router',
    'ui.bootstrap'
  ]);

  app.config(['$stateProvider', '$urlRouterProvider',
    function($stateProvider, $urlRouterProvider) {
      // For any unmatched url, redirect to login
      $urlRouterProvider.otherwise("/login");

      $stateProvider
        .state('login', {
          url: "/login",
          templateUrl: "login"
        })
    }
  ]);
}());