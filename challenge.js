const express = require('express')
const hbs = require('hbs')
const app = express()
hbs.registerPartials(__dirname + '/views/partials');

app.get('/', function(req, res) {
  res.render('index.hbs', {
    challenge: [{
        name: "Start Namaz challenge",
        identity: "Namaz"
      },
      {
        name: "Start Quran Challenge",
        identity: "Quran"
      }
    ]
  })
})

app.get('/success', (req,res) => {
  res.render('createNewUser.hbs', {
    name: 'Qasim Ali',
    email: 'qasimali24@gmail.com',
    password: 'secret',
    challenge: req.query.identity,
    email_verification: false,
  })
})

app.post('/updateUser',(req,res) => {
  res.render('challenge.hbs',{
    msg: "Welcome Qasim to starting your 30 Days Challenge of getting punctual in your prayers.",
    challenges: [{
        name: "Start Namaz challenge",
        identity: "Namaz"
      },
      {
        name: "Start Quran Challenge",
        identity: "Quran"
      }
    ]
  })
})

app.get('/challenge', (req,res) => {
  res.render('challenge.hbs', {
    msg: `Welcome to ${req.query.label} challenge.`,
    challenges: [{
        name: "Start Namaz challenge",
        identity: "Namaz"
      },
      {
        name: "Start Quran Challenge",
        identity: "Quran"
      }
    ]
  })
})

app.get('/edit_user', (req,res) => {
  res.render('edit_user.hbs', {
    name: 'Qasim Ali',
    email: 'qasimali24@gmail.com',
    password: 'secret',
    challenge: req.query.identity,
    email_verification: false,
  })
})

app.get('/help', (req,res) => {
  res.render('help.hbs', {})
})

app.listen(3000)
