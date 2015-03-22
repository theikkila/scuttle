var xml = require('../lib/xmltemplates');


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
