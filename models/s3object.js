var Grid = require('gridfs-stream');
var uuid = require('node-uuid');

module.exports = function s3object (mongoose) {
  Grid.mongo = mongoose.mongo;
  var conn = mongoose.connection;
    var gfs = Grid(conn.db);

    var objSchema = mongoose.Schema({
      bucket: String,
      key: String,
      uuid: String,
      contentType: String,
      md5: String,
      size: Number,
      modifiedDate: Date,
      creationDate: {type: Date, default: Date.now},
      customMetaData: String
    });

    objSchema.pre('save', function (next) {
      if (!this.uuid) {
        this.uuid = uuid.v1();
      }
      this.modifiedDate = new Date();
      next();
    });

    objSchema.post('remove', function (obj) {
      var uuid = obj.uuid;
      var chunks = conn.db.collection('fs.chunks');
      var files = conn.db.collection('fs.files');
      chunks.remove({files_id:uuid}, function (err, results) {
        //console.log(err, results);
      });
      files.remove({_id:uuid}, function (err, results) {
        //console.log(err, results);
      });
    });


    objSchema.methods.generateKey = function () {
      this.uuid = uuid.v1();
    };


    objSchema.methods.getFileReadStream = function (range) {
      var options = { _id: this.uuid };
      if (range) { options.range = range; }
      var readstream = gfs.createReadStream(options);
      return readstream;
    };


    objSchema.methods.getFileWriteStream = function (contentType) {
      var writestream = gfs.createWriteStream({
        _id: this.uuid,
        filename: this.key,
        content_type: contentType
      });
      return writestream;
    };


    return mongoose.model('S3Object', objSchema);
};