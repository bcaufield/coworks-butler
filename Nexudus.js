var EventEmitter = require('events').EventEmitter,
  util = require('util'),
  https = require('https');

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
};

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
    case 'function': callback = field; break;
    default: 'Coworker_Email'
  }

  https.get({
    host: this.host,
    path: '/api/spaces/coworkers?size=1000&' + field + '=' + user,
    auth: this.auth
  }, function(res) {
    res.on('data', function(data) {
      if (data && data.length) {
        try {
          var dataObj = JSON.parse(data);
          if (dataObj.hasOwnProperty('Records')) {
            if (callback) {
              callback(dataObj.Records)
            } else if(callback) {
              callback(null, new Error('Unrecognized data returned'));
            }
          }
        } catch (e) {
          if (callback) {
            callback(null, e);
          }
        }
      } else if (callback) {
        callback(null, new Error('Invalid data returned'));
      }
    });
  }).on('error', function(e) {
    if (callback) {
      callback(null, e);
    }
  });
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

};

util.inherits(Nexudus, EventEmitter);

module.exports = Nexudus;