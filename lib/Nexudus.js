var EventEmitter = require('events').EventEmitter,
  util = require('util'),
  https = require('https'),
  querystring = require('querystring');

/**
 * An object to interact with Nexudus.
 *
 * @param string host The host of the Nexudus api
 * @param string auth The auth pair (user:pass)
 */
function Nexudus(host, auth) {
  EventEmitter.call(this);
  this.host = host;
  this.auth = auth;

  // The CoWorks Business ID for checkins
  this.COWORKS_BID = 28185162;
};

util.inherits(Nexudus, EventEmitter);

/**
 * Search of user(s) in the api.
 * If you need more than 1000, you're not really searching ;-)
 *
 * @param string user     The user to query for
 * @param string field    The field to search, defaults to Coworker_Email
 * @param string callback A callback that accepts two arguments
 *                        data:  array, the result of the search
 *                        error: object, the error, if occured
 */
Nexudus.prototype.findUser = function(user, field, callback) {
  switch (typeof field) {
    case 'string': break;
    case 'function': callback = field; // no break
    default: field = 'Coworker_Email'
  }

  var params = {};
  params[field] = user;
  console.dir("findUser, params = " + params);

  this.call('GET', '/api/spaces/coworkers', params, function(data, err) {
    if (!err && data && data.hasOwnProperty('Records')) {
      if (callback) {
        callback(data.Records)
      }
    } else if(callback) {
      console.dir(data);
      callback(null, err || new Error('Missing Records response'));
    }
  });
};

/**
 * Call an endpoint on the Nexudus API.
 *
 * @param string   verb     get|post|put|delete, etc
 * @param string   endpoint The URL slug
 * @param object   params   Optional, Any params to be passed
 * @param function callback A function that accepts:
 *                          data: object, The data returned
 *                          error: object, the error, if occured
 */
Nexudus.prototype.call = function(verb, endpoint, params, callback) {
  verb = verb.toUpperCase();
  if (typeof params === 'function') {
    callback = params;
  }

  switch (verb) {
    case 'DELETE':
    case 'GET':
      if (typeof params === 'object') {
        endpoint += '?' + querystring.stringify(params);
      }
      console.dir("verb= GET, endpoint = " + endpoint);
      break;
  };

  var reqConfig = {
    host: this.host,
    path: endpoint,
    auth: this.auth,
    method: verb,
    headers: {}
  };

  var strParams = '';

  switch (verb) {
    case 'POST':
    case 'PUT':
      if (params) {
        strParams = JSON.stringify(params);
        reqConfig.headers['Content-Type'] = 'application/json';
        reqConfig.headers['Content-Length'] = strParams.length;
      }
      break;
  }
  console.dir("call, reqConfig = " + JSON.stringify(reqConfig));
  
  var call = https.request(reqConfig, function(res) {
    var retVal = '';
    res.on('data', function(data) {
      //console.dir("http request, data = " + JSON.stringify(data));            

      if (data && data.length) {
        retVal += data.toString();
      } else if (callback) {
        callback(null, new Error('Invalid data returned'));
      }
    });

    res.on('end', function() {
      //console.dir("http end, retVal = " + retVal);

      try {
        var dataObj = retVal && JSON.parse(retVal);
        if (typeof dataObj === 'object') {
          if (callback) {
            callback(dataObj)
          }
        } else if (dataObj === 'Not found') {
          throw new Error('Item not found');
        } else {
          throw new Error('Unrecognized data returned');
        }
      } catch (e) {
        if (callback) {
          callback(null, e);
        }
      }
    });
  });

  call.on('error', function(e) {
    console.dir("call, error = " + JSON.stringify(e));
  
    if (callback) {
      callback(null, e);
    }
  });

  switch (verb) {
    case 'POST':
    case 'PUT':
      if (params) {
        call.write(strParams);
      }
      break;
  }

  call.end();
};

/**
 * Authenticate a user.
 *
 * @param string user     The username
 * @param string pass     The password
 * @param string callback A callback that accepts two arguments
 *                        result:  boolean, true of authenticated, false otherwise
 *                        message: string, a message for the user (typically an error)
 */
Nexudus.prototype.authUser = function(user, pass, callback) {
  var host = this.host;
  https.get({
    host: host,
    path: '/Login'
  }, function(res) {
    if (res.headers['set-cookie']) {
      var requestToken = null,
        cookieJar = [];

      for (var x in res.headers['set-cookie']) {
        var matches = res.headers['set-cookie'][x].match(/^(.+?)=(.+?);/);
        if (matches) {
          cookieJar.push(matches[1] + '=' + matches[2]);
        }
      }

      res.on('data', function(html) {
        var htmlMatches = html.toString().match(/name="__RequestVerificationToken" .+? value="(.+?)"/);
        if (htmlMatches) {
          requestToken = htmlMatches[1];
        }

        if (requestToken) {
          var postData = querystring.stringify({
            login: user,
            pass: pass,
            returnUrl: '/en/profile',
            '__RequestVerificationToken': requestToken,
            remember: false
          });
          var opts = {
            host: host,
            path: '/Login/Json',
            method: 'POST',
            headers: {
              Host: host,
              Origin: 'https://' + host,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Content-Length': postData.length,
              'Cookie': cookieJar.join('; ')
            }
          };

          var loginReq = https.request(opts, function(loginRes) {
            loginRes.on('data', function(data) {
              if (data && data.length) {
                try {
                  var dataObj = JSON.parse(data.toString());
                  if (dataObj.valid) {
                    if (callback) {
                      callback(true);
                    }
                  } else if(callback) {
                      callback(false, 'Invalid Username/Password');
                  }
                } catch (e) {
                  if (callback) {
                    callback(false, e.message);
                  }
                }
              } else if (callback) {
                callback(false, 'Invalid data returned');
              }
            });
          });

          loginReq.on('error', function(e) {
            if (callback) {
              callback(false, e.message);
            }
          });

          loginReq.write(postData);
          loginReq.end();
        } else if (callback) {
          callback(false, 'Missing API Token');
        }
      });
    } else if (callback) {
      callback(false, 'Missing API Cookie Header');
    }
  }).on('error', function(e) {
    if (callback) {
      callback(false, e.message);
    }
  });
};

module.exports = Nexudus;