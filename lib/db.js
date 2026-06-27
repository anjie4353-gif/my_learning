import { MongoClient } from 'mongodb'

let client
let clientPromise

if (!global._mongoClientPromise) {
  client = new MongoClient(process.env.MONGO_URL)
  global._mongoClientPromise = client.connect()
}
clientPromise = global._mongoClientPromise

export async function getDb() {
  const c = await clientPromise
  return c.db(process.env.DB_NAME)
}
