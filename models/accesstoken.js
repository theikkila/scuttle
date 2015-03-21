module.exports = function user (mongoose) {
	return mongoose.model('AccessToken', {
		name: String,
		creationDate: {type: Date, default: Date.now},
		token: {type: String, index: true}
	});
};