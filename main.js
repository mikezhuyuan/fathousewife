angular
.module('FatHousewife', ['ngRoute', 'LocalStorageModule'])
.config(function($routeProvider){
	var buildRoute = function(controller, templateUrl){
        return{
            templateUrl: templateUrl,
            controller: controller,
            resolve: {initView: function($rootScope, cloudClientProvider, localStorageService, $location, $q){
            	if(!cloudClientProvider.get()) {
            		var username = localStorageService.get("username");
            		var password = localStorageService.get("password");
            		if(!username || !password){
            			window.location = '#login';
						return;
					}
            		return cloudClientProvider.init(username, password).then(function(){}, function(){
            			window.location = '#login';
            		});
            	}				
            }}
        };
    };

	$routeProvider
	    .when('/login', {controller:'loginController', templateUrl: 'login.html'})
		.when('/cash',   buildRoute('balanceController', 'balance.html'))
		.when('/credit', buildRoute('balanceController', 'balance.html'))
		.when('/events', buildRoute('eventsController', 'events.html'))
		.when('/create', buildRoute('createController', 'create.html'))
		.otherwise({redirectTo: '/'});
})
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
.factory('cloudClientProvider', function($q, ui){
	var appUniq = '11e35bd9fe2ffac63a9c6db3011410cb';
	var client;
	return {
		init: function(appCode, appPwd){
			var c = new CBHelper(appCode, appUniq, new GenericHelper());
			var deferred = $q.defer();
			ui.block();
			c.setPassword(hex_md5(appPwd), function(sessionId){
				if(sessionId) {
					client = c;
					deferred.resolve();					
				} else {
					deferred.reject();
				}

				ui.unblock();
			});

			return deferred.promise;

		},
		get: function(){
			return client;
		}
	};
})
.factory('dataProvider', function(cloudClientProvider, $q, ui){	
	return {
		get: function(collection) {
			var deferred = $q.defer();
			ui.block();
			cloudClientProvider.get().searchAllDocuments(collection, function(r){
				var json = JSON.parse(r.outputString);
				if(json.data.status == "OK")
					deferred.resolve(json.data.message);
				else
					deferred.reject(json.data.error);
				ui.unblock();
			});

			return deferred.promise;			
		},
		add: function(collection, item) {
			var deferred = $q.defer();
			ui.block();
			cloudClientProvider.get().insertDocument(collection, item, null, function(r) {
				var json = JSON.parse(r.outputString);
				if(json.data.status == "OK")
					deferred.resolve(json.data.message);
				else
					deferred.reject(json.data.error);
				ui.unblock();				
			});

			return deferred.promise;
		},
		remove: function(collection, item) {
			var deferred = $q.defer();
			ui.block();
			cloudClientProvider.get().removeDocument({id: item.id}, collection, null, function(r) {
				var json = JSON.parse(r.outputString);
				if(json.data.status == "OK")
					deferred.resolve(json.data.message);
				else
					deferred.reject(json.data.error);
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
.factory('BalanceService', function(dataProvider, $q){
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
.controller('loginController', function($scope, $location, cloudClientProvider, localStorageService){
	$scope.login = function(username, password) {		
		cloudClientProvider.init(username, password).then(function(){
			localStorageService.add('username', username);
			localStorageService.add('password', password);
			$location.path('/');
		});
	};
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
			eventScheduleOption: parseInt($scope.eventScheduleType == 'weekly' ? $scope.eventWeeklyOption : $scope.eventlMonthlyOption)
		}).then(reset);
	};
});
