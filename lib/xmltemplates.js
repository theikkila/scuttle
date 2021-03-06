'use strict';
var xml = function () {
  var jstoxml = require('jstoxml');
  var _ = require('lodash');
  var DISPLAY_NAME = 'Scuttle';
  var buildQueryContentXML = function (items, options) {
    var content = _.map(items, function (item) {
      return {
        Contents: {
          Key: item.key,
          LastModified: (new Date()).toISOString(),
          ETag: item.md5,
          Size: item.size,
          StorageClass: 'Standard',
          Owner: {
            ID: 123,
            DisplayName: DISPLAY_NAME
          }
        }
      };
    });
    content.unshift({
      Name: options.bucketName,
      Prefix: options.prefix || '',
      Marker: options.marker || '',
      MaxKeys: options.maxKeys,
      IsTruncated: false
    });
    return content;
  };
  return {
    buildBuckets: function (buckets) {
      return jstoxml.toXML({
        _name: 'ListAllMyBucketsResult',
        _attrs: {'xmlns': 'http://doc.s3.amazonaws.com/2006-03-01'},
        _content: {
          Owner: {
            ID: 123,
            DisplayName: DISPLAY_NAME
          },
          Buckets: _.map(buckets, function (bucket) {
            return {
              Bucket: {
                Name: bucket.name,
                CreationDate: bucket.creationDate.toISOString()
              }
            };
          })
        }
      }, {
        header: true,
        indent: '  '
      });
    },
    buildBucketQuery: function (options, items) {
      var xml = {
        _name: 'ListAllMyBucketsResult',
        _attrs: {'xmlns': 'http://doc.s3.amazonaws.com/2006-03-01'},
        _content: buildQueryContentXML(items, options)
      };
      return jstoxml.toXML(xml, {
        header: true,
        indent: '  '
      });
    },
    buildBucketNotFound: function (bucketName) {
      return jstoxml.toXML({
        Error: {
          Code: 'NoSuchBucket',
          Message: 'The resource you requested does not exist',
          Resource: bucketName,
          RequestId: 1
        }
      }, {
        header: true,
        indent: '  '
      });
    },
    buildBucketNotEmpty: function (bucketName) {
      return jstoxml.toXML({
        Error: {
          Code: 'BucketNotEmpty',
          Message: 'The bucket your tried to delete is not empty',
          Resource: bucketName,
          RequestId: 1,
          HostId: 2
        }
      }, {
        header: true,
        indent: '  '
      });
    },
    buildKeyNotFound: function (key) {
      return jstoxml.toXML({
        Error: {
          Code: 'NoSuchKey',
          Message: 'The specified key does not exist',
          Resource: key,
          RequestId: 1
        }
      }, {
        header: true,
        indent: '  '
      });
    },
    buildError: function (code, message) {
      return jstoxml.toXML({
        Error: {
          Code: code,
          Message: message,
          RequestId: 1
        }
      }, {
        header: true,
        indent: '  '
      });
    },
    buildListMultiparts: function (bucket, mp) {
      var content = _.map(mp.parts, function (part) {
        return {
          Part: {
            PartNumber: part.part,
            LastModified: mp.modifiedDate.toISOString(),
            ETag: part.md5,
            Size: part.size
          }
        }
      });
      content.unshift({
          Bucket: bucket,
          Key: mp.key,
          UploadId: mp.uploadid,
          Initiator: {
            ID: 123,
            DisplayName: DISPLAY_NAME
          },
          Owner: {
            ID: 123,
            DisplayName: DISPLAY_NAME
          },
          StorageClass: "STANDARD",
          PartNumberMarker: 1,
          MaxParts: 10000,
          IsTruncated: false
      });
      var xml = {
        _name: 'ListPartsResult',
        _attrs: {'xmlns': 'http://doc.s3.amazonaws.com/2006-03-01'},
        _content: _.map()
      };
      return jstoxml.toXML(xml);
    },
    buildInitiateMultipartUpload: function (bucket, mp) {
      return jstoxml.toXML({
        _name: 'InitiateMultipartUploadResult',
        _attrs: {'xmlns': 'http://doc.s3.amazonaws.com/2006-03-01'},
        _content: {
          Bucket: bucket,
          Key: mp.key,
          UploadId: mp.uploadid
        }
      });
    },
    buildCompleteMultipartUpload: function (bucket, mp) {
      return jstoxml.toXML({
        _name: 'CompleteMultipartUploadResult',
        _attrs: {'xmlns': 'http://doc.s3.amazonaws.com/2006-03-01'},
        _content: {
          Bucket: bucket,
          Key: mp.key,
          Etag: mp.md5
        }
      });
    },
    buildAcl: function () {
      return jstoxml.toXML({
        _name: 'AccessControlPolicy',
        _attrs: {'xmlns': 'http://doc.s3.amazonaws.com/2006-03-01'},
        _content: {
          Owner: {
            ID: 123,
            DisplayName: DISPLAY_NAME
          },
          AccessControlList: {
            Grant: {
              _name: 'Grantee',
              _attrs: {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xsi:type': 'CanonicalUser'
              },
              _content: {
                ID: 'abc',
                DisplayName: 'You'
              }
            },
            Permission: 'FULL_CONTROL'
          }
        }
      }, {
        header: true,
        indent: '  '
      });
    },
    buildCopyObject: function (item) {
      return jstoxml.toXML({
        CopyObjectResult: {
          LastModified: item.modifiedDate,
          ETag: item.md5
        }
      }, {
        header: true,
        indent: '  '
      });
    }
  };
};
module.exports = xml();
