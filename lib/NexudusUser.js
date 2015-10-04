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
  var self = this;

  if (!noCache && Object.keys(this.info).length) {
    callback(this.info);
  } else {
    this.Nexudus.call('GET', '/api/spaces/coworkers/' + this.id, function(data, err) {
      if (!err && data) {
        self.info = data;
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
 * Get any checkins the user has.
 *
 * @param function callback A callback that accepts two arguments
 *                          data: array, any checkins they have
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.getcheckins = function(callback) {
  var self = this;

  this.Nexudus.call(
    'GET',
    '/api/spaces/checkins',
    { 'Checkin_Coworker': this.id },
    function(data, err) {
      if (!err && data && data.hasOwnProperty('Records')) {
        var checkins = [];
        // Only include checkins for the coworks
        for (var x in data.Records) {
          if (data.Records[x].BusinessId === self.Nexudus.COWORKS_BID) {
            checkins.push(data.Records[x]);
          }
        }

        if (callback) {
          callback(checkins);
        }
      } else if(callback) {
        callback(null, err || new Error('Unexpected Checkin format'));
      }
    }
  );
};

/**
 * Create a new checkin
 *
 * @param function callback A callback that accepts two arguments
 *                          data: boolean, true or false
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.checkin = function(callback) {
  var self = this;

  this.getcheckins(function(data, err) {
    if (!err) {
      // Check if user already has an existing checkin
      var existingCheckin = false;

      if (data) {
        for (var x in data) {
          if (!data[x].ToTime) {
            existingCheckin = true;
          }
        }
      }

      if (!existingCheckin) {
        self.Nexudus.call(
          'POST',
          '/api/spaces/checkins',
          {
            "BusinessId": self.Nexudus.COWORKS_BID,
            "FromTime": (new Date).toUTCString(),
            "CoWorkerId": self.id
          },
          function(data, err) {
            if (!err && data && data.WasSuccessful) {
              if (callback) {
                callback(true);
              }
            } else if(callback) {
              console.dir(data);
              callback(false, err || new Error('Unexpected Checkin format'));
            }
          }
        );
      } else if (callback) {
        // They already have an open checkin, no need to make another
        callback(true);
      }
    } else if (callback) {
      callback(null, err);
    }
  });
};

/**
 * Create a new checkin
 *
 * @param function callback A callback that accepts two arguments
 *                          data: boolean, true or false
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.checkout = function(callback) {
  var self = this;

  this.getcheckins(function(data, err) {
    if (!err) {
      if (data) {
        for (var x in data) {
          var checkin = data[x];
          checkin.ToTime = new Date.toUTCString();
          this.Nexudus.call('PUT', '/api/spaces/checkins', checkin);
        }

        if (callback) {
          callback(true);
        }
      } else if(callback) {
        // No checkins means no need to checkout
        callback(true);
      }
    } else if(callback) {
      callback(null, err);
    }
  });
};

/**
 * Get a user's registered mac addresses.
 *
 * @param function callback A callback that accepts two arguments
 *                          data: array, any mac addresses they have
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.getMacs = function(callback) {
  var self = this;
  self.getInfo(function(info, err) {
    if (!err && info) {
      if (info[self.FIELD_MAC]) {
        if (callback) {
          callback(info[self.FIELD_MAC].split(/[\\\n\r\s;,]+/));
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
 * If the mac is already on the account, it will return a positive result.
 *
 * @param string   mac A mac address to add to the account
 * @param function callback A callback that accepts two arguments
 *                          data: array, any mac addresses they have
 *                          error: object, the error, if occured
 */
NexudusUser.prototype.addMac = function(mac, callback) {
  var self = this;
  mac = this.normalizeMac(mac);

  self.getMacs(function(macs, err) {
    if (!err && macs.length < self.MAX_MACS) {
      if (macs.indexOf(mac) === -1) {
        macs.push(mac);
        self.info[self.FIELD_MAC] = macs.join('\r\n');
        self.update(self.info, function(res, err) {
          if (!err && res && callback) {
            callback(macs);
          } else if(callback) {
            callback(null, err || new Error('Failed to update user'));
          }
        });
      } else if (callback) {
        // Mac is on the list, we are good
        callback(macs);
      }
    } else if (callback) {
      callback(null, err || new Error('User has already registered maximum devices'));
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
    mac = this.normalizeMac(mac);
    var self = this;

    self.checkPlan(function(valid, err) {
      if (!err && valid) {
        self.getMacs(function(macs, err) {
          if (!err) {
            if (macs.indexOf(mac) > -1) {
              if (callback) {
                callback(true);
              }
            } else if (macs.length < self.MAX_MACS) {
              if (callback) {
                callback(true);
              }

              self.addMac(mac);
            } else if (callback) {
              console.dir("macs limit " + self.MAX_MACS);
              callback(null, new Error('You have reached you limit of ' + self.MAX_MACS + ' devices.'));
            }
          } else if (callback) {
            console.dir("get macs error " + err);
            callback(null, err);
          }
        });
      } else if (callback) {
        console.dir("checkPlan error " + err);
        callback(null, err);
      }
    });
  } else if (callback) {
    // allow unlimited devices for now
    //callback(null, new Error('Unknown/Missing MAC Address'));
    console.dir("No Mac address but returning true");
    callback(true);    
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
  var self = this;

  self.getInfo(function(info, err) {
    if (!err && info) {
      console.dir("checkPlan, info = " + JSON.stringify(info));
      switch (info.TariffId) {
        case self.PLAN_DAY_PASS:
          console.dir("self.PLAN_DAY_PASS = " + self.PLAN_DAY_PASS);
          self.getPasses(function(passes, err) {
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
                callback(validPass);
              }
            } else if (callback) {
              callback(null, err);
            }
          });
          break;
        default:
          console.dir("default plan");
          if (info.Active) {
            if (!info.HasDueInvoices) {
              if (callback) {
                console.dir("No invoices due let them in");
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
  if (typeof fields === 'object' && Object.keys(fields).length) {
    fields.Id = this.id;
    this.Nexudus.call('PUT', '/api/spaces/coworkers', fields, function(data, err) {
      if (!err && data && data.WasSuccessful) {
        if (callback) {
          callback(true);
        }
      } else if (callback) {
        console.dir(data);
        callback(null, err || new Error(data.Message));
      }
    });
  } else if (callback) {
    callback(null, new Error('Fields invalid or empty'));
  }
};

/**
 * Normalize a mac address.
 *
 * @param string mac the mac address to normalize
 * @return string normalized mac address
 */
NexudusUser.prototype.normalizeMac = function(mac) {
  if (mac && mac.toLowerCase) {
    mac.toLowerCase().replace(/[^0-9a-f]+/g, '');
  }
  return mac
};

module.exports = NexudusUser;
