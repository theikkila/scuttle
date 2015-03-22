

module.exports = function controllers (server, models) {
	var buckets = require('./buckets')(server, models);
	var objects = require('./objects')(server, models);
	return {
		getBuckets: buckets.getBuckets,
		getBucket: buckets.getBucket,
		bucketExists: buckets.bucketExists,
		deleteBucket: buckets.deleteBucket,
		putBucket: buckets.putBucket,
		getObject: objects.getObject,
		deleteObject: objects.deleteObject,
		putObject: objects.putObject,
		mpInitiate: objects.mpInitiate
	};
};
