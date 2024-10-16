// Imports
const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');






require('dotenv').config();

// Main Method
const app = express();


// Middleware to parse JSON
app.use(bodyParser.json());
const authMiddleware = require('./middleware/authMiddleware');

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser()); // for parsing cookies




// Static Varibles :
const PORT = process.env.PORT || 3000;

// Views Path & Public Path
const viewsPath = path.join(__dirname, './views');
const publicPath = path.join(__dirname, './views/public');

// Views Engine
app.set('view engine', 'ejs');
app.set('views', viewsPath);
app.use(express.static(publicPath));


// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to database.');
});



//****************************************************************************************************** */
//****************************************************************************************************** */
//****************************************************************************************************** */
// Server Controllers & Methods :

// Signup & Login GET
app.get('/', (req , res)=>{
    res.render('auth');
})
 //------------------------------------------------------------------------


// Signup POST
app.post('/signup', async (req, res) => {
    const { email, username, password } = req.body;

    try {
        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user into the customers table
        const query = 'INSERT INTO customers (Email, Username, Password) VALUES (?, ?, ?)';
        db.query(query, [email, username, hashedPassword], (err, results) => {
            if (err) {
                console.error('Error inserting user:', err);
                return res.status(500).json({ message: 'Error registering user' });
            }

            // Return success response
            res.status(201).json({ message: 'User signed up successfully!', userId: results.insertId });
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

 //------------------------------------------------------------------------

// Login POST
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query to find the user by username
        const query = 'SELECT * FROM customers WHERE Username = ?';
        db.query(query, [username], async (err, results) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }


            // If user not found
            if (results.length === 0) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            const user = results[0];

            // Compare password with the hashed password in the database
            const isMatch = await bcrypt.compare(password, user.Password);

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            // If password matches, generate JWT token
            const payload = {
                user: {
                    id: user.id,
                    username: user.Username,
                }
            };

            const token = jwt.sign({
                userId: user.id,
                username: user.Username
            }, process.env.JWT_SECRET, { expiresIn: '1d' });

            res.cookie('jwt', token, {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // Set cookie max age to 1 day
            });

            // Optionally send a response after setting the cookie
            res.status(200).json({ message: 'Login successful' });
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout POST
app.post('/logout', (req, res) => {
    // Clear the JWT cookie
    res.clearCookie('jwt');

    // Send a response to indicate successful logout
    res.redirect('/');
});

// Dashboard Methods :
app.get('/dashboard', authMiddleware, (req, res) => {
    const { username } = req.user; // Extracting username from req.user
    res.render('dashboard/dashboard.ejs', { username }); // Passing username to the EJS view
});

// app.get('/dashboard/overview', authMiddleware, (req, res)=>{
//     const { username } = req.user; // Extracting username from req.user
//     res.render('dashboard/overview.ejs', { username }); // Passing username to the EJS view
// });


app.get('/dashboard/overview', authMiddleware, (req, res) => {
    const { username } = req.user; // Extracting username from req.user

    // SQL Query to get the total balance for a customer
    const query = `
        SELECT SUM(accountbalance.Balance) AS totalBalance
        FROM accounts
        JOIN accountbalance ON accounts.AccountID = accountbalance.AccountID
        JOIN customers ON accounts.CustomerID = customers.CustomerID
        WHERE customers.Username = ?
    `;

    // Assuming you're using a MySQL connection
    db.query(query, [username], (error, results) => {
        if (error) {
            return res.status(500).send('Error fetching balance');
        }

        // Extract the total balance from the query result
        const totalBalance = results[0].totalBalance || 0;

        // Pass totalBalance and username to the EJS template
        res.render('dashboard/overview.ejs', { username, totalBalance });
    });
});



app.get('/dashboard/accounts', authMiddleware, (req, res) => {
    const { username } = req.user; // Extract username from the authenticated user

    // SQL query to fetch the accounts and balances associated with the customer
    const query = `
        SELECT accounts.AccountNumber, accountbalance.Balance 
        FROM accounts 
        JOIN customers ON accounts.CustomerID = customers.CustomerID 
        JOIN accountbalance ON accounts.AccountID = accountbalance.AccountID
        WHERE customers.Username = ?
    `;

    // Execute the query with the username
    db.query(query, [username], (error, results) => {
        if (error) {
            return res.status(500).send('Error fetching accounts');
        }

        // Render the accounts view and pass the accounts data
        res.render('dashboard/accounts.ejs', { username, accounts: results });
    });
});


app.get('/dashboard/deposit');
app.get('/dashboard/withdrawal');
app.get('/dashboard/transfer');


app.post('/dashboard/overview');
app.post('/dashboard/accounts');
app.post('/dashboard/deposit');
app.post('/dashboard/withdrawal');
app.post('/dashboard/transfer');


//****************************************************************************************************** */
//****************************************************************************************************** */
//****************************************************************************************************** */


app.listen(PORT, (err)=>{
    if(err){
        console.log(`Error While Listen To Port : ${PORT}`);
    }
    console.log(`Server is Running on Port : ${PORT}`);
})




