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
  ActiveClients = require('./lib/ActiveClients'),
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
    wireless: 2,
    meraki: 3
  }
});

//Setup new Active Clients Store
var activeClients = new ActiveClients();
activeClients.on('ActiveClient-Add', function(clientId) {
  logger.info('New user became active: %d', clientId);
});

activeClients.on('ActiveClient-Remove', function(clientId) {
  logger.info('New user became inactive: %d', clientId);
  var nexUser = new NexudusUser(clientId);
  nexUser.checkout();
});

// Parse get vals for redirect
app.use(function (req, res, next) {

  logger.wireless('app.use, req =', req);
  
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
  logger.meraki('Responded to Meraki validation from %s with %s',
    req.connection.remoteAddress,
    config.meraki.validator
  );
});

app.post('/meraki', function(req, res) {
  if (req.body && req.body.secret && req.body.data && req.body.data.observations) {
    if (req.body.secret === config.meraki.secret) {
      if (req.body.data.observations.length) {
        var connectedMacs = [];
        for (var x in req.body.data.observations) {
          if (req.body.data.observations[x].ssid
              && req.body.data.observations[x].clientMac
          ) {
            connectedMacs.push(req.body.data.observations[x].clientMac);
          }
        }

        activeClients.update(connectedMacs);

        logger.meraki('Received %d(%d connected) observations from %s',
          req.body.data.observations.length,
          connectedMacs.length,
          req.connection.remoteAddress
        );
      } else {
        logger.meraki('Empty CMX Observations from %s', req.connection.remoteAddress);
      }
    } else {
      logger.meraki('Invalid secret from %s: %s', req.connection.remoteAddress, req.body.secret);
      res.end();
    }
  } else {
    logger.meraki('Invalid CMX post from %s', req.connection.remoteAddress, { body: req.body });
  }
});

/**
 * API endpoints
 */
app.post(apiSlug + '/auth', function(req, res) {
  var user = req.body.username,
    pass = req.body.password;

  logger.wireless('index.js /auth', user, pass, JSON.stringify(req.session));  
  if (user && pass) {
    var deny = function(message) {
      logger.wireless('Denied access to %s, Rejection: %s', user, message, {session: req.session})
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
      logger.wireless('authUser', result, message);
      if (result) {
        logger.wireless('authUser, user = ', JSON.stringify(user));
        
        // User is who they say they are, look them up
        nex.findUser(user, 'Coworker_Email', function(data, err) {
          //logger.wireless('findUser, data = ', data, err);

          // Changed to not test for multiple responses - the pop gets the last one anyway
          //if (!err && data && data.length === 1) {
          if (!err && data) {  
            var userInfo = data.pop();
            logger.wireless('got user info = ', JSON.stringify(userInfo));

            if (userInfo.Id) {
              var nexUser = new NexudusUser(nex, userInfo.Id);
              logger.wireless('user session = ', JSON.stringify(req.session));
              nexUser.isValid(req.session.client_mac, function(data, err) {
                if (!err && data) {
                  nexUser.addMac(req.session.client_mac, function(data, err) {
                    if (!err && data) {
                      nexUser.checkin(function(res, err) {
                        if (!err && res) {
                          activeClients.newClient(nexUser.id, data);
                          allow('Welcome' + user);
                        } else {
                          deny(err.message || 'Could not create checkin');
                        }
                      });
                    } else {
                      logger.wireless('Checkin: Could not get macs for user', { error: err });
                      deny(err.message || 'Could not get macs for user');
                    }
                  });
                } else {
                  logger.info(err);
                  deny(err.message);
                }
              });
            } else {
              deny('Unable to find UserId');
            }
          } else {
            logger.wireless('No user info err = ', err);
            if (err) {
              deny(err.message);
            } else {
              deny((data.length ? 'Multiple' : 'No') + ' matches for ' + user);
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
