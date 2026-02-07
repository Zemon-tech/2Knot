import { connectToDatabase, getDbStatus, isDbConnected } from '../config/db';
import mongoose from 'mongoose';

async function checkConnection() {
    console.log('🔍 Checking MongoDB connection...');

    try {
        await connectToDatabase();

        console.log('-----------------------------------');
        console.log(`Current Status: ${getDbStatus()}`);
        console.log(`Is Connected: ${isDbConnected()}`);
        console.log('-----------------------------------');

        if (isDbConnected()) {
            console.log('✅ Connection test PASSED');
        } else {
            console.log('❌ Connection test FAILED (Unexpected state)');
        }

    } catch (error) {
        console.error('❌ Connection test FAILED with error:');
        if (error instanceof Error) {
            console.error(`Message: ${error.message}`);
        } else {
            console.error(error);
        }
    } finally {
        // Gracefully close the connection after testing
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('✌️ Connection closed');
        }
        process.exit(0);
    }
}

checkConnection();
