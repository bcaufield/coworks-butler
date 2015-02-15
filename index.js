var express = require('express'),
  app = express(),
  body_parser = require('body-parser'),
  session = require('express-session'),
  port = process.env.EXPRESS_PORT || 4000;

app.use(body_parser.json());

app.use(session({
  secret: 'lkjahsdfaklshfaskdjfhasdfkjhl',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(__dirname + '/pub'));

app.listen(port, function() {
  console.log("Listening on " + port);
});