/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var Categories, GLOBALS, _;

_ = require('underscore');

GLOBALS = require('../lib/globals');

Categories = (function() {
  function Categories() {
    this.id2index = {};
    this.name2id = {};
    this.fqName2id = {};
    this.id2fqName = {};
    this.duplicateNames = [];
  }

  Categories.prototype.getAll = function(client) {
    return client.categories.all().fetch();
  };

  Categories.prototype.buildMaps = function(categories) {
    _.each(categories, (function(_this) {
      return function(category, index) {
        var id, name;
        name = category.name[GLOBALS.DEFAULT_LANGUAGE];
        id = category.id;
        _this.id2index[id] = index;
        if (_.has(_this.name2id, name)) {
          _this.duplicateNames.push(name);
        }
        return _this.name2id[name] = id;
      };
    })(this));
    return _.each(categories, (function(_this) {
      return function(category, index) {
        var fqName;
        fqName = '';
        if (category.ancestors) {
          _.each(category.ancestors, function(anchestor) {
            var cat, name;
            cat = categories[_this.id2index[anchestor.id]];
            name = cat.name[GLOBALS.DEFAULT_LANGUAGE];
            return fqName = "" + fqName + name + GLOBALS.DELIM_CATEGORY_CHILD;
          });
        }
        fqName = "" + fqName + category.name[GLOBALS.DEFAULT_LANGUAGE];
        _this.fqName2id[fqName] = category.id;
        return _this.id2fqName[category.id] = fqName;
      };
    })(this));
  };

  return Categories;

})();

module.exports = Categories;
