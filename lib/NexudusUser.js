var EventEmitter = require('events').EventEmitter,
  util = require('util'),
  https = require('https'),
  querystring = require('querystring');

/**
 * An object to interace with Nexudus users.
 *
 * @param Nexudus nex A nexudus object for reference
 * @param integer id  Nexudus id
 */
function NexudusUser(nex, id) {
  EventEmitter.call(this);
  this.id = id;
  this.Nexudus = nex;

  // Special plans
  this.PLAN_HOURLY_PASS   = 32330307;
  this.PLAN_DAY_PASS      = 32330308;

  this.info = {};
}

util.inherits(NexudusUser, EventEmitter);

/**
 * Get Basic info on the user
 *
 * @param function callback A callback that accepts two arguments
 *                          data: object, the user's info
 *                          error: object, the error, if occured
 * @param boolean  noCache If true skip cache and call api
 */
NexudusUser.prototype.getInfo = function(callback, noCache) {
  if (!noCache && Object.keys(this.info).length) {
    callback(this.info);
  } else {
    this.Nexudus.call('GET', '/api/spaces/coworkers/' + this.id, function(data, err) {
      if (!err && data) {
        callback(data);
      } else {
        callback(null, err);
      }
    });
  }
};

/**
 * Get any time passes the user has.
 *
 * @param function callback A callback that accepts two arguments
 *                          data: array, any timepasses they have
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.getPasses = function(callback) {
  this.Nexudus.call(
    'GET',
    '/api/billing/coworkertimepasses',
    { 'CoworkerTimePass_Coworker': this.id },
    function(data, err) {
      if (!err && data && data.hasOwnProperty('Records')) {
        if (callback) {
          callback(data.Records);
        }
      } else if(callback) {
        callback(null, err || new Error('Unexpected Pass format'));
      }
    }
  );
};

/**
 * Validate user is in good standing.
 *
 * @param function callback A callback that accepts two arguments
 *                          data: boolean, true|false
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.isValid = function(callback) {
  this.getInfo(function(info, err) {
    if (!err && info) {
      switch (info.TariffId) {
        case this.PLAN_DAY_PASS:

          break;
        case this.PLAN_HOURLY_PASS:

          break;
        default:
          if (info.Active) {
            if (!info.HasDueInvoices) {
              if (callback) {
                callback(true);
              }
            } else if (callback) {
              callback(null, new Error('User has overdue invoice'));
            }
          } else if(callback) {
            callback(null, new Error('User is not Active'));
          }
      }
    } else if(callback) {
      callback(null, err);
    }
  }, true); // Get fresh info
};

module.exports = NexudusUser;