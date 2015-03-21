module.exports = function router (server, models) {
	var ctrls = require('./controllers/all')(server, models);

	server.get('/', ctrls.bucketExists, ctrls.getBucket);
	server.put('/', ctrls.putBucket);
	server.del('/', ctrls.bucketExists, ctrls.deleteBucket);
	server.put(/^\/(.*)/, ctrls.bucketExists, ctrls.putObject);
	server.get(/^\/(.*)/, ctrls.bucketExists, ctrls.getObject);
	server.head(/^\/(.*)/, ctrls.bucketExists, ctrls.getObject);
	server.del(/^\/(.*)/, ctrls.bucketExists, ctrls.deleteObject);
	server.get({name:"services", path:'/'}, ctrls.getBuckets);
};