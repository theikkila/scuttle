module.exports = function models (mongoose) {
	var Bucket = require('./bucket')(mongoose);
	var S3Object = require('./s3object')(mongoose);
	return {
		Bucket: Bucket,
		S3Object: S3Object 
	};
};