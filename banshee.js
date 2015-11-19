
var config = require('./config.json');

(function(config){

	var http = require('http');
	var respawn = require('respawn');

	var workerPool = new Array();

	var that = this;

	var onRequest = function(req, res){

		console.log('Proxy request:' + req.url);

		var options = {
			protocol: 'http:',
			method: 'GET',
			hostname: config.host,
			port: workerPool[0].port,
			path: '/?url=http://www.google.com'
		}

  		var proxy = http.request(options, function (resp) {
    		resp.pipe(res, {
      			end: true
    		});
  		});

  		req.pipe(proxy, {
    		end: true
  		});

	};

	var startProxyEndpoint = function(){

		http.createServer(function (req, res) {
			onRequest(req, res);
		}).listen(config.port, config.host, function(){
			console.log('WebRender Proxy Server running at http://' + config.host + ':' + config.port + '/');
		});
	}

	var startPool = function(){

		var workerPort = config.workerConfig.startingPort;

		for(i = 0; i < config.workerCount; i++){

			workerPool[i] = {
				worker: null,
				port: workerPort
			};

			workerPool[i].worker = respawn(
				[
					'phantomjs',
					'--disk-cache=no',
					// '--load-images=true', //Do not enable this.  https://github.com/ariya/phantomjs/issues/12903
					'--ignore-ssl-errors=yes',
					'--ssl-protocol=any',
					'worker.js',
					'--port=' + workerPort
				],
				{
	        		cwd: '.',
	        		maxRestarts:6,
	        		sleep: 5000,
	        		kill: 1000,
	        		stdio: [0, 1, 2]
      			}
      		);

      		workerPool[i].worker.start();

      		workerPort++;

		}

	}

	var boot = function(){
		startPool();
		startProxyEndpoint();
	}

	boot();

})(config);