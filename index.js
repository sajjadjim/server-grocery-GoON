require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000;
const { ObjectId } = require('mongodb');



// MIDDLEWARE
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@sajjadjim15.ac97xgz.mongodb.net/?retryWrites=true&w=majority&appName=SajjadJim15`;

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
    const database = client.db('Grocery_Shop')
    const userCollections = database.collection("user")
    const foodCollections = database.collection('food')

    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      }).send({ message: 'Logged out successfully' });
    });

    app.get('/foods', async (req, res) => {
      const allFoods = await foodCollections.find().toArray();
      res.send(allFoods);
    })
    app.get('/foods/expiring-soon', async (req, res) => {
      const today = new Date();
      const fiveDaysLater = new Date();
      fiveDaysLater.setDate(today.getDate() + 5);

      const nearlyExpiringFoods = await foodCollections
        .find({
          expiryDate: {
            $gte: today,
            $lte: fiveDaysLater,
          }
        })
        .sort({ expiryDate: 1 })
        .limit(6)
        .toArray();

      res.send(nearlyExpiringFoods);

    })

    app.get('/foods/recent', async (req, res) => {
      try {
        const recentFoods = await foodCollections
          .find({})
          .sort({ addedDate: -1 }) 
          .limit(6)
          .toArray();

        res.send(recentFoods);
      } catch (err) {
        console.error("Error fetching recent foods:", err);
        res.status(500).send({ message: "Failed to fetch recent products" });
      }
    });


    app.get('/foods/expired', async (req, res) => {
      const today = new Date();

      const expiredFoods = await foodCollections.find({
        expiryDate: { $lt: today }
      }).sort({ expiryDate: -1 }).toArray();
      res.send(expiredFoods)
    })

    app.get('/foods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await foodCollections.findOne(query);
      res.send(result);
    })


    // protected apis
    // save a food data in db
    app.post('/add-food', async (req, res) => {
      const foodData = req.body;

      if (foodData.expiryDate && typeof foodData.expiryDate === 'string') {
        const parsedDate = new Date(foodData.expiryDate);
        if (!isNaN(parsedDate)) {
          foodData.expiryDate = parsedDate;
        }
      }

      const result = await foodCollections.insertOne(foodData);
      res.status(201).send(result)
    })


    app.patch('/foods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          title: req.body.title,
          quantity: req.body.quantity,
          category: req.body.category,
        }
      }
      const result = await foodCollections.updateOne(query, updateDoc);
      res.send(result);
    })

    app.delete('/foods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await foodCollections.deleteOne(query);
      res.send(result)
    })

    app.get('/my-foods/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { userEmail: email }
      const foods = await foodCollections.find(filter).toArray();
      res.send(foods)

    })

    app.post('/foods/:id/notes',  async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const { note, userEmail } = req.body;

      const noteObject = {
        note,
        postedAt: new Date().toISOString(),
        userEmail
      }

      const result = await foodCollections.updateOne(query,
        { $push: { notes: noteObject } }
      )

      if (result.modifiedCount > 0) {
        res.send({ success: true, message: 'Note added succesfully' })
      }
      else {
        res.status(403).send({ success: false, message: 'You are not allowed to  add  note to this food items' })
      }
    })


    app.get('/user', async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const userProfile = req.body;
      const result = await userCollections.insertOne(userProfile);
      res.send(result)
    })


    app.get('/admin/fix-expiry-dates', async (req, res) => {
      try {
        const cursor = await foodCollections.find({});

        let count = 0;

        for await (const doc of cursor) {
          if (typeof doc.expiryDate === 'string') {
            const parsedDate = new Date(doc.expiryDate);
            if (!isNaN(parsedDate)) {
              await foodCollections.updateOne(
                { _id: doc._id },
                { $set: { expiryDate: parsedDate } }
              );
              count++;
            }
          }
        }

        res.send({ message: ` Fixed ${count} expiryDate values.` });
      } catch (error) {
        console.error(' Error fixing expiry dates:', error);
        res.status(500).send({ error: 'Internal error occurred' });
      }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Expiry Food Track</title>
      <style>
        body {
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          font-family: 'Segoe UI', Arial, sans-serif;
          margin: 0;
          padding: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 8px 32px rgba(60, 72, 88, 0.15);
          padding: 40px 32px;
          max-width: 420px;
          text-align: center;
        }
        h1 {
          color: #4f46e5;
          font-size: 2.5rem;
          margin-bottom: 12px;
          letter-spacing: 1px;
        }
        p {
          color: #64748b;
          font-size: 1.15rem;
          margin-bottom: 24px;
        }
        .btn {
          display: inline-block;
          padding: 12px 32px;
          background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
          cursor: pointer;
        }
        .btn:hover {
          background: linear-gradient(90deg, #4338ca 0%, #6366f1 100%);
        }
        @media (max-width: 600px) {
          .container {
            padding: 24px 8px;
            max-width: 95vw;
          }
          h1 {
            font-size: 2rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Expiry Food Track</h1>
        <p>Welcome to your smart food expiry tracker.<br>
        Keep your groceries fresh and never miss an expiry date!</p>
        <a class="btn" href="http://localhost:5173/">Go to App</a>
      </div>
    </body>
    </html>
  `)
})
app.listen(port, () => {
  console.log(`Expiry food Track sarver is running ${port}`)
})