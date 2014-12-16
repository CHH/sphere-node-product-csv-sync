/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var Taxes, _;

_ = require('underscore');

Taxes = (function() {
  function Taxes() {
    this.name2id = {};
    this.id2name = {};
    this.duplicateNames = [];
  }

  Taxes.prototype.getAll = function(client) {
    return client.taxCategories.all().fetch();
  };

  Taxes.prototype.buildMaps = function(taxCategories) {
    return _.each(taxCategories, (function(_this) {
      return function(taxCat) {
        var id, name;
        name = taxCat.name;
        id = taxCat.id;
        _this.id2name[id] = name;
        if (_.has(_this.name2id, name)) {
          _this.duplicateNames.push(name);
        }
        return _this.name2id[name] = id;
      };
    })(this));
  };

  return Taxes;

})();

module.exports = Taxes;
