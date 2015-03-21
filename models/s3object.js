var Grid = require('gridfs-stream');

module.exports = function s3object (mongoose) {
  Grid.mongo = mongoose.mongo;
  var conn = mongoose.connection;
    var gfs = Grid(conn.db);

    var objSchema = mongoose.Schema({
      bucket: String,
      key: String,
      contentType: String,
      md5: String,
      size: Number,
      modifiedDate: Date,
      creationDate: {type: Date, default: Date.now},
      customMetaData: String
    });
    objSchema.methods.getFileStream = function () {
      var readstream = gfs.createReadStream({
       filename: this.key
      });
      return readstream;
    };
    objSchema.methods.getFileWriteStream = function () {
      var writestream = gfs.createWriteStream({
       filename: this.key
      });
      return writestream;
    };


    return mongoose.model('S3Object', objSchema);
};