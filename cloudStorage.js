const path = require('path');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);

// Fungsi untuk meng-upload file ke Firebase Cloud Storage
const uploadFile = async (fileBuffer, destination, mimetype) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  // Check if the mimetype is in the allowed types
  if (!allowedTypes.includes(mimetype)) {
    throw new Error('Unsupported file type');
  }

  const file = bucket.file(destination);

  const stream = file.createWriteStream({
    metadata: {
      contentType: mimetype, // Use mimetype from req.file.mimetype
      cacheControl: 'public, max-age=31536000',
    },
  });

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      const fileUrl = `https://storage.googleapis.com/${process.env.BUCKET_NAME}/${destination}`;
      resolve(fileUrl); // Return the public URL of the uploaded file
    });

    stream.on('error', (err) => {
      reject(new Error('Failed to upload image to Cloud Storage: ' + err.message));
    });

    stream.end(fileBuffer); // Write the buffer to the stream
  });
};

// Fungsi untuk mendapatkan URL file
const getFileURL = async (fileName) => {
  const file = bucket.file(fileName);

  try {
    // Memeriksa apakah file ada di storage
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('File not found');
    }

    return file.publicUrl(); // Mendapatkan URL file publik
  } catch (error) {
    console.error('Error retrieving file:', error);
    throw new Error('Failed to retrieve file');
  }
};

module.exports = { uploadFile, getFileURL };
