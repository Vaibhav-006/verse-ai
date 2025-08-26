import mongoose from 'mongoose';

export async function connectMongo(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });
  return mongoose.connection;
}
