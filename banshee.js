
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

		http.createServer(function (req, res) {
			proxyEndpoint(req, res);
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
					"phantomjs", 
					"--disk-cache=no", 
					"worker.js", 
					"--port=" + workerPort
				], 
				{
	        		cwd: '.',
	        		sleep: 1000,
	        		stdio: [0, 1, 2],
	        		kill: 1000
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