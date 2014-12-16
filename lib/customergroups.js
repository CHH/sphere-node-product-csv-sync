/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CustomerGroups, _;

_ = require('underscore');

CustomerGroups = (function() {
  function CustomerGroups() {
    this.name2id = {};
    this.id2name = {};
  }

  CustomerGroups.prototype.getAll = function(client) {
    return client.customerGroups.all().fetch();
  };

  CustomerGroups.prototype.buildMaps = function(customerGroups) {
    return _.each(customerGroups, (function(_this) {
      return function(group) {
        var id, name;
        name = group.name;
        id = group.id;
        _this.name2id[name] = id;
        return _this.id2name[id] = name;
      };
    })(this));
  };

  return CustomerGroups;

})();

module.exports = CustomerGroups;
