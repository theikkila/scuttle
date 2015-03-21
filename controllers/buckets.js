var xml = require('../lib/xmltemplates');


module.exports = function bucketsctrl (server, models) {
	function getBuckets (req, res, next) {

		models.Bucket.find({}, function (err, buckets) {
			next.ifError(err);
			res.setHeader('content-type', 'text/xml');
			res.send(xml.buildBuckets(buckets));
			next();
		});
	}

	function bucketExists (req, res, next) {
		models.Bucket.findOne({name: req.bucket}, function (err, bucket) {
			next.ifError(err);
			if (!bucket) {
				res.setHeader('content-type', 'text/xml');
				res.send(404, xml.buildBucketNotFound(req.bucket));
				next();
			} else {
				req.bucket = bucket;
				next();
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
			res.send(200, xml.buildBucketQuery(options, objects));
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

	return {
		getBuckets: getBuckets,
		getBucket: getBucket,
		putBucket: putBucket,
		bucketExists: bucketExists
	};
};