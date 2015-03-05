var express = require('express'),
  app = express(),
  body_parser = require('body-parser'),
  session = require('express-session'),
  basicAuth = require('basic-auth'),
  fs = require('fs'),
  morgan = require('morgan'),
  winston = require('winston'),
  Nexudus = require('./lib/Nexudus'),
  NexudusUser = require('./lib/NexudusUser'),
  config = require('./config'),
  apiSlug = '/api',
  serverConfig = {
    authType: 'nexudus'
  };

// Add the body parser
app.use(body_parser.json());

// Start the session
app.use(session({
  secret: config.server.session.secret,
  resave: false,
  saveUninitialized: false
}));

// Configure authentication for admin pages
var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  // if (req.session && req.session.admin) {
  //   next();
  // }

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === config.server.admin.user
      && user.pass === config.server.admin.pass
  ) {
    // if (req.session) {
    //   req.session.admin = true;
    // }
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
  if (req.hasOwnProperty('session')) {
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
  }

  next();
});

// Static assets
app.use(express.static(__dirname + '/pub'));

// Splash page
app.get('/splash', function(req, res) {
  logger.wireless('Splashdown', {session: req.session});
  if (serverConfig.authType == 'allow-all') {
    res.redirect(req.session.base_grant_url + '?continue_url=' + req.session.user_continue_url);
  } else {
    res.redirect('/login');
  }
});

// Meraki Push Endpoints
app.get('/meraki', function(req, res) {
  res.send(config.meraki.validator);
  logger.info('Responded to Meraki validation with %s', config.meraki.validator);
});

app.post('/meraki', function(req, res) {
  try {
    var parsed = JSON.parse(req.body.data);
    if (parsed.secret === config.meraki.secret) {
      if (parsed.probing.length) {

      }
    } else {
      logger.info('Invalid secret: %s', parsed.secret);
      res.end();
    }
  } catch (e) {
    logger.info('Invalid post from %s', req.connection.remoteAddress, { error: e });
    res.end();
  }
});

/**
 * API endpoints
 */
app.post(apiSlug + '/auth', function(req, res) {
  var user = req.body.username,
    pass = req.body.password;

  if (user && pass) {
    var deny = function(message) {
      logger.wireless('Denied access to %s, Nexudus Rejection: %s', user, message, {session: req.session})
      res.json({
        success: false,
        message: message || 'Unknown Error'
      });
    };

    var allow = function(message, redirect) {
      logger.wireless('Allowed access to %s on %s', user, req.session.client_mac, {session: req.session})
      res.json({
        success: true,
        message: message || 'User is Valid',
        redirect: req.session.base_grant_url + '?continue_url=' + req.session.user_continue_url
      });
    };

    var nex = new Nexudus(config.nexudus.loginBase, config.nexudus.auth);

    nex.authUser(user, pass, function(result, message) {
      if (result) {
        // User is who they say they are, look them up
        nex.findUser(user, function(data, err) {
          if (!err && data && data.length === 1) {
            var userInfo = data.pop();
            if (userInfo.Id) {
              var nexUser = new NexudusUser(nex, userInfo.Id);
              nexUser.isValid(req.session.client_mac, function(data, err) {
                if (!err && data) {
                  allow('Welcome ' + user);
                } else {
                  deny(err.message);
                }
              });
            } else {
              deny('Unable to find UserId');
            }
          } else {
            if (err) {
              deny(err.message);
            } else {
              deny('Multiple matches for ' + user);
            }
          }
        });
      } else {
        deny(message);
      }
    });
  } else {
    res.json({
      success: false,
      message: 'Username/Password missing'
    });
  }
});

app.get(apiSlug + '/admin/check', auth, function(req, res) {
  res.json({
    success: true
  });
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
    });
  });
});

app.get(apiSlug + '/admin/config', function(req, res) {
  res.json(serverConfig);
});

app.post(apiSlug + '/admin/config', auth, function(req, res) {
  if (req.body && req.body.config) {
    var oldConfig = serverConfig;
    serverConfig = req.body.config;
    logger.info('Server Config updated.', { oldVal: oldConfig, newVal: serverConfig});
  }

  res.json(serverConfig);
});

app.all('*', function(req, res, next) {
  // Just send the index.html for other files to support HTML5Mode
  res.sendFile('pub/index.html', { root: __dirname });
});

app.listen(config.server.port, function() {
  logger.info("Started server. Listening on %d", config.server.port);
});