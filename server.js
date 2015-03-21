var restify = require('restify');
var mongoose = require('mongoose');
var concat = require('concat-stream');
var xml2js = require('xml2js');
mongoose.connect(process.env.MONGODB || 'mongodb://localhost/scuttle');
var s3hostname = process.env.S3HOSTNAME || "s3.amazonaws.com";

var models = require('./models/all')(mongoose);

var server = restify.createServer();

server.s3hostname = s3hostname;
server.use(restify.CORS());
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.jsonp());
//server.use(restify.gzipResponse());

/*
server.use(function (req, res, next) {
	//console.log(req);
	req.pipe(concat(function (data) {
		req.data = data.toString();
		next();
	}));
});
*/
server.use(function (req, res, next) {
	/*
	try {

		xml2js.parseString(req.data, function (err, result) {
			if (err) {
				req.xml = null;
				next();
			} else {
				req.xml = result;
				next();
			}
		});
	} catch (e) {
		console.log(e);
		req.xml = null;
		next();
	}*/
	next();
});


server.use(restify.bodyParser());

server.use(function (req, res, next) {
	var bucket = req.headers.host.replace(s3hostname, '').replace('.', '');
	req.bucket = bucket === '' ? null : bucket;
	if (bucket === '') {
		req.bucket = null;
		next('services');
	} else {
		next();
	}
});


// Routing
var xml = require('./lib/xmltemplates');
require('./router')(server, models);
/*
var f = function (req, res, next) {
	// body...
	console.log(req.headers);
	console.log(req.method);
	console.log(req);
	console.log(req.xml);
	res.setHeader('content-type', 'text/xml');
	res.send(xml.buildBuckets([]));
	next();
};
*/
//server.get(/\/.*/, f);
//server.put(/\/.*/, f);
//server.post(/\/.*/, f);
//server.del(/\/.*/, f);

server.on('uncaughtException', function (request, response, route, error) {
	console.log(error.stack);
});
server.listen(80, function() {
	console.log('%s listening at %s', server.name, server.url);
});