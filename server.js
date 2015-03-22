var restify = require('restify');
var mongoose = require('mongoose');
var concat = require('concat-stream');
var xml2js = require('xml2js');
mongoose.connect(process.env.MONGODB || 'mongodb://localhost/scuttle');
var s3hostname = process.env.S3HOSTNAME || "s3.amazonaws.com";

var xml = require('./lib/xmltemplates');
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
//models.AccessToken({name:"default", token:"accesstokenhere"}).save();
function accessdenied (res) {
	res.setHeader('content-type', 'text/xml');
	res.status(401)
	res.end(xml.buildError(401, "Access Denied"));
}

server.use(function (req, res, next) {
	var auth = req.authorization;
	var readonly = ['GET', 'HEAD'];
	if (readonly.indexOf(req.method) !== -1 && req.path() !== '/') {
		return next();
	}
	if (auth.scheme === "AWS4-HMAC-SHA256") {
		console.log(auth);
		var parts = auth.credentials.split(',');
		var credhead = {};
		parts.forEach(function (line) {
			var p = line.split('=');
			credhead[p[0]] = p[1];
		});
		var cs = credhead.Credential.split('/');
		var creds = {};
		creds.accesskey = cs[0];
		creds.date = cs[1];
		creds.region = cs[2];
		creds.service = cs[3];
		models.AccessToken.findOne({token: creds.accesskey}, function (err, token) {
			next.ifError(err);
			console.log(token)
			if (token) {
				return next();
			} else {
				accessdenied(res);
				return next(false);
			}
		});
	} else {
		accessdenied(res);
		return next(false);
	}
});


server.use(restify.bodyParser());

server.use(function (req, res, next) {
	var bucket = req.headers.host.replace(s3hostname, '').replace('.', '');
	req.bucket = bucket === '' ? null : bucket;
	if (bucket === '' && req.path() === '/') {
		req.bucket = null;
		next('services');
	} else {
		next();
	}
});


// Routing
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
server.listen(process.env.PORT || 8080, function() {
	console.log('%s listening at %s', server.name, server.url);
});