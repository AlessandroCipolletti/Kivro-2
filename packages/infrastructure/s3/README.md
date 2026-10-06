# S3-compatible private object storage adapter

This package contains mechanics for Netsons-compatible S3 storage, AWS S3 and local MinIO. It does not decide ownership, retention, paid job state or result finalization; shared Kivro services must authorize every key and verify stored bytes before moving an asset to READY. Claimed object metadata and presigned upload headers are not independent integrity evidence. The bucket must remain private; signed URLs are issued only after application authorization and have short expiry.
