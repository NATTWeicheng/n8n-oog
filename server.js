require('dotenv').config();
const express = require('express')
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));


const gmailRoute = require('./api/gmailRoute')
app.use('/gmail', gmailRoute)

app.get('/', (req, res) => {
    res.send("This is the API server.")
})

app.listen(PORT, () => {
    console.log(`SERVER listening on port ${PORT}`)
})