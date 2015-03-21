module.exports = function router (server, models) {
	var ctrls = require('./controllers/all')(server, models);

	server.get('/', ctrls.bucketExists, ctrls.getBucket);
	server.put('/', ctrls.putBucket);
	server.get({name:"services", path:'/'}, ctrls.getBuckets);
	/*
	server.delete('/:bucket', ctrls.bucketExists, ctrls.deleteBucket);
	server.put('/:bucket/:key(*)', ctrls.bucketExists, ctrls.putObject);
	server.get('/:bucket/:key(*)', ctrls.bucketExists, ctrls.getObject);
	server.head('/:bucket/:key(*)', ctrls.getObject);
	server.delete('/:bucket/:key(*)', ctrls.bucketExists, ctrls.deleteObject);
	*/
};