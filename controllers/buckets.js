var xml = require('../lib/xmltemplates');
var _ = require('lodash');

function handleRange (req, res, obj) {
	var range = null;
	if (req.headers['range']) {
		var r = req.headers['range'].replace('bytes=', '').split('-');
		range = {startPos: parseInt(r[0])};
		range.endPos = obj.size;
		if (r[1] !== '') {
			range.endPos = parseInt(r[1]);
		}
		res.setHeader('Content-Range', "bytes " + range.startPos+'-'+range.endPos+'/'+obj.size);
		res.status(206);
	}
	return range
}

function returnFoundFile (s3obj, req, res, next) {
	res.setHeader('Content-Type', s3obj.contentType);
	res.setHeader('Accept-Ranges', 'bytes');
	res.setHeader('Content-Length', s3obj.size);
	res.setHeader('Etag', s3obj.md5);
	res.setHeader('Last-Modified', new Date(s3obj.modifiedDate).toUTCString());
	var noneMatch = req.headers['if-none-match'];
	if (noneMatch && (noneMatch === s3obj.md5 || noneMatch === '*')) {
		res.send(304);
		return next();
	}
	var modifiedSince = req.headers['if-modified-since'];
	if (modifiedSince) {
		var time = new Date(modifiedSince);
		var modifiedDate = new Date(s3obj.modifiedDate);
		if (time >= modifiedDate) {
			res.send(304);
			return next();
		}
	}
	var range = handleRange(req, res, s3obj);
	res.status(200)
	if (req.method === 'HEAD') {
		res.end();
		return next();
	}
	var reader = s3obj.getFileReadStream(range);
	reader.pipe(res);
	return next();
}


module.exports = function bucketsctrl (server, models) {
	function getBuckets (req, res, next) {
		models.Bucket.find({}, function (err, buckets) {
			next.ifError(err);
			res.status(200);
			res.setHeader('content-type', 'text/xml');
			res.send(xml.buildBuckets(buckets));
			return next();
		});
	}

	function bucketExists (req, res, next) {
		models.Bucket.findOne({name: req.bucket}, function (err, bucket) {
			next.ifError(err);
			if (!bucket) {
				res.setHeader('content-type', 'text/xml');
				res.status(404);
				res.end(xml.buildBucketNotFound(req.bucket));
				return next(false);
			} else {
				req.bucket = bucket;
				return next();
			}
		});
	}

	function getBucket (req, res, next) {
		var options = {
			marker: req.query.marker || null,
			prefix: req.query.prefix || null,
			maxKeys: parseInt(req.query['max-keys']) || 1000,
			delimiter: req.query.delimiter || null
		};
		models.S3Object.find({bucket: req.bucket.id}, function (err, objects) {
			next.ifError(err);
			var inx = _.find(objects, {key: 'index.html'});
			if (inx) {
				return returnFoundFile(inx, req, res, next);	
			}
			
			res.setHeader('content-type', 'text/xml');
			res.status(200);
			res.end(xml.buildBucketQuery(options, objects));
			return next();
		});
	}

	function putBucket (req, res, next) {
		var bucketName = req.bucket;
		var template;
		if ((/^[a-z0-9]+(-[a-z0-9]+)*$/.test(bucketName) === false)) {
			res.setHeader('content-type', 'text/xml');
			template = xml.buildError('InvalidBucketName',
				'Bucket names can contain lowercase letters, numbers, and hyphens. ' +
				'Each label must start and end with a lowercase letter or a number.');
			res.send(400, template);
			return next();
		}
		if (bucketName.length < 3 || bucketName.length > 63) {
			res.setHeader('content-type', 'text/xml');
			template = xml.buildError('InvalidBucketName',
				'The bucket name must be between 3 and 63 characters.');
			res.send(400, template);
			return next();
		}
		models.Bucket.findOne({name: bucketName}, function (err, bucket) {
			next.ifError(err);
			if (bucket) {
				res.setHeader('content-type', 'text/xml');
				var template = xml.buildError('BucketAlreadyExists',
					'The requested bucket already exists');
				res.send(409, template);
				return next();
			}
			var b = models.Bucket({name: bucketName});
			b.save(function (err, bucket) {
				if (err) {
					var template = templateBuilder.buildError('InternalError',
						'We encountered an internal error. Please try again.');
					res.send(500, template);
					return next();
				}
				res.setHeader('Location', bucket.name+'.'+server.s3hostname);
				res.send(200);
				return next();
			});
		});
	}

	function deleteBucket (req, res, next) {
		models.S3Object.find({bucket: req.bucket.id}, function (err, objects) {
			next.ifError(err);
			if (objects.length > 0) {
				res.setHeader('content-type', 'text/xml');
				res.send(409, xml.buildBucketNotEmpty(req.bucket.name));
				return next();
			}
			req.bucket.remove(function (err, bucket) {
				res.send(204);
			});
		});
	}

	return {
		getBuckets: getBuckets,
		getBucket: getBucket,
		putBucket: putBucket,
		deleteBucket: deleteBucket,
		bucketExists: bucketExists
	};
};
