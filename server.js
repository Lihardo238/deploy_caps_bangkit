const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); // Load environment variables
const { uploadFile } = require('./cloudStorage');
const { storeHistory } = require('./firestore');

// Initialize Firebase Admin SDK with default credentials
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.NODE_ENV !== 'production' ? 'localhost' : '0.0.0.0';

// Middleware for parsing JSON body
app.use(bodyParser.json());

// Firebase Firestore
const db = admin.firestore();

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Predict route
app.post('/predict', upload.single('image'), async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Create a unique destination for the file in cloud storage
    const destination = `history/${userId}_${Date.now()}_${req.file.originalname}`;

    // Trigger the file upload asynchronously (don't block the prediction logic)
    const uploadFilePromise = uploadFile(req.file.buffer, destination, req.file.mimetype);

    // Predict the skin condition (compute engine part)
    const computeEngineUrl = process.env.COMPUTE_ENGINE_URL;
    const computeResponse = await axios.post(`${computeEngineUrl}/predict`, {
      imageUrl: '',  // Initially, we don't have imageUrl
    });

    const predictedValue = computeResponse.data.prediction;

    const articlesRef = db.collection('Articles'); // Correct usage of Firestore instance
    const articleSnapshot = await articlesRef.where('name', '==', predictedValue).get();

    if (articleSnapshot.empty) {
      return res.status(404).json({ error: 'Article not found for prediction' });
    }

    const articleId = articleSnapshot.docs[0].id;
    const historyId = uuidv4();

    // Get the file URL after the upload completes
    const imageUrl = await uploadFilePromise;

    const historyData = {
      articleId,
      diagnosisTime: new Date().toISOString(),
      historyId,
      image: imageUrl,
      skinCondition: predictedValue,
    };

    await storeHistory(historyData); // Ensure this function is correctly implemented

    res.status(200).json({
      message: 'Prediction and history log created successfully',
      history: historyData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Register route
app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Add user details to Firestore
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      name,
      email,
    });

    res.status(201).json({ 
      message: 'User registered successfully', 
      userId: userRecord.uid, 
      data: { name, email } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email } = req.body;

  try {
    // Retrieve user details from Firebase Authentication
    const userRecord = await admin.auth().getUserByEmail(email);
    if (userRecord) {
      // Get user data from Firestore using the user ID
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      if (userDoc.exists) {
        res.status(200).json({ 
          message: 'Login successful', 
          userId: userRecord.uid, 
          data: userDoc.data() 
        });
      } else {
        res.status(404).json({ message: 'User data not found in Firestore' });
      }
    } else {
      res.status(404).json({ message: 'User not found in Firebase Authentication' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});


// Get History route
app.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const historyRef = db.collection('History').doc(userId);
    const doc = await historyRef.get();

    if (!doc.exists) {
      res.status(404).send({ message: 'History not found' });
    } else {
      res.status(200).send(doc.data());
    }
  } catch (error) {
    res.status(500).send({ message: 'Error fetching history', error: error.message });
  }
});

// Get Doctor Contact route
app.get('/dokter/contact', async (req, res) => {
  try {
    const dokterRef = db.collection('Doctors');
    const snapshot = await dokterRef.get();

    if (snapshot.empty) {
      res.status(404).send({ message: 'No doctors found' });
    } else {
      const contacts = [];
      snapshot.forEach((doc) => {
        contacts.push(doc.data());
      });
      res.status(200).send(contacts);
    }
  } catch (error) {
    res.status(500).send({ message: 'Error fetching doctor contacts', error: error.message });
  }
});

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});