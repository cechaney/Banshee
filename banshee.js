
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

		try{

			console.log('Proxy request:' + req.url);			

			if(req.url.indexOf('favicon') > 0){
	  			res.setStatus = 404;
	  			res.end();
	  			return;
			}

			var workerIndex = null;

			if(workerPool && workerPool.workers.length > 0 && workerPool.free.length > 0){
				workerIndex = workerPool.free.pop();
			} else {
				res.setStatus(429);
				res.end();
				return;
			}

			var reqMethod = req.method;
			var workerPort = workerPool.workers[workerIndex].port;
			var proxyRequestUrl = '/?url=' + config.targetHost + req.url;

			console.log('Forwarding request to: ' + 'http://' + config.host + ':' + workerPort +'/' + proxyRequestUrl);

			var options = {
				protocol: 'http:',
				method: reqMethod,
				hostname: config.workerHost,
				port: workerPort,
				path: proxyRequestUrl
			}

	  		var proxy = http.request(options, function (resp) {

	  			try{

		    		resp.pipe(res, {
		      			end: true
		    		});	  				

	  			} catch(error){
	  				console.log('Error on proxy request');
	  			}

	  		});

	  		proxy.setTimeout(config.timeout, function(){

	  			try{

		  			console.log('Proxy timeout');

		  			res.setStatus = 504;
		  			res.end();	  				

	  			} catch(error){
	  				console.log('Error on handle of proxy timeout');
	  			}

	  		});

	  		proxy.on('error', function(error){

	  			try{

		  			console.log('Proxy error: ' + error.message);

		  			res.setStatus = 500;
		  			res.end();	  				

	  			} catch(error){
	  				console.log('Error on proxy error handle');
	  			}

	  		});

	  		res.on('finish', function(){

	  			try{

		  			if(workerIndex){
		  				workerPool.free.push(workerIndex);
		  			}

	  			} catch(error){
					console.log('Error on request finish');
	  			}

	  		});

  			if(worker){
		  		req.pipe(proxy, {
		    		end: true
		  		});
  			} else {
				res.setStatus(429);
				res.end();
  			}

  		} catch(error){
  			console.log('Request error: ' + error.message);
  			res.setStatus = 500;
  			res.end();
  			return;
  		}

	};

	var startProxyEndpoint = function(){

		try{

			http.createServer(function (req, res) {
				onRequest(req, res);
			}).listen(config.port, config.host, function(){
				console.log('WebRender Proxy Server running at http://' + config.host + ':' + config.port + '/');
			});

		} catch(error){
			console.log('Error on proxy endpoint start');
		}

	}

	var startPool = function(){

		try{

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
						//'--load-images=true', //Do not enable this.  https://github.com/ariya/phantomjs/issues/12903
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

		} catch(error){
			console.log('Error on PhantomJS pool start');
		}

	}

	var boot = function(){

		try{

			startPool();
			startProxyEndpoint();

		} catch(error){
			console.log('Error on Banshee boot');
		}

	}

	boot();

})(config);