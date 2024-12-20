const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore from @google-cloud/firestore
const firestore = new Firestore({
  projectId: 'capstone-bangkit-443012',
  keyFilename: './firebase/serviceAccountKey.json',
});

// Function to store history log in Firestore
const storeHistory = async ({ articleId, diagnosisTime, historyId, image, skinCondition }) => {
  try {
    const historyRef = firestore.collection('History'); // Use firestore from @google-cloud/firestore
    await historyRef.doc(historyId).set({
      articleId,
      diagnosisTime,
      historyId,
      image,
      skinCondition,
    });
    console.log('History log stored successfully');
  } catch (error) {
    console.error('Error storing history log:', error);
    throw new Error('Failed to store history log');
  }
};

module.exports = { storeHistory };
