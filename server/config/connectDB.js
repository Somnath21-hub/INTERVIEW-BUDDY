import mongoose from "mongoose";

const connectDb=async ()=>{
    try{
     await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 5000 })
     console.log(`Database Connected to MongoDB: ${process.env.MONGODB_URL}`)
    }catch(error){
     console.log(`Database connection error: ${error}`)
     try {
       console.log("Attempting database connection to Local MongoDB...")
       await mongoose.connect("mongodb://127.0.0.1:27017/interview", { serverSelectionTimeoutMS: 5000 })
       console.log("Database Connected to Local MongoDB")
     } catch (localError) {
       console.log(`Failed to connect to local MongoDB: ${localError}`)
     }
    }
}

export default connectDb