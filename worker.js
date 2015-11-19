var webserver = require('webserver');
var webPage = require('webpage');
var system = require('system');
var url = require("url");

(function(){

	var startServer = function(config){

		try{

			var server = webserver.create();

			var service = server.listen(config.port, function(request, response) {

				if(request.url && request.url !== '/favicon.ico'){

					var urlExp = /=(.*)/;
					var urlMatches = urlExp.exec(unescape(request.url));
					var rawUrl;
					var requestUrl;

					if(urlMatches){
						rawUrl = urlMatches[1];
					}

					try{
						requestUrl = url.parse(rawUrl);
					} catch(err){
						console.log("Failed to parse request url");
					}

					if(requestUrl && requestUrl.href && requestUrl.protocol){

						var page = webPage.create();

						page.onError = function(msg, trace) {

						  var msgStack = ['ERROR: ' + msg];

						  if (trace && trace.length) {
						    msgStack.push('TRACE:');
						    trace.forEach(function(t) {
						      msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
						    });
						  }

						  console.error(msgStack.join('\n'));

						};

						//Manually abort load of image assets.  See this bug https://github.com/ariya/phantomjs/issues/12903.
						page.onResourceRequested = function(requestData, networkRequest) {

        					if (/\.(jpg|jpeg|png|gif|tif|tiff|mov)$/i.test(requestData.url)){

        						console.log(': Suppressing image #' + requestData.id + ': ' + requestData.url);

            					networkRequest.abort();

            					return;
        					}
						};

						page.open(requestUrl.href, function (status) {

						    if (status !== 'success') {
						    	response.statusCode = 500;
						    } else {

						    	response.statusCode = 200;

						    	var content = page.content;

						    	content = content.replace('<head>', '<head>\n<base href="' + requestUrl.href + '"/>');

				  				response.write(content);

						    }

							response.close();

							console.log('====================');
							console.log(status.toUpperCase());
							console.log(requestUrl.href);
							console.log(JSON.stringify(requestUrl));

						});

					} else {

						response.close();

						console.log('====================');
						console.log("FAILED");
						console.log(request.headers.Host + request.url);
						//console.log(JSON.stringify(request));

						if(!requestUrl){
							console.log('Unable to parse url from request');
						} else {
							console.log(JSON.stringify(requestUrl));
						}

						if(requestUrl && !requestUrl.href){
							console.log('No url param passed');
						}

						if(requestUrl && !requestUrl.protocol){
							console.log('No protocol passsed in url param');
						}

					}

				}

			});

			console.log('Phantomjs worker available on port ' + config.port);

		} catch (err) {

			console.log('Phantomjs worker startup failed\n' + err);

		}

	};


	var getConfig = function() {

		var PORT_PARAM = 'PORT';
		var CONFIG_FILE = 'CONFIG-FILE';

		var config = {};
		var args = system.args;
		var argNameExp = /^\--(.*)=/i;
		var argValueExp = /=(.*)/i;

		if (args.length === 1) {
			console.log('No arguments passed at startup');
		} else {

			args.forEach(function(arg, i) {

				var valueMatches = argValueExp.exec(arg);
				var paramValue;

				if(valueMatches){
					paramValue = valueMatches[1];
				}

				var nameMatches = argNameExp.exec(arg);
				var paramName;

				if(nameMatches){
					paramName = nameMatches[1];
				}

				if(paramName){

					switch(paramName.toUpperCase()){

						case CONFIG_FILE:
							//console.log(' CONFIG_FILE=' + paramValue);
							//console.log('Any command line config params passed will overwrite the values from the config file');
							config = JSON.parse(paramValue);

						case PORT_PARAM:
							//console.log(' PORT=' + paramValue);
							config.port = paramValue;
							break;
					}

				}

		  	});
		}

		return config;

	};

	phantom.onError = function(msg, trace) {

		var msgStack = ['PHANTOM ERROR: ' + msg];

		if (trace && trace.length) {

			msgStack.push('TRACE:');

			trace.forEach(function(t) {
				msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
			});

  		}

  		console.error(msgStack.join('\n'));

	};

	config = getConfig();

	startServer(config);


}).call(this);
