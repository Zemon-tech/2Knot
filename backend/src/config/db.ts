import mongoose from 'mongoose';
import { env } from './env';

export async function connectToDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    // Set up connection event listeners before connecting
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    await mongoose.connect(env.MONGODB_URI);
  } catch (error) {
    console.error('❌ Failed to initial connect to MongoDB:', error);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Returns the current state of the database connection
 */
export function getDbStatus(): string {
  const states: { [key: number]: string } = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

/**
 * Checks if the database is currently connected
 */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}



