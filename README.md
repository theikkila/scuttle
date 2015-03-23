# scuttle
Scuttle is S3 compatible object storage using GridFS as a backend

Based on https://github.com/jamhall/s3rver (thanks for XML-templates)


# Supports

- Listing all buckets
- Bucket access with new subdomain-style
- Bucket create
- Bucket list
- Bucket delete
- Object put
- Object get
- Object delete
- Multipart uploads

# ToDo

- Scuttle reads authorization headers and parses them (both AWS and AWSv4 auth), but uses only AUTH KEY for authorization. Full implementation is still missing.
- Scuttle doesn't yet check for clients MD5 hash and so it accepts and saves objects even if they are corrupted.
- Permissions are not yet implemented.
- Multipart upload is not cleaned up. (and there is no cancel-endpoint also)
- Dockerfile for deploy

# Usage
Scuttle has threee env-vars:
```
# Database uri
MONGODB=mongodb://localhost/scuttle
# Scuttle hostname suffix <bucket>.S3HOSTNAME
S3HOSTNAME=s3.amazonaws.com
# Port
PORT=8080
```

Scuttle should be deployed behind nginx.
