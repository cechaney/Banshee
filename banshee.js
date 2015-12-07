
var config = require('./config.json');
var log4js = require('log4js');
var http = require('http');
var respawn = require('respawn');
var pidusage = require('pidusage');

(function(config){

	var workerPool = {
		workers: new Array(),
		free: new Array()
	}

	var that = this;

	try{
		log4js.configure('./log4js.json', {});
	} catch(error){
		console.log('Error configuring logging:' + error.message);
		return;
	}

	var logger = log4js.getLogger('banshee');		

	var handleRequest = function(req, res){


		try{

			if (req.url === '/favicon.ico') {
				
				res.writeHead(200, {'Content-Type': 'image/x-icon'} );
				res.end();
				
				return;

			}

			//logger.debug('Proxy request:' + req.url);

			var workerIndex = null;

			var poolCheckCount = 0;

			var poolCheckInterval = setInterval(function(){

				if((poolCheckCount * config.workerPoolCheckInterval) >= config.requestTimeout){
					
					clearInterval(poolCheckInterval);

					res.statusCode = 429;
					res.end();

				} else {

					poolCheckCount++;

					if(workerPool && workerPool.workers.length > 0 && workerPool.free.length > 0){

						clearInterval(poolCheckInterval);

						workerIndex = workerPool.free.pop();

						/*
						//Possible feature to restart a PhantomJS instance  if it's using too much memory
						pidusage.stat(worker.pid, function(err, stat) {
						    logger.info('Port: ' +  workerPort + ' PID:' + worker.pid + ' Mem: %s', stat.memory);
						});
						*/												

						callWorker(workerIndex, req, res)

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

	var callWorker = function(workerIndex, req, res){

		try{

			if(!workerPool.workers || !workerPool.workers[workerIndex]){
	  			logger.error('No worker (' + workerIndex + ') available for request ' );
	  			res.statusCode = 500;
				return;
			}

			var reqMethod = req.method;
			var requestUrl = '/?url=' + config.targetHost + req.url;

			var workerPort = workerPool.workers[workerIndex].port;
			var worker = workerPool.workers[workerIndex].process;

			logger.debug('Worker: ' + workerIndex + ' calling url: ' + 'http://' + config.host + ':' + workerPort + requestUrl);

			var options = {
				protocol: 'http:',
				method: reqMethod,
				hostname: config.workerHost,
				port: workerPort,
				path: requestUrl
			}

	  		var workerRequest = http.request(options, function (resp) {

	  			try{

		    		resp.pipe(res, {
		      			end: true
		    		});	  				

	  			} catch(error){
	  				logger.error('Error on worker request: ' + error.message);
	  			}

	  		});

	  		workerRequest.setTimeout(config.proxyLoadTimeout, function(){

	  			try{

		  			logger.error('Worker load timeout');

		  			res.statusCode = 504;

	  			} catch(error){
	  				logger.error('Error on handle of worker timeout: ' + error.message);
	  			}

	  		});

	  		workerRequest.on('error', function(error){

	  			try{

		  			logger.error('Worker error: ' + error.message);

		  			res.statusCode = 500;

	  			} catch(error){
	  				logger.error('Error on worker error handle: ' + error.message);
	  			}

	  		});

	  		res.on('finish', function(){

	  			try{

		  			if(workerIndex !== undefined  && workerIndex !== null){

		  				if(workerPool.free.indexOf(workerIndex) < 0){
		  					workerPool.free.push(workerIndex);	
		  				}
		  				
		  			}

	  			} catch(error){
					logger.error('Error on request finish:' + error.message);
	  			}

	  		});

			req.on('close', function(){

				try{

					workerRequest.abort();

	  				if(workerPool.free.indexOf(workerIndex) < 0){
	  					workerPool.free.push(workerIndex);	
	  					logger.debug('Added worker back into active pool ' + workerIndex);
	  				}

				} catch(error){
					logger.error('Error on request close:' + error.message);	
				}
				
			});	

			if(workerRequest){

		  		req.pipe(workerRequest, {
		    		end: true
		  		});

			} else {
				res.statusCode = 429;
			}

  		} catch(error){

  			logger.error('Proxy request error: ' + error.message + '\r\n' + error.stack);

  			res.statusCode = 500;

  			return;
  		}		

	}

	var startProxyEndpoint = function(){

		try{

			http.createServer(function (req, res) {

				handleRequest(req, res);

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
					id: null,
					port: workerPort,
					process: null
				}

				worker.id = i;

				worker.process = respawn(
					[
						'phantomjs',
						'--disk-cache=no',
						//'--load-images=false', //Do not enable this.  https://github.com/ariya/phantomjs/issues/12903
						'--ignore-ssl-errors=yes',
						'--ssl-protocol=any',
						'worker.js',
						'--port=' + workerPort
					],
					{
						env: {
							id: i,
							port: workerPort
						},
		        		cwd: '.',
		        		maxRestarts:-1,
		        		sleep: 1000,
		        		kill: 1000,
		        		stdio: ['pipe', 'pipe', 'pipe']
	      			}
	      		);	

				worker.process.on('stdout', function(data){
					logger.debug('Worker:' + data);
				});	      		

				worker.process.on('stderr', function(data){
					logger.error('Worker:' + data);
				});	      						

				worker.process.on('warn', function(err){
					logger.warn('Worker:' + err);
				});

				worker.process.on('crash', function(){
					logger.error('Worker process crashed');
				});

				worker.process.on('spawn', function(process){

					if(process !== null){
						logger.info('Spawning worker id: ' + this.env.id + ' port: ' + this.env.port);						
						workerPool.free.push(this.env.id);						
					}

				});			

	      		workerPool.workers[i] = worker;
				
	      		workerPool.workers[i].process.start();

	      		workerPort++;

	      		worker = null;

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