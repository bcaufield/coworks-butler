var EventEmitter = require('events').EventEmitter,
  util = require('util');

/**
 * Track active users in the system.
 */
function ActiveClients() {
  /** @var integer Maximum time (milleseconds) from last poll before declared inactive */
  this.MAX_LAST_SEEN = 3000000;

  /** @var object Mac to Account hash map */
  this.activeMacs = {};

  /** @var object Active account hash map */
  this.activeAccounts = {};
}

util.inherits(ActiveClients, EventEmitter);

/**
 * Update the list of active users.
 *
 * @param string[] macs Update the list of active users
 * @throws Error if macs is not an array
 */
ActiveClients.prototype.update = function(macs) {
  if (macs && util.isArray(macs)) {
    for (var x in macs) {
      if (this.activeMacs.hasOwnProperty(macs[x])
          && this.activeAccounts.hasOwnProperty(this.activeMacs[macs[x]])
      ) {
        this.activeAccounts[this.activeMacs[macs[x]]].lastSeen = Date.now();
      }
    }

    this.checkInactive();
  } else {
    throw new Error('Array not passed');
  }
};

/**
 * Loop through accounts and check for any that are inactive.
 */
ActiveClients.prototype.checkInactive = function() {
  var curDate = Date.now();
  for (var account in this.activeAccounts) {
    if (this.activeAccounts[account].lastSeen < (curDate - this.MAX_LAST_SEEN)) {
      this.removeClient(account);
    }
  }
};

/**
 * Add an active client.
 *
 * @param integer  clientId The id of the client
 * @param string[] macs     An array of mac address associated to the client
 * @emits 'ActiveClient-Add' when a new client becomes active, params:
 *                          clientId: integer, the id of the new client
 * @throws Error if no clientId or missing/empty macs
 */
ActiveClients.prototype.newClient = function(clientId, macs) {
  if (clientId && macs && macs.length) {
    if (!this.activeAccounts.hasOwnProperty(clientId)) {
      this.activeAccounts[clientId] = {
        lastSeen: Date.now(),
        macs: []
      };
      this.emit('ActiveClient-Add', clientId);
    }
    for (var x in macs) {
      var normMac = this.normalizeMac(macs[x]);
      this.activeAccounts[clientId].macs.push(normMac);
      this.activeMacs[normMac] = clientId;
    }
  } else if (clientId) {
    throw new Error('No macs provided for ' + clientId);
  } else {
    throw new Error('Missing ClientId');
  }
};

/**
 * Remove an active client.
 *
 * @param integer  clientId The id of the client
 * @emits 'ActiveClient-Remove' when a client becomes inactive, params:
 *                          clientId: integer, the id of the inactive client
 * @throws Error if no clientId
 */
ActiveClients.prototype.removeClient = function(clientId) {
  if (clientId) {
    if (this.ActiveClients.hasOwnProperty(clientId)) {
      var macs = this.ActiveClients[clientId].macs || [];
      for (var x in macs) {
        if (this.activeMacs.hasOwnProperty(macs[x])) {
          delete this.activeMacs[macs[x]];
        }
      }
      delete this.ActiveClients[clientId];
      this.emit('ActiveClient-Remove', clientId);
    }
  } else {
    throw new Error('Missing ClientId');
  }
};

/**
 * Normalize a mac address for comparison.
 * Strips any non-hex characters.
 *
 * @param string mac The Mac address
 * @return string normalized Mac address
 */
ActiveClients.prototype.normalizeMac = function(mac) {
  return mac.toLowerCase().replace(/[^0-9a-f]+/g, '');
};

module.exports = ActiveClients;