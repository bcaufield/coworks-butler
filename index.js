var express = require('express'),
  app = express(),
  body_parser = require('body-parser'),
  session = require('express-session'),
  basicAuth = require('basic-auth'),
  fs = require('fs'),
  morgan = require('morgan'),
  winston = require('winston'),
  Nexudus = require('./nexudus'),
  config = require('./config'),
  apiSlug = '/api';

// Add the body parser
app.use(body_parser.json());

// Start the session
app.use(session({
  secret: 'lkjahsdfaklshfaskdjfhasdfkjhl',
  resave: false,
  saveUninitialized: true
}));

// Configure authentication for admin pages
var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === config.server.admin.user
      && user.pass === config.server.admin.pass
  ) {
    return next();
  } else {
    return unauthorized(res);
  };
};

// Configure logging
var accessLogStream = fs.createWriteStream(config.logs.http.path, {flags: 'a'});
app.use(morgan('combined', {stream: accessLogStream}));

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      timestamp: true,
      prettyPrint: true
    }),
    new (winston.transports.File)({
      filename: config.logs.access.path,
      maxSize: config.logs.access.maxSize,
      maxFiles: config.logs.access.maxFiles,
      tailable: true
    })
  ],
  levels: {
    info: 0,
    door: 1,
    wireless: 2
  }
});

// Parse get vals for redirect
app.use(function (req, res, next) {
  if (!req.session.hasOwnProperty('base_grant_url')
      || !req.session.base_grant_url
  ) {
    req.session.base_grant_url = req.query.base_grant_url;
  }

  if (!req.session.hasOwnProperty('user_continue_url')
      || !req.session.user_continue_url
  ) {
    req.session.user_continue_url = req.query.user_continue_url;
  }

  if (!req.session.hasOwnProperty('node_id')
      || !req.session.node_id
  ) {
    req.session.node_id = req.query.node_id;
  }

  if (!req.session.hasOwnProperty('node_mac')
      || !req.session.node_mac
  ) {
    req.session.node_mac = req.query.node_mac;
  }

  if (!req.session.hasOwnProperty('gateway_id')
      || !req.session.gateway_id
  ) {
    req.session.gateway_id = req.query.gateway_id;
  }

  if (!req.session.hasOwnProperty('client_ip')
      || !req.session.client_ip
  ) {
    req.session.client_ip = req.query.client_ip;
  }

  if (!req.session.hasOwnProperty('client_mac')
      || !req.session.client_mac
  ) {
    req.session.client_mac = req.query.client_mac;
  }

  next();
});

// Static assets
app.use(express.static(__dirname + '/pub'));

// Splash page
app.get('/splash', function(req, res) {
  logger.wireless('Splashdown', {session: req.session});
  res.redirect('/');
});

/**
 * API endpoints
 */
app.post(apiSlug + '/auth', function(req, res) {
  var user = req.body.username,
    pass = req.body.password;

  if (user && pass) {
    var nex = new Nexudus(config.nexudus.loginBase, config.nexudus.auth);

    nex.authUser(user, pass, function(result, message) {
      if (result) {
        logger.wireless('Granted access to %s', req.body.username, {session: req.session})
        res.json({
          success: true,
          redirect: req.session.base_grant_url + '?continue_url=' + req.session.user_continue_url
        });
        // req.session.destroy();
        res.end();
      } else {
        logger.wireless('Denied access to %s, Nexudus Rejection: %s', req.body.username, message, {session: req.session})
        res.json({
          success: false,
          message: message || 'Unknown Error'
        }).end();
      }
    });
  } else {
    logger.wireless('Denied access to %s, Empty Form', req.body.username, {session: req.session})
    res.json({
      success: false,
      message: 'Username/Password missing'
    }).end();
  }
});

app.get(apiSlug + '/admin/check', auth, function(req, res) {
  res.json({
    success: true
  }).end();
});

app.get(apiSlug + '/admin/logs', auth, function(req, res) {
  logger.query({
    order: 'desc',
    limit: 1000
  }, function(err, results) {
    var retVal = [];
    if (!err && results && results.file) {
      retVal = results.file;
    }

    res.json({
      rows: retVal
    }).end();
  });
});

app.all('/*', function(req, res, next) {
    // Just send the index.html for other files to support HTML5Mode
    res.sendFile('pub/index.html', { root: __dirname });
});

app.listen(config.server.port, function() {
  logger.info("Started server. Listening on %d", config.server.port);
});