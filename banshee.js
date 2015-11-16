
var config = require('./config.json');

(function(config){

	var http = require('http');
	var respawn = require('respawn');	

	var workerPool = new Array();

	var that = this;

	var proxyEndpoint = function(req, res){

		var options = {
			host: config.host,
			port: workerPool[0].port,
			path: '/'
		}

		var callback = function(resp){

			resp.on('data', function(resp){
				Console.log("sent data");
			});
			
		}

		http.request(options, callback).end();

		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('Salut tout le monde!\n');

	};

	var startProxyEndpoint = function(){
		//Start up the proxy endpoint
		http.createServer(function (req, res) {
			proxyEndpoint(req, res);
		}).listen(config.port, config.host, function(){
			console.log('Server running at http://' + config.host + ':' + config.port + '/');				
		});				
	}

	var startPool = function(){

		for(i = 0; i < config.workerCount; i++){
			
			workerPool[i] = {
				worker: null,
				port: config.workerConfig.port
			};

			workerPool[i].worker = respawn(["phantomjs", "--disk-cache=no", "--ignore-ssl-errors=yes", "--ssl-protocol=any", "worker.js", "--config=" + config.workerConfig], {
        		cwd: '.',
        		sleep: 1000,
        		stdio: [0, 1, 2],
        		kill: 1000
      		});

      		workerPool[i].worker.start();

      		config.workerConfig.port++;

		}

	}

	var getWorker = function(port){
		return 	respawn(['phantomjs',
			// "--load-images=no", // Due to an issue in QT a memory leak occurs with this. Re-enable when solved. Info: https://github.com/ariya/phantomjs/issues/12903.
			'--disk-cache=no',
			'--ignore-ssl-errors=yes',
			'--ssl-protocol=any',
			'instance.js',
			{
			cwd: '.',
			sleep:1000,
			stdio: [0,1,2],
			kill: 1000
		}]);
	}	

	var boot = function(){
		startPool();
		startProxyEndpoint();
	}

	boot();

})(config);