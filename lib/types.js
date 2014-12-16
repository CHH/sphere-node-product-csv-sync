/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, Types, _;

_ = require('underscore');

CONS = require('./constants');

Types = (function() {
  function Types() {
    this.id2index = {};
    this.name2id = {};
    this.duplicateNames = [];
    this.id2SameForAllAttributes = {};
    this.id2nameAttributeDefMap = {};
  }

  Types.prototype.getAll = function(client) {
    return client.productTypes.all().fetch();
  };

  Types.prototype.buildMaps = function(productTypes) {
    return _.each(productTypes, (function(_this) {
      return function(pt, index) {
        var id, name;
        name = pt.name;
        id = pt.id;
        _this.id2index[id] = index;
        _this.id2SameForAllAttributes[id] = [];
        _this.id2nameAttributeDefMap[id] = {};
        if (_.has(_this.name2id, name)) {
          _this.duplicateNames.push(name);
        }
        _this.name2id[name] = id;
        pt.attributes || (pt.attributes = []);
        return _.each(pt.attributes, function(attribute) {
          if (attribute.attributeConstraint === CONS.ATTRIBUTE_CONSTRAINT_SAME_FOR_ALL) {
            _this.id2SameForAllAttributes[id].push(attribute.name);
          }
          return _this.id2nameAttributeDefMap[id][attribute.name] = attribute;
        });
      };
    })(this));
  };

  return Types;

})();

module.exports = Types;
