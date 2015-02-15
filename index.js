var express = require('express'),
  app = express(),
  body_parser = require('body-parser'),
  session = require('express-session'),
  port = process.env.EXPRESS_PORT || 4000;

// Add the body parser
app.use(body_parser.json());

// Start the session
app.use(session({
  secret: 'lkjahsdfaklshfaskdjfhasdfkjhl',
  resave: false,
  saveUninitialized: true
}));

// Parse get vals for redirect
app.use(function (req, res, next) {
  if (!req.session.hasOwnProperty('base_grant_url')
      || !req.session.base_grant_url) {
    req.session.base_grant_url = req.query.base_grant_url;
  }

  if (!req.session.hasOwnProperty('user_continue_url')
      || !req.session.user_continue_url) {
    req.session.user_continue_url = req.query.user_continue_url;
  }

  if (!req.session.hasOwnProperty('node_id')
      || !req.session.node_id) {
    req.session.node_id = req.query.node_id;
  }

  if (!req.session.hasOwnProperty('node_mac')
      || !req.session.node_mac) {
    req.session.node_mac = req.query.node_mac;
  }

  if (!req.session.hasOwnProperty('gateway_id')
      || !req.session.gateway_id) {
    req.session.gateway_id = req.query.gateway_id;
  }

  if (!req.session.hasOwnProperty('client_ip')
      || !req.session.client_ip) {
    req.session.client_ip = req.query.client_ip;
  }

  if (!req.session.hasOwnProperty('client_mac')
      || !req.session.client_mac) {
    req.session.client_mac = req.query.client_mac;
  }

  next();
});

app.use(express.static(__dirname + '/pub'));

app.get('/auth', function(req, res) {

});

app.get('/session', function(req, res) {
  res.json(req.session);
});

app.listen(port, function() {
  console.log("Listening on " + port);
});