import express from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import cors from 'cors';
import knex from 'knex';

const db = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      port: '5433',
      user : 'postgres',
      password : '123',
      database : 'postgres'
    }
});

const saltRounds = 10;

const app = express();

app.use(cors());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post('/signin', async (req, res) => {
    const userData = req.body;
    db.select('*')
    .from('login')
    .where({'login.email': userData.email})
    .leftJoin('users', 'login.email', 'users.email' )
    .first()
    .then(data => {
       const isValid = bcrypt.compareSync(userData.password, data.hash);
       if(isValid){
            res.json({status: "success", userId: data.id});
       }
       else{
            res.status(400).json({error: "user doesn't exist"})
       }
    })
    .catch(
        (error) => {
            console.log(error)
            res.status(400).json({error: "user doesn't exist"})
        }
    )
})

app.post('/register', async (req, res) => {
    const userData = req.body;
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(userData.password, salt);
    userData.password = hash;

    db.transaction(
        trx => {
            trx.insert({
                hash: hash,
                email: userData.email
            })
            .into('login')
            .returning('email')
            .then(data => {
                return  trx('users')
                .returning('*')
                .insert({
                    name: userData.name,
                    email: data[0].email, 
                    joined: new Date()
                })
                .then(user => res.json({ status:'success', insertedId: user[0].id }))
            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
    .catch((error) => {
        res.status(400).json({ error: 'unable to register' }) })
})

app.get('/profile/:id', async (req, res) => {
    const userId = req.params.id;
  
    db
    .select(['users.name', 'users.entries', 'users.joined'])
    .from('users').where({id: userId})
    .then(function (data) {
        if(data.length === 0){
            res.status(400).json({error: 'profile is not found'});
        }
        res.json({...data[0], status: "success"});
    })
    .catch(function () {
        res.status(400).json({error: 'profile is not found'});
    });
})

app.put('/image', async(req, res) => {
    const userId = req.body.id;
    db('users')
    .where({id: parseInt(userId)})
    .increment('entries', 1)
    .returning('entries')
    .then(function (data) {
       return  res.json({...data[0], status: "success"});
    })
    .catch(function (error) {
        res.status(400).json({error: error})
    });
})

app.listen(3000, ()=> {
    console.log('app is running on port 3000');
})


