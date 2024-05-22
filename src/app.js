const Hapi = require('@hapi/hapi');
const { loadModel, predict } = require('./inference');
const { v4: uuidv4 } = require('uuid');
const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();

(async () => {
  const model = await loadModel();
  console.log('Model loaded!');

  const server = Hapi.server({
    port: 3000,
    host: '0.0.0.0',
    routes: {
        cors: {
          origin: ['*'],
        },
    },
  });

  server.route({
    method: 'POST',
    path: '/predict',
    handler: async (request, h) => {
      try {
        const { image } = request.payload;

        const predictions = await predict(model, image);
        const [cancer] = predictions;

        const result = {
          id: uuidv4(),
          result: cancer ? 'Cancer' : 'Non-Cancer',
          suggestion: cancer ? 'Segera periksa ke dokter!' : 'Tetap jaga kesehatan!',
          createdAt: new Date().toISOString()
        };

        await db.collection('predictions').doc(result.id).set(result);
        console.log("Prediction saved to Firestore");

        return h.response({
          status: 'success',
          message: 'Model is predicted successfully',
          data: result
        }).code(201);

      } catch (err) {
        console.error("Prediction error: ", err);
        return h.response({
          status: 'fail',
          message: 'Terjadi kesalahan dalam melakukan prediksi'
        }).code(400);
      }
    },
    // Make request payload as `multipart/form-data` to accept file upload
    options: {
      payload: {
        allow: 'multipart/form-data',
        multipart: true,
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/predict/histories',
    handler: async (request, h) => {
      try {
        // Retrieve all documents from the 'predictions' collection
        const snapshot = await db.collection('predictions').get();
        const histories = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id,
            history: {
              result: data.result,
              createdAt: data.createdAt,
              suggestion: data.suggestion,
              id: data.id
            }
          };
        });

        return h.response({
          status: 'success',
          data: histories
        }).code(200);
      } catch (err) {
        console.error("Error fetching prediction histories: ", err);
        return h.response({
          status: 'fail',
          message: 'Terjadi kesalahan dalam mengambil riwayat prediksi'
        }).code(500);
      }
    }
  });

  server.ext('onPreResponse', (request, h) => {
    const response = request.response;
    if (response.isBoom && response.output.statusCode === 413) {
      response.output.payload = {
        status: 'fail',
        message: 'Payload content length greater than maximum allowed: 1000000'
      };
    }
    return h.continue;
  });

  // Run server
  await server.start();

  console.log(`Server started at: ${server.info.uri}`);
})();