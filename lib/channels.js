/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var Channels, _;

_ = require('underscore');

Channels = (function() {
  function Channels() {
    this.key2id = {};
    this.id2key = {};
  }

  Channels.prototype.getAll = function(client) {
    return client.channels.all().fetch();
  };

  Channels.prototype.buildMaps = function(channels) {
    return _.each(channels, (function(_this) {
      return function(channel) {
        var id, key;
        key = channel.key;
        id = channel.id;
        _this.key2id[key] = id;
        return _this.id2key[id] = key;
      };
    })(this));
  };

  return Channels;

})();

module.exports = Channels;
