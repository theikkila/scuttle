var Grid = require('gridfs-stream');
var uuid = require('node-uuid');

module.exports = function multipart (mongoose) {
  Grid.mongo = mongoose.mongo;
  var conn = mongoose.connection;
  var gfs = Grid(conn.db);

  var objSchema = mongoose.Schema({
    bucket: String,
    key: String,
    parts: [{uuid: String, part: Number, md5: String, size: Number}],
    uploadid: String,
    contentType: String,
    modifiedDate: Date,
    creationDate: {type: Date, default: Date.now},
  });

  objSchema.pre('save', function (next) {
    if (!this.uploadid) {
      this.uploadid = uuid.v1();
    }
    this.modifiedDate = new Date();
    next();
  });

  objSchema.post('remove', function (obj) {
    var chunks = conn.db.collection('fs.chunks');
    var files = conn.db.collection('fs.files');
    obj.parts.forEach(function (part) {
      chunks.remove({files_id: part.uuid}, function (err, results) {
          //console.log(err, results);
        });
      files.remove({_id: part.uuid}, function (err, results) {
          //console.log(err, results);
        });
    });
  });

  objSchema.methods.removePart = function (part) {
    var chunks = conn.db.collection('fs.chunks');
    var files = conn.db.collection('fs.files');
    chunks.remove({files_id: this.getPartUUID(part)}, function (err, results) {
          //console.log(err, results);
        });
    files.remove({_id: this.getPartUUID(part)}, function (err, results) {
          //console.log(err, results);
        });
  };
  objSchema.methods.generateKey = function () {
    this.uploadid = uuid.v1();
  };

  objSchema.methods.getPartUUID = function (part) {
    return this.uploadid + '-' + part;
  }
  objSchema.methods.getFileReadStream = function (part, range) {

    var options = { _id: this.getPartUUID(part) };
    if (range) { options.range = range; }
    var readstream = gfs.createReadStream(options);
    return readstream;
  };


  objSchema.methods.getFileWriteStream = function (part) {
    var writestream = gfs.createWriteStream({
      _id: this.getPartUUID(part),
      filename: this.key+'.'+part
    });
    return writestream;
  };


  return mongoose.model('MPObject', objSchema);
};