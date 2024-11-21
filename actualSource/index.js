// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'dpg-csvbti3v2p9s73cuorj0-a', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);



// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************


app.get('/', (req, res) => {
    res.redirect('/login'); //this will call the /anotherRoute route in the API
  });

// TODO - Include your API routes here
app.get('/register', (req, res) => {
    res.render('pages/register'); // Renders the register.hbs page
  });
  
// Register
app.post('/register', async (req, res) => {
    //hash the password using bcrypt library
    const hash = await bcrypt.hash(req.body.password, 10);
    const username = req.body.username;
    const query = 'INSERT INTO users (username, password) VALUES ($1, $2)';
    const result = await db.any(query, [username, hash]);
    if (result.err) {
        console.log(err);
        res.redirect('/register');
      } else {
        console.log('fetched response');
        res.redirect('/login');
      }
    // To-DO: Insert username and hashed password into the 'users' table
  });


app.get('/login', (req, res) => {
    res.render('pages/login');  // No need for JSON data
  });
  
app.post('/login', async (req, res) => {
    try {
      const username = req.body.username;
      const password = req.body.password;
  
      // Find the user in the 'users' table by username
      const query = 'SELECT * FROM users WHERE username = $1';
      const user = await db.one(query, [username]);
      if(user){
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = user;
            req.session.save();
            res.redirect('/discover');
          }
        else{
            // If passwords don't match, send error message and render login again
            return res.render('login', { message: 'Incorrect username or password.' });
        }
      }
      else{
        return res.redirect('/register');
      }
       
    } catch (err) {
      console.log('Error during login:', err);
      res.render('login', { message: 'An error occurred. Please try again.' });
    }
  });
  
  // Authentication Middleware.
const auth = (req, res, next) => {
    if (!req.session.user) {
      // Default to login page.
      return res.redirect('/login');
    }
    next();
  };
  
  // Authentication Required
  app.use(auth);

  app.get('/discover', async (req, res) => {
    const API_KEY = process.env.API_KEY; // Assuming API_KEY is stored in the session
  
    axios({
      url: `https://app.ticketmaster.com/discovery/v2/events.json`,
      method: 'GET',
      dataType: 'json',
      headers: {
        'Accept-Encoding': 'application/json',
      },
      params: {
        apikey: API_KEY,
        keyword: 'Los Angeles', // or any keyword you prefer
        size: 10 // number of events to return
      }
    })
    .then(response => {
      const events = response.data._embedded.events; // Directly use the events
      // Render the discover page with event results
      res.render('pages/discover', { results: events });
    })
    .catch(err => {
      console.error(err);
      // Handle error by rendering the page with an empty results array and a message
      res.render('pages/discover', { results: [], message: 'Failed to load events. Please try again later.' });
    });
  });


// Logout route
app.get('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.render('pages/logout', { message: 'There was an error logging you out. Please try again.' });
      }
      
      // Render the logout page with a success message
      res.render('pages/logout', { message: 'Logged out successfully!' });
    });
  });
  

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');