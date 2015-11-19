
var config = require('./config.json');

(function(config){

	var http = require('http');
	var respawn = require('respawn');

	var workerPool = {
		workers: new Array(),
		free: new Array()
	}

	var that = this;

	var onRequest = function(req, res){

		console.log('Proxy request:' + req.url);

		try{

			var workerIndex = null;

			if(workerPool && workerPool.workers.length > 0 && workerPool.free.length > 0){

				workerIndex = workerPool.free.pop();

			} else {

				res.setStatus(429);
				res.end();

				return;

			}

			var options = {
				protocol: 'http:',
				method: 'GET',
				hostname: config.host,
				port: workerPool.workers[workerIndex].port,
				path: '/?url=http://www.google.com'
			}

	  		var proxy = http.request(options, function (resp) {

	    		resp.pipe(res, {
	      			end: true
	    		});

	  		});

	  		proxy.setTimeout(config.timeout, function(){

	  			console.log('Proxy timeout');

	  			res.setStatus = 504;
	  			res.end();

	  		});

	  		proxy.on('error', function(error){

	  			console.log('Proxy error: ' + error.message);

	  			res.setStatus = 500;
	  			res.end();

	  			return;

	  		});

	  		res.on('finish', function(){

	  			if(workerIndex){
	  				workerPool.free.push(workerIndex);
	  			}

	  		})

  			if(worker){
		  		req.pipe(proxy, {
		    		end: true
		  		});
  			}

  		} catch(error){
  			console.log('Request error: ' + error.message);
  			res.setStatus = 500;
  			res.end();
  			return;
  		}

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

			worker = {
				port: workerPort,
				process: null
			}

			worker.process = respawn(
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

      		workerPool.workers[i] = worker;

      		workerPool.workers[i].process.start();

      		workerPool.free.push(i);

      		workerPort++;

		}

	}

	var boot = function(){
		startPool();
		startProxyEndpoint();
	}

	boot();

})(config);