var xml = require('../lib/xmltemplates');
var sbuff = require('simple-bufferstream');

module.exports = function objectsctrl (server, models) {
	function getObject (req, res, next) {
		req.params.key = req.params[0];
		var acl = req.query.acl;
		if (acl !== undefined) {
			res.setHeader('content-type', 'text/xml');
			var template = templateBuilder.buildAcl();
			res.status(200).end(template);
			return next();
		}
		models.S3Object.findOne({
			bucket: req.bucket.id,
			key: req.params.key},
			function (err, obj) {
				if (!obj) {
					var template = xml.buildKeyNotFound(req.params.key);
					res.setHeader('content-type', 'text/xml');
					res.status(404)
					res.end(template);
					return next();
				} else {
					res.setHeader('Content-Type', obj.contentType);
					res.setHeader('Accept-Ranges', 'bytes');
					res.setHeader('Content-Length', obj.size);
					res.setHeader('Etag', obj.md5);
					res.setHeader('Last-Modified', new Date(obj.modifiedDate).toUTCString());
					var noneMatch = req.headers['if-none-match'];
					if (noneMatch && (noneMatch === obj.md5 || noneMatch === '*')) {
						return res.status(304).end();
					}
					var modifiedSince = req.headers['if-modified-since'];
					if (modifiedSince) {
						var time = new Date(modifiedSince);
						var modifiedDate = new Date(obj.modifiedDate);
						if (time >= modifiedDate) {
							return res.status(304).end();
						}
					}
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
					res.status(200)
					if (req.method === 'HEAD') {
						res.end();
						return next();
					}
					var reader = obj.getFileReadStream(range);
					reader.pipe(res);
					return next();
				}
			});
}

function deleteObject (req, res, next) {
	req.params.key = req.params[0];
	models.S3Object.findOne({
		bucket: req.bucket.id,
		key: req.params.key
	}, function (err, obj) {
		next.ifError(err);
		if (obj === null) {
			var template = xml.buildKeyNotFound(req.params.key);
			res.setHeader('content-type', 'text/xml');
			res.status(404)
			res.end(template);
			return next();
		}
		obj.remove(function (err, obj) {
			next.ifError(err);
			res.status(204).end();
			return next();
		});
	});
}

function putObject (req, res, next) {
	req.params.key = req.params[0];
	models.S3Object.findOne({
		bucket: req.bucket.id,
		key: req.params.key
	}, function (err, obj) {
		next.ifError(err);
		if (obj === null) { return; }
		obj.remove(function (err, obj) {
			next.ifError(err);
		});
	});
	var obj = models.S3Object({
		bucket: req.bucket.id,
		key: req.params.key,
		contentType: req.headers['content-type']
	});
	obj.generateKey();
	var wstream = obj.getFileWriteStream(req.headers['content-type']);
			//console.log(req.data.length);
			var reader = sbuff(req.body);
			reader.pipe(wstream);

			wstream.on('close', function (file) {
				obj.md5 = file.md5;
				obj.size = file.length;

				obj.save(function (err, obj) {
					if (err) {
						res.setHeader('content-type', 'text/xml');
						var template = xml.buildError('InternalError',
							'We encountered an internal error. Please try again.');
						res.status(500)
						res.end(template);
						return next();
					}
					res.setHeader('ETag', obj.md5);
					res.send(200);
					return next();				
				});
			});
		}

		return {
			getObject: getObject,
			putObject: putObject,
			deleteObject: deleteObject
		};
	};