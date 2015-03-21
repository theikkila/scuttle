module.exports = function bucket (mongoose) {
	return mongoose.model('Bucket', {
		name: String,
		creationDate: {type: Date, default: Date.now}
	});
};