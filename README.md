# Banshee
A custom built Web Render Proxy that uses a pool of PhantomJS instances to provide SEO for JavaScript apps

Banshee is "self-healing".  It can recover from pooled PhantomJS instances crashing, and will purposely shutdown and restart a PJS instance that is taking too much memory.
<hr/>

######Things to keep in mind
1. Implementing a caching strategy in front or inside the proxy code is necessary as performance is beholden to how fast your base page runs inside of PhantomJS.  

######Known issues
1. The QT library used by PhantomJS leaks memory if image loading is not enabled when starting PhantomJS.  To address this, code is present to detect loading of images and abort those requests. [Link to issue](https://github.com/ariya/phantomjs/issues/12903).
2. Memory usage with PhantomJS 2 on OSX seems to have big issues! Use a 1.x binary distribution.  I'm seeing 5GB usage by a single instance of PhantomJS, and subsequent crashes.  Memory usage and performance is excellent on Linux ;) 

##Architecture
<img src="./doc/images/banshee.png"/>

##Requirements
Node.js, and PhantomJS are required to run.

##Installation
1. Install PhantomJS locally
2. Clone this repository
3. Run "npm install" in the local repository directory
4. Change the config.json file's "targetHost" property to the site you want to front
5. Run "node banshee.js"
6. In a browser, navigate to "http://localhost:8888"

##Configuration
Look to the config.json file for configuration. Settings are...

* host - Banshee hostname
* port - Banshee port
* requestTimeout - Banshee timeout in ms
* proxyLoadTimeout - Timeout waiting for PhantomJS to respond in ms
* workerCount - Number of PhantomJS instances to start
* workerHost - Hostname of PhantomJS workers
* workerPoolCheckInterval - Interval in ms for available PhantomJS instance in pool
* workerMaxMemory - Max MBytes an instance of PhantomJS may use before being terminated and restarted by Banshee
* workerStartupPause - Pause in ms to wait for PhantomJS worker to start
* targetHost - The host that Banshee is fronting. Point this at the site you want to the workers to render
* workerConfig
	** startingPort - The port Banshee uses to start worker pool. Subsequent workers are assigned incremental port numbers. 9000,9001,9002
	** timeout - The timeout for the PhantomJS page object to load a requested page

######Credit where credit is due.
The following articles and repositories inspired this project
* [Sumgmug Sorcery PhantomJS at scale](http://sorcery.smugmug.com/2013/12/17/using-phantomjs-at-scale/)
* [Phantom Manager](https://github.com/FTBpro/phantom-manager)
* [PhearJS](https://github.com/Tomtomgo/phearjs)
