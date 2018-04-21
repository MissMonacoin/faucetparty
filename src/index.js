const express = require('express')
const app = express()

const config  = require("./config")

const bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (req, res) => res.send('Hello World!'))

app.use('/api/faucet', require("./faucet"))

app.listen(config.service.port, () => console.log('Listening on Port '+config.service.port))
