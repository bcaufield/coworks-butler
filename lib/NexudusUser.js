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

  // Mac Address Field
  this.FIELD_MAC          = 'Custom5';
  this.MAX_MACS           = 3;

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
 * Get a user's registered mac addresses.
 *
 * @param function callback A callback that accepts two arguments
 *                          data: array, any mac addresses they have
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.getMacs = function(callback) {
  this.getInfo(function(info, err) {
    if (!err && info) {
      if (info[this.FIELD_MAC] && info[this.FIELD_MAC].length) {
        if (callback) {
          callback(info[this.FIELD_MAC].split(/[\\\n\r\s;,]+/));
        }
      } else if (callback) {
        callback([]);
      }
    } else if (callback) {
      callback(null, err);
    }
  });
};

/**
 * Add a mac address to an account.
 *
 * @param string   mac A mac address to add to the account
 */
NexudusUser.prototype.addMac = function(mac) {
  this.getMacs(function(macs, err) {
    if (!err && macs.length < this.MAX_MACS) {
      macs.push(mac);
      var fields = {};
      fields[this.FIELD_MAC] = macs.join('\r\n');
      this.update(fields);
    }
  });
};

/**
 * Validate user is in good standing.
 *
 * @param string   mac      The connecting mac address
 * @param function callback A callback that accepts two arguments
 *                          data: boolean, true|false
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.isValid = function(mac, callback) {
  if (mac) {
    // clean up mac address
    mac = mac.toLowerCase().replace(/[^0-9a-f]+/, '');

    this.checkPlan(function(valid, err) {
      if (!err && valid) {
        this.getMacs(function(macs, err) {
          if (!err) {
            if (macs.indexOf(mac) > -1) {
              if (callback) {
                callback(true);
              }
            } else if (macs.length < 2) {
              if (callback) {
                callback(true);
              }

              this.addMac(mac);
            } else if (callback) {
              callback(null, new Error('You have reached you limit of ' + this.MAX_MACS + ' devices.'));
            }
          } else if (callback) {
            callback(null, err);
          }
        });
      } else if (callback) {
        callback(null, err);
      }
    });
  } else if (callback) {
    callback(null, new Error('Unknown/Missing MAC Address'));
  }
};

/**
 * Check if a user's plan is valid.
 *
 * @param function callback A callback that accepts two arguments
 *                          result: boolean, true|false
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.checkPlan = function(callback) {
  this.getInfo(function(info, err) {
    if (!err && info) {
      switch (info.TariffId) {
        case this.PLAN_DAY_PASS:
          this.getPasses(function(passes, err) {
            if (!err && passes) {
              var validPass = false;
              if (passes.length) {
                for (var x in passes) {
                  if (!passes[x].Used) {
                    validPass = true;
                    break;
                  } else {
                    var curDate = new Date(),
                      passDate = new Date(passes[x].UsedDate);
                    // Pass Valid for entire day
                    if (curDate.getDate() === passDate.getDate()
                        && curDate.getMonth() === passDate.getMonth()
                        && curDate.getFullYear() === passDate.getFullYear()
                    ) {
                      validPass = true;
                      break;
                    }
                  }
                }
              }

              if (callback) {
                callack(validPass);
              }
            } else if (callback) {
              callback(null, err);
            }
          });
          break;
        case this.PLAN_HOURLY_PASS:
          this.getPasses(function(passes, err) {
            if (!err && passes) {
              var validPass = false;
              if (passes.length) {
                for (var x in passes) {
                  // check if it has not been used or has time left
                  if (!passes[x].Used || passes[x].RemainingUses > 0) {
                    validPass = true;
                    break;
                  }
                }
              }

              if (callback) {
                callack(validPass);
              }
            } else if (callback) {
              callback(null, err);
            }
          });
          break;
        default:
          if (info.Active) {
            if (!info.HasDueInvoices) {
              if (callback) {
                callback(true);
              }
            } else if (callback) {
              callback(null, new Error('You have an overdue invoice'));
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

/**
 * Update fields for a user.
 *
 * @param object   fields   A lost of { field1: value, field2: value }
 * @param function callback A callback that accepts two arguments
 *                          result: boolean, true|false
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.update = function(fields, callback) {
  if (typeof fields === 'object' && Object.keys(feidls).length) {
    fields.Id - this.id;
    this.Nexudus.call('PUT', '/api/spaces/coworkers', fields, function(data, err) {
      if (!err && data && data.WasSuccessful) {
        if (callback) {
          callback(true);
        }
      } else if (callback) {
        callback(null, err || new Error(data.Message));
      }
    });
  } else if (callback) {
    callback(null, new Error('Fields invalid or empty'));
  }
};

module.exports = NexudusUser;