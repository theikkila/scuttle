var xml = require('../lib/xmltemplates');
var sbuff = require('simple-bufferstream');
var _ = require('lodash');
var CombinedStream = require('combined-stream');
var concat = require('concat-stream');
var Q = require('q');
var sharp = require('sharp');


function err405 (res) {
	errCustom(res, 405, "MethodNotAllowed");
}
function errCustom (res, code, message) {
	res.setHeader('content-type', 'text/xml');
	var template = xml.buildError(code, message);
	res.status(code);
	res.end(template);
}

function err500 (res) {
	console.trace("500ERR");
	res.setHeader('content-type', 'text/xml');
	var template = xml.buildError('InternalError',
		'We encountered an internal error. Please try again.');
	res.status(500);
	res.end(template);
}

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


module.exports = function objectsctrl (server, models) {

	// to promise alternative
	function getS3Object(query, failOnNull) {
		var def = Q.defer();
		models.S3Object.findOne(query, function (err, obj) {
			if (err) {
				def.reject(err);
			} else if (failOnNull && !obj) {
				def.reject(new Error("File was not found"));
			} else {
				def.resolve(obj);
			}
		});
		return def.promise;
	}
	function returnNotFoundFile(key, req, res, next) {
		var template = xml.buildKeyNotFound(key);
		res.setHeader('content-type', 'text/xml');
		res.status(404)
		res.end(template);
		return next(false);
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

	/* 
	* Resizes images
	*/
	function resizeFile (req, res, next) {
		var max_width = req.query.maxwidth ? Math.min(parseInt(req.query.maxwidth), server.maxresize) : null;
		var max_height = req.query.maxheight ? Math.min(parseInt(req.query.maxheight), server.maxresize) : null;
		var bucket = req.bucket.id;
		// This compose key for resized 
		var resized_key = req.params.key + (max_width || 'A') + 'x' + (max_height || 'A') + '.jpg';
		var resized = getS3Object({
			bucket: bucket,
			key: resized_key
		}, true);

		resized.then(function (s3obj) {
			// File was found
			return returnFoundFile(s3obj, req, res, next);
		}, function (err) {
			// Not found, generating and serving!
			// Getting the original file
			var orig = getS3Object({
				bucket: bucket,
				key: req.params.key
			}, true);
			orig.fail(function (err) {
				return returnNotFoundFile(req.params.key, req, res, next);
			});
			// Original object fetched, lets compress
			orig.then(function (s3obj) {
				
				// Piping original file trough image conversion pipeline
				var concatStream = concat(function(imageBuffer) {
					var pipeline = sharp(imageBuffer);
					pipeline.resize(max_width, max_height)
					pipeline.max()
					pipeline.progressive()
					pipeline.toFormat('jpeg')
					pipeline.toBuffer(function(err, outputBuffer, info) {
						if (err) {
							return returnNotFoundFile(resized_key, req, res, next);
						}
						res.setHeader('Content-Type', 'image/jpeg');
						res.setHeader('Content-Length', info.size);
						res.end(outputBuffer);
						next();
						outputStream = sbuff(outputBuffer);
						// Save the resized image into gridfs
						streamS3Object({id: bucket}, resized_key, 'image/jpeg', outputStream, function (err, obj) {});
					});
			});
				s3obj.getFileReadStream().pipe(concatStream);
			});
		});
}

function listMultipart (req, res, next) {
	var uploadid = req.query.uploadId;
	models.MPObject.findOne({uploadid: uploadid}, function (err, mpo) {
		next.ifError(err);
		if (!mpo) { errCustom(res, 404, "NoSuchUpload"); return next(false); }
		var template = xml.buildListMultiparts(req.bucket.name, mpo);
		res.setHeader('content-type', 'text/xml');
		res.status(200)
		res.end(template);
		return next();
	});
}

function handleMultipart (req, res, next) {
	var part = req.query.partNumber;
	var uploadid = req.query.uploadId;
	models.MPObject.findOne({uploadid: uploadid}, function (err, mpo) {
		next.ifError(err);
		if (!mpo) { errCustom(res, 404, "NoSuchUpload"); return next(false); }
		console.log("MPO found...");
		mpo.removePart(part);
		var wstream = mpo.getFileWriteStream(part);
			//console.log(req);
			
			req.pipe(wstream);
			wstream.on('close', function (file) {
				console.log(file);
				mpo.parts = _.filter(mpo.parts, function (v, i, c) {
					return v.part !== part;
				});
				mpo.parts.push({uuid: file._id, part: part, md5:file.md5, size: file.length});
				mpo.save(function (err, mpo) {
					next.ifError(err);
					res.setHeader('ETag', '"'+file.md5+'"');
					res.send(200);
					return next();		
				});
			});
		});
}

function mpInitiate (req, res, next) {
	req.params.key = req.params[0];
	if (req.query.uploads !== undefined) {
		console.log("Initiating MP upload")
		var mp = models.MPObject({bucket: req.bucket.id, key: req.params.key});
		mp.generateKey();
		mp.save(function (err, mp) {
			var template = xml.buildInitiateMultipartUpload(req.bucket.name, mp);
			res.setHeader('content-type', 'text/xml');
			res.status(200)
			res.end(template);
		});			
	} else if (req.query.uploadId !== undefined) {
			// Completed mp upload
			models.MPObject.findOne({uploadid: req.query.uploadId}, function (err, mpo) {
				next.ifError(err);
				var combinedStream = CombinedStream.create();
				var streams = mpo.parts.sort(function(parta, partb) {
					return parta.part - partb.part;
				}).map(function (part) {
					return mpo.getFileReadStream(part.part)
				}).forEach(function (stream) {
					combinedStream.append(stream);
				});
				streamS3Object(req.bucket, req.params.key, mpo.contentType, combinedStream,
					function (err, obj){
						if (err) { err500(res); return next(false); }
						var template = xml.buildCompleteMultipartUpload(req.bucket.name, obj);
						res.setHeader('content-type', 'text/xml');
						res.status(200)
						res.send(template);
					});
			});
		} else {
			console.log(req.query)
			err405(res);
			return next(false);
		}
	}

	function getObject (req, res, next) {
		req.params.key = req.params[0];
		var acl = req.query.acl;
		var uploadid = req.query.uploadId;
		var max_width = req.query.maxwidth;
		var max_height = req.query.maxheight;
		if (uploadid !== undefined) {
			return listMultipart(req, res, next);
		}
		if (max_height !== undefined || max_width !== undefined) {
			return resizeFile(req, res, next);
		}
		if (acl !== undefined) {
			res.setHeader('content-type', 'text/xml');
			var template = xml.buildAcl();
			res.status(200).end(template);
			return next();
		}
		models.S3Object.findOne({
			bucket: req.bucket.id,
			key: req.params.key
		}, function (err, obj) {
			if (!obj) {
				var template = xml.buildKeyNotFound(req.params.key);
				res.setHeader('content-type', 'text/xml');
				res.status(404)
				res.end(template);
				return next(false);
			} 
			return returnFoundFile(obj, req, res, next);
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
				res.send(204);
				return next();
			});
		});
	}

	function removeDBObject (req, next) {
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
	}

	function streamS3Object (bucket, key, contentType, readStream, cb) {

		var obj = models.S3Object({
			bucket: bucket.id,
			key: key,
			contentType: contentType
		});
		obj.generateKey();
		var wstream = obj.getFileWriteStream(contentType);
	//console.log(req.data.length);
	
	readStream.pipe(wstream);

	wstream.on('close', function (file) {
		obj.md5 = file.md5;
		obj.size = file.length;

		obj.save(cb);
	});
}

function putObject (req, res, next) {
	req.params.key = req.params[0];
	removeDBObject(req, next);

	// Multipart upload
	if (req.query.uploadId !== undefined 
		&& req.query.partNumber !== undefined) {
		console.log("Uploading part " + req.query.uploadId + "; " + req.query.partNumber);
		return handleMultipart(req, res, next);
	}
	/*
	if (!req.body){
		err500(res);
		return next();
	}
	var reader = sbuff(req.body);
	*/
	streamS3Object(req.bucket, req.params.key, req.headers['content-type'], req,
	function (err, obj) {
		if (err) {
				// 500
				err500(res);
				return next();
			}
			res.setHeader('ETag', '"'+obj.md5+'"');
			res.send(200);
			return next();
		});
}

return {
	getObject: getObject,
	putObject: putObject,
	mpInitiate: mpInitiate,
	deleteObject: deleteObject
};
};
