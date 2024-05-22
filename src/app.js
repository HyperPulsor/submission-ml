const Hapi = require('@hapi/hapi');
const { loadModel, predict } = require('./inference');
const { v4: uuidv4, v4 } = require('uuid');
 
(async () => {
  // load and get machine learning model
  const model = await loadModel();
  console.log('model loaded!');
  // initializing HTTP server
  const server = Hapi.server({
    host: process.env.NODE_ENV !== 'production' ? 'localhost': '0.0.0.0',
    port: 3000
  });
 
  server.route({
    method: 'POST',
    path: '/predict',
    handler: async (request, h) => {
      try {
        // get image that uploaded by user
        const { image } = request.payload;
        
        // do and get prediction result by giving model and image
        const predictions = await predict(model, image);
        // get prediction result
        const [cancer] = predictions;

        if (cancer) {
          return h.response({
            status: 'success',
            message: 'Model is predicted successfully',
            data: {
              id: uuidv4(),
              result: 'Cancer',
              suggestion: 'Segera periksa ke dokter!',
              createdAt: new Date().toISOString()
            }
          }).code(201);
        }

        return h.response({
          status: 'success',
          message: 'Model is predicted successfully',
          data: {
            id: uuidv4(),
            result: 'Non-Cancer',
            suggestion: 'Tetap jaga kesehatan!',
            createdAt: new Date().toISOString()
          }
        }).code(201);

      } catch (err) {
        return h.response({
          status: 'fail',
          message: 'Terjadi kesalahan dalam melakukan prediksi'
        }).code(400);
      }
    },
    // make request payload as `multipart/form-data` to accept file upload
    options: {
      payload: {
        allow: 'multipart/form-data',
        multipart: true,
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

  // running server
  await server.start();
 
  console.log(`Server start at: ${server.info.uri}`);
})();