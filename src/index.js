const express = require('express')
const app = express()

const bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (req, res) => res.send('Hello World!'))

app.use('/api/faucet', require("./faucet"))

app.listen(3939, () => console.log('Listening on Port 3939'))
