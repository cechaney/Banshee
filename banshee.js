
var config = require('./config.json');

(function(config){

	var log4js = require('log4js');
	var http = require('http');
	var respawn = require('respawn');

	var workerPool = {
		workers: new Array(),
		free: new Array()
	}

	var that = this;

	try{
		log4js.configure('log4js.json', {});
	} catch(error){
		console.log('Error configuring logging:' + error.message);
		return;
	}

	var logger = log4js.getLogger('banshee');		

	var onRequest = function(req, res){

		try{

			if (req.url === '/favicon.ico') {
				
				res.writeHead(200, {'Content-Type': 'image/x-icon'} );
				res.end();
				
				return;

			}

			logger.debug('Proxy request:' + req.url);			

			var workerIndex = null;

			var poolCheckCount = 0;

			var poolCheckInterval = setInterval(function(){

				if((poolCheckCount * config.workerPoolCheckInterval) >= config.requestTimeout){
					
					clearInterval(poolCheckInterval);

					res.statusCode = 429;
					res.end();
					
					return;

				} else {

					poolCheckCount++;

					if(workerPool && workerPool.workers.length > 0 && workerPool.free.length > 0){

						clearInterval(poolCheckInterval);

						workerIndex = workerPool.free.pop();

						proxyRequest(workerIndex, req, res)

					}

				}

			}, config.workerPoolCheckInterval);


  		} catch(error){

  			logger.error('Request error: ' + error.message);

  			res.statusCode = 500;
  			res.end;  			

  			return;
  		}

	};

	var proxyRequest = function(workerIndex, req, res){

		try{

			var reqMethod = req.method;
			var workerPort = workerPool.workers[workerIndex].port;
			var proxyRequestUrl = '/?url=' + config.targetHost + req.url;

			logger.debug('Forwarding request to: ' + 'http://' + config.host + ':' + workerPort +'/' + proxyRequestUrl);

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
	  				logger.error('Error on proxy request: ' + error.message);
	  			}

	  		});

	  		proxy.setTimeout(config.proxyLoadTimeout, function(){

	  			try{
		  			logger.error('Proxy load timeout');
		  			res.statusCode = 504;
		  			res.end();
	  			} catch(error){
	  				logger.error('Error on handle of proxy timeout: ' + error.message);
	  			}

	  		});

	  		proxy.on('error', function(error){

	  			try{
		  			logger.error('Proxy error: ' + error.message);
		  			res.statusCode = 500;
		  			res.end();
	  			} catch(error){
	  				logger.error('Error on proxy error handle: ' + error.message);
	  			}

	  		});

	  		res.on('finish', function(){

	  			try{

		  			if(workerIndex !== undefined  && workerIndex !== null){
		  				workerPool.free.push(workerIndex);
		  			}

	  			} catch(error){
					logger.error('Error on request finish:' + error.message);
	  			}

	  		});

				if(worker){

			  		req.pipe(proxy, {
			    		end: true
			  		});

				} else {
					res.statusCode = 429;
					res.end();
				}

  		} catch(error){

  			logger.error('Proxy request error: ' + error.message);

  			res.statusCode = 500;
  			res.end;  			

  			return;
  		}		

	}

	var startProxyEndpoint = function(){

		try{

			http.createServer(function (req, res) {
				onRequest(req, res);
			}).listen(config.port, config.host, function(){
				logger.info('WebRender Proxy Server running at http://' + config.host + ':' + config.port + '/');
				logger.info('Proxying traffic for: ' + config.targetHost);
			});

		} catch(error){
			logger.error('Error on proxy endpoint start:' + error.message);
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

				worker.process.on('stdout', function(data){
					logger.debug(JSON.stringify(data));
				});	      		

				worker.process.on('stderr', function(data){
					logger.error(JSON.stringify(data));
				});	      						

				worker.process.on('warn', function(err){
					logger.error(err.message);
				});					

	      		workerPool.workers[i] = worker;
				
	      		workerPool.workers[i].process.start();

	      		workerPool.free.push(i);

	      		workerPort++;

			}			

		} catch(error){
			logger.error('Error on PhantomJS pool start:' + error.message);
		}

	}

	var boot = function(){

		try{

			startPool();
			startProxyEndpoint();

		} catch(error){
			logger.error('Error on Banshee boot:' + error.message);
		}

	}

	boot();

})(config);