angular.module('scrobbleCast').controller('HomeCtrl', function($scope, scrobbleSvc) {
	"use strict";
	var img = '//placehold.it/64x64&text=SC';

	['in_progress', 'new_releases', 'podcasts'].forEach(function(service) {
		scrobbleSvc[service]() // invoke the service by name
			.then(function(result) {
				$scope[service] = result;
			})
			.catch(function(error) {
				console.error('error', service, error);
			});
	});

});