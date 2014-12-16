/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, Categories, Channels, Csv, CustomerGroups, GLOBALS, Header, Mapping, Promise, SphereClient, Taxes, Types, Validator, _;

_ = require('underscore');

_.mixin(require('underscore.string').exports());

Promise = require('bluebird');

Csv = require('csv');

SphereClient = require('sphere-node-sdk').SphereClient;

CONS = require('./constants');

GLOBALS = require('./globals');

Types = require('./types');

Categories = require('./categories');

CustomerGroups = require('./customergroups');

Taxes = require('./taxes');

Channels = require('./channels');

Mapping = require('./mapping');

Header = require('./header');

Validator = (function() {
  function Validator(options) {
    if (options == null) {
      options = {};
    }
    this.types = new Types();
    this.customerGroups = new CustomerGroups();
    this.categories = new Categories();
    this.taxes = new Taxes();
    this.channels = new Channels();
    options.types = this.types;
    options.customerGroups = this.customerGroups;
    options.categories = this.categories;
    options.taxes = this.taxes;
    options.channels = this.channels;
    options.validator = this;
    this.map = new Mapping(options);
    if (options.config) {
      this.client = new SphereClient(options);
    }
    this.rawProducts = [];
    this.errors = [];
    this.suppressMissingHeaderWarning = false;
    this.csvOptions = {
      delimiter: options.csvDelimiter || ',',
      quote: options.csvQuote || '"'
    };
  }

  Validator.prototype.parse = function(csvString) {
    return new Promise((function(_this) {
      return function(resolve, reject) {
        return Csv().from.string(csvString, _this.csvOptions).on('error', function(error) {
          return reject(error);
        }).to.array(function(data, count) {
          _this.header = new Header(data[0]);
          _this.map.header = _this.header;
          return resolve({
            data: _.rest(data),
            count: count
          });
        });
      };
    })(this));
  };

  Validator.prototype.validate = function(csvContent) {
    this.validateOffline(csvContent);
    return this.validateOnline();
  };

  Validator.prototype.validateOffline = function(csvContent) {
    var variantHeader;
    this.header.validate();
    this.checkDelimiters();
    if (this.header.has(CONS.HEADER_VARIANT_ID)) {
      variantHeader = CONS.HEADER_VARIANT_ID;
    }
    if (this.header.has(CONS.HEADER_SKU) && (variantHeader == null)) {
      variantHeader = CONS.HEADER_SKU;
      this.updateVariantsOnly = true;
    }
    return this.buildProducts(csvContent, variantHeader);
  };

  Validator.prototype.checkDelimiters = function() {
    var allDelimiter, delims;
    allDelimiter = {
      csvDelimiter: this.csvOptions.delimiter,
      csvQuote: this.csvOptions.quote,
      language: GLOBALS.DELIM_HEADER_LANGUAGE,
      multiValue: GLOBALS.DELIM_MULTI_VALUE,
      categoryChildren: GLOBALS.DELIM_CATEGORY_CHILD
    };
    delims = _.map(allDelimiter, function(delim, _) {
      return delim;
    });
    if (_.size(delims) !== _.size(_.uniq(delims))) {
      return this.errors.push("Your selected delimiter clash with each other: " + (JSON.stringify(allDelimiter)));
    }
  };

  Validator.prototype.validateOnline = function() {
    var gets;
    gets = [this.types.getAll(this.client), this.customerGroups.getAll(this.client), this.categories.getAll(this.client), this.taxes.getAll(this.client), this.channels.getAll(this.client)];
    return Promise.all(gets).then((function(_this) {
      return function(_arg) {
        var categories, channels, customerGroups, productTypes, taxes;
        productTypes = _arg[0], customerGroups = _arg[1], categories = _arg[2], taxes = _arg[3], channels = _arg[4];
        _this.productTypes = productTypes.body.results;
        _this.types.buildMaps(_this.productTypes);
        _this.customerGroups.buildMaps(customerGroups.body.results);
        _this.categories.buildMaps(categories.body.results);
        _this.taxes.buildMaps(taxes.body.results);
        _this.channels.buildMaps(channels.body.results);
        _this.valProducts(_this.rawProducts);
        if (_.size(_this.errors) === 0) {
          _this.valProductTypes(_this.productTypes);
          if (_.size(_this.errors) === 0) {
            return Promise.resolve(_this.rawProducts);
          } else {
            return Promise.reject(_this.errors);
          }
        } else {
          return Promise.reject(_this.errors);
        }
      };
    })(this));
  };

  Validator.prototype.buildProducts = function(content, variantColumn) {
    if (this.updateVariantsOnly) {
      this.productType2variantContainer = {};
    }
    return _.each(content, (function(_this) {
      return function(row, index) {
        var product, productType, rowIndex;
        rowIndex = index + 2;
        if (_this.updateVariantsOnly) {
          productType = row[_this.header.toIndex(CONS.HEADER_PRODUCT_TYPE)];
          if (productType) {
            if (!_.has(_this.productType2variantContainer, productType)) {
              _this.productType2variantContainer[productType] = {
                master: _.deepClone(row),
                startRow: rowIndex,
                variants: []
              };
              _this.rawProducts.push(_this.productType2variantContainer[productType]);
            }
            return _this.productType2variantContainer[productType].variants.push({
              variant: row,
              rowIndex: rowIndex
            });
          } else {
            return _this.errors.push("[row " + rowIndex + "] Please provide a product type!");
          }
        } else {
          if (_this.isProduct(row, variantColumn)) {
            product = {
              master: row,
              startRow: rowIndex,
              variants: []
            };
            return _this.rawProducts.push(product);
          } else if (_this.isVariant(row, variantColumn)) {
            product = _.last(_this.rawProducts);
            if (product) {
              return product.variants.push({
                variant: row,
                rowIndex: rowIndex
              });
            } else {
              return _this.errors.push("[row " + rowIndex + "] We need a product before starting with a variant!");
            }
          } else {
            return _this.errors.push("[row " + rowIndex + "] Could not be identified as product or variant!");
          }
        }
      };
    })(this));
  };

  Validator.prototype.valProductTypes = function(productTypes) {
    if (this.suppressMissingHeaderWarning) {
      return;
    }
    return _.each(productTypes, (function(_this) {
      return function(pt) {
        var attributes;
        attributes = _this.header.missingHeaderForProductType(pt);
        if (!_.isEmpty(attributes)) {
          console.warn("For the product type '" + pt.name + "' the following attributes don't have a matching header:");
          return _.each(attributes, function(attr) {
            return console.warn("  " + attr.name + ": type '" + attr.type.name + " " + (attr.type.name === 'set' ? 'of ' + attr.type.elementType.name : '') + "' - constraint '" + attr.attributeConstraint + "' - " + (attr.isRequired ? 'isRequired' : 'optional'));
          });
        }
      };
    })(this));
  };

  Validator.prototype.valProducts = function(products) {
    return _.each(products, (function(_this) {
      return function(product) {
        return _this.valProduct(product);
      };
    })(this));
  };

  Validator.prototype.valProduct = function(raw) {
    var index, ptInfo, rawMaster;
    rawMaster = raw.master;
    ptInfo = rawMaster[this.header.toIndex(CONS.HEADER_PRODUCT_TYPE)];
    if (_.contains(this.types.duplicateNames, ptInfo)) {
      this.errors.push("[row " + raw.startRow + "] The product type name '" + ptInfo + "' is not unique. Please use the ID!");
    }
    if (_.has(this.types.name2id, ptInfo)) {
      ptInfo = this.types.name2id[ptInfo];
    }
    if (_.has(this.types.id2index, ptInfo)) {
      index = this.types.id2index[ptInfo];
      return rawMaster[this.header.toIndex(CONS.HEADER_PRODUCT_TYPE)] = this.productTypes[index];
    } else {
      return this.errors.push("[row " + raw.startRow + "] Can't find product type for '" + ptInfo + "'");
    }
  };

  Validator.prototype.isVariant = function(row, variantColumn) {
    var variantId;
    if (variantColumn === CONS.HEADER_VARIANT_ID) {
      variantId = row[this.header.toIndex(CONS.HEADER_VARIANT_ID)];
      return parseInt(variantId) > 1;
    } else {
      return !this.isProduct(row);
    }
  };

  Validator.prototype.isProduct = function(row, variantColumn) {
    var hasProductTypeColumn;
    hasProductTypeColumn = !_.isBlank(row[this.header.toIndex(CONS.HEADER_PRODUCT_TYPE)]);
    if (variantColumn === CONS.HEADER_VARIANT_ID) {
      return hasProductTypeColumn && row[this.header.toIndex(CONS.HEADER_VARIANT_ID)] === '1';
    } else {
      return hasProductTypeColumn;
    }
  };

  Validator.prototype._hasVariantCriteria = function(row, variantColumn) {
    var critertia;
    critertia = row[this.header.toIndex(variantColumn)];
    return critertia != null;
  };

  return Validator;

})();

module.exports = Validator;
