angular
.module('FatHousewife', ['ngRoute'])
.config(['$routeProvider', function($routeProvider){
	$routeProvider
		.when('/cash',   {controller:'balanceController', templateUrl:'balance.html'})
		.when('/credit', {controller:'balanceController', templateUrl:'balance.html'})
		.when('/events', {controller:'eventsController', templateUrl:'events.html'})
		.when('/create', {controller:'createController', templateUrl:'create.html'})
}])
.filter('moment', function(moment) {
	return function(input, format) {
		return moment(input).format(format);
	};
})
.factory('moment', function(){
	return moment;
})
.factory('_', function(){
	return _;
})
.factory('credentialProvider', function(){
	return {
		set: function(username, password){

		},
		get: function(){
			return {username:'', password:''};
		}
	};
})
.factory('ui', function() {
	var counter = 0;
	return {
		block: function() {
			if(!counter++){
				$.blockUI({
	                css: { 
	                    left: '45%',
	                    border: "none",                                    
	                    'background-color': 'transparent'
	                },
	                baseZ:9999,
	                message: '<div class="floatingCirclesG"><div class="f_circleG frotateG_01"></div><div class="f_circleG frotateG_02"></div><div class="f_circleG frotateG_03"></div><div class="f_circleG frotateG_04"></div><div class="f_circleG frotateG_05"></div><div class="f_circleG frotateG_06"></div><div class="f_circleG frotateG_07"></div><div class="f_circleG frotateG_08"></div></div>' 
	            });
			}
		},
		unblock: function(){
			if(counter--){
				$.unblockUI();
			}
		}
	};
})
.factory('guid', function(){
	return uuid.v1;
})
.factory('cloudClient', function(credentialProvider){
	var appCode = 'mikezhutest';
	var appUniq = '11e35bd9fe2ffac63a9c6db3011410cb';
	var appPwd = '1234!@#$';
	var client = new CBHelper(appCode, appUniq, new GenericHelper());
	client.setPassword(hex_md5(appPwd));
	return client;
})
.factory('dataProvider', function(cloudClient, $q, ui){	
	return {
		get: function(collection) {
			var deferred = $q.defer();
			ui.block();
			cloudClient.searchAllDocuments(collection, function(r){
				deferred.resolve(JSON.parse(r.outputString).data.message);
				ui.unblock();
			});

			return deferred.promise;			
		},
		add: function(collection, item) {
			var deferred = $q.defer();
			ui.block();
			cloudClient.insertDocument(collection, item, null, function(r) {
				deferred.resolve(r);
				ui.unblock();				
			});

			return deferred.promise;
		},
		remove: function(collection, item) {
			var deferred = $q.defer();
			ui.block();
			cloudClient.removeDocument({id: item.id}, collection, null, function(r) {
				deferred.resolve(r);
				ui.unblock();				
			});

			return deferred.promise;
		}
	}
})
.factory('dataProvider2', function($q, _){	
	var db = {cash:[], credit:[], events:[]};
	return {
		get: function(collection) {
			var deferred = $q.defer();

			deferred.resolve(db[collection]);

			return deferred.promise;			
		},
		add: function(collection, item) {
			var deferred = $q.defer();

			db[collection].push(item);
			
			deferred.resolve();

			return deferred.promise;
		},
		remove: function(collection, item) {
			var deferred = $q.defer();

			db[collection] = _.without(db[collection], item);
			
			deferred.resolve();

			return deferred.promise;
		}
	}
})
.factory('BalanceService', function(cloudClient, dataProvider, $q){
	function get(all, yearMonth){
		var items = _.chain(all)
					 .filter(function(a){return a.date.substr(0, '0000-00'.length) === yearMonth})
				     .sortBy("date")				     
				     .value()
				     .reverse();
		var monthBalance = _.reduce(items, function(memo, item){ return memo + item.amount }, 0);
		var totalBalance = _.chain(all)
							.filter(function(a){return a.date.substr(0, '0000-00'.length) <= yearMonth })
							.reduce(function(memo, item){ return memo + item.amount }, 0)
							.value();								
		return {
			items: items,
			monthBalance: monthBalance,
			totalBalance: totalBalance
		};
	}
	return function(){
		var cache;
		return {
		 	get: function(collection, yearMonth) {
		 		if(cache) {
		 			var deferred = $q.defer();
		 			deferred.resolve(get(cache, yearMonth));
		 			return deferred.promise;
		 		}

				return dataProvider.get(collection).then(function(all){
					cache = all;
					return get(all, yearMonth);
				});
			}
		};
	}
})
.controller('balanceController', function($scope, $location, moment, BalanceService){
	var service = BalanceService();
	($scope.month = function(m) {
		(!m) ? $scope.date = moment()
		     : $scope.date = $scope.date.add('months', m);

		service.get($location.path().substr(1), $scope.date.format('YYYY-MM')).then(function(result){
			$scope.items = result.items;
			$scope.monthBalance = result.monthBalance;
			$scope.totalBalance = result.totalBalance;
		});
	})();

	$scope.isCurrent = function() {
		return $scope.date.format('YYYY-MM') == moment().format('YYYY-MM');	
	};
})
.controller('eventsController', function($scope, dataProvider, _){
	dataProvider.get('events').then(function(items){
		$scope.items = items;
	});
	
	$scope.remove = function(itm){
		dataProvider.remove("events", itm)
					.then(function(){
						$scope.items = _.without($scope.items, itm)
					});
	};
})
.controller('createController', function($scope, dataProvider, _, guid){	 
	function reset() {
		delete $scope.date;
		delete $scope.amount;
		delete $scope.description;
		delete $scope.tags;
		$scope.eventMonthlyDays = _.range(1, 29);
		$scope.eventScheduleType = 'weekly';
		$scope.eventType = 'credit';
		$scope.eventWeeklyOption = 0; 
		$scope.eventMonthlyOption = 1;
	}

	reset();

	$scope.balance = function(collection){
		dataProvider.add(collection, {
			id: guid(),
			date: moment().format('YYYY-MM-DD'),
			amount: parseFloat($scope.amount || 0),
			description: $scope.description,
			tags: $scope.tags && $scope.tags.split(/\s+/)
		}).then(reset);
	};

	$scope.event = function() {
		dataProvider.add('events', {
			id: guid(),
			amount: parseFloat($scope.amount || 0),
			description: $scope.description,
			tags: $scope.tags && $scope.tags.split(/\s+/),
			eventType: $scope.eventType,
			eventScheduleType: $scope.eventScheduleType,
			eventScheduleOption: $scope.eventScheduleType == 'weekly' ? $scope.eventWeeklyOption : $scope.eventMonthlyOption
		}).then(reset);
	};
});
