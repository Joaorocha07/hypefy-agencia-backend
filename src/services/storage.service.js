const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const r2Client = require('../config/r2');

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

async function uploadImage(file, folder = 'products') {
  const ext = file.originalname.split('.').pop();
  const key = `${folder}/${uuidv4()}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return { key, url: `${PUBLIC_URL}/${key}` };
}

function keyFromUrl(url) {
  if (!url || !url.startsWith(PUBLIC_URL)) return null;
  return url.slice(PUBLIC_URL.length + 1);
}

async function deleteImage(urlOrKey) {
  const key = urlOrKey.startsWith('http') ? keyFromUrl(urlOrKey) : urlOrKey;
  if (!key) return;

  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadImage, deleteImage };
