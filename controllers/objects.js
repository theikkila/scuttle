var xml = require('../lib/xmltemplates');


module.exports = function objectsctrl (server, models) {
	function getObjects (req, res, next) {

		models.S3Object.find({}, function (err, objects) {
			next.ifError(err);
			res.setHeader('content-type', 'text/xml');
			res.send(xml.buildBuckets(objects));
			next();
		});
	}

	return {
		getObjects: getObjects
	};
};