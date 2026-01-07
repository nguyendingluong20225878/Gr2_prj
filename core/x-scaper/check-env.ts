import dotenv from 'dotenv'

const result = dotenv.config()
console.log('dotenv result:', result)
console.log('MONGODB_URI:', process.env.MONGODB_URI)
