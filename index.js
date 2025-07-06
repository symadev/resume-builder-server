const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors');
const { ObjectId } = require('mongodb');


const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000


//middleWire
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cn4mz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("ResumeBuilder").collection("users");




    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({ token });
    });



    //middleware process
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next(); // bar
      });

    }


    //user varifyadmin after varify token 

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden  access' });
      }
      next();
    }



    //user related api

    




    //we check here that the requested user is actually the  token user or not  
    app.get('/users/admin/:email', verifyToken, async (req, res) => {

      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';

      }
      res.send({ admin });
    })



    //for save the user info to the database  
    app.post('/users', async (req, res) => {

      const user = req.body;
      //insert email if the user do not exists
      //do this in many ways like(1. email unique 2.upsert 3.simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user is already exists", insertedId: null })
      }

      const result = await userCollection.insertOne(user);
      res.send(result)
    })




        // Get all registered users (admin only)
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

  app.patch('/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;

  if (!role || !['user', 'admin', 'premium'].includes(role)) {
  return res.status(400).send({ message: 'Invalid role' });
}

  const result = await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { role } }
  );
  res.send(result);
});


 app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });






app.post('/track-download', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ message: "Email required" });

    const filter = { email };
    const update = {
      $inc: { downloads: 1 }, 
    };

    const options = { upsert: true }; 
    const result = await userCollection.updateOne(filter, update, options);

    res.send(result);
  } catch (err) {
    console.error("Download tracking error:", err);
    res.status(500).send({ message: "Server error", error: err.message });
  }
});





app.get('/profile-metrics', verifyToken, async (req, res) => {
  const { email } = req.query;
  const user = await userCollection.findOne({ email });

  const downloads = user?.downloads || 0;
  const views = user?.views || 0;
  const searchLinks = user?.searchLinks || 0;

  const achievementScore = downloads + views + searchLinks;

  res.send({
    downloads,
    views,
    searchLinks,
    achievementScore
  });
});





app.post('/track-view', verifyToken, async (req, res) => {
  const { email } = req.body;
  const filter = { email };
  const update = { $inc: { views: 1 } };
  const options = { upsert: true };
  const result = await userCollection.updateOne(filter, update, options);
  res.send(result);
});

app.post('/track-search-link', verifyToken, async (req, res) => {
  const { email } = req.body;
  const filter = { email };
  const update = { $inc: { searchLinks: 1 } };
  const options = { upsert: true };
  const result = await userCollection.updateOne(filter, update, options);
  res.send(result);
});



















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
