/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, ExportMapping, GLOBALS, _;

_ = require('underscore');

_.mixin(require('underscore.string').exports());

CONS = require('./constants');

GLOBALS = require('./globals');

ExportMapping = (function() {
  function ExportMapping(options) {
    if (options == null) {
      options = {};
    }
    this.typesService = options.typesService;
    this.categoryService = options.categoryService;
    this.channelService = options.channelService;
    this.customerGroupService = options.customerGroupService;
    this.taxService = options.taxService;
    this.header = options.header;
  }

  ExportMapping.prototype.mapProduct = function(product, productTypes) {
    var productType, rows, variant, _i, _len, _ref;
    productType = productTypes[this.typesService.id2index[product.productType.id]];
    rows = [];
    rows.push(this._mapBaseProduct(product, productType));
    if (product.variants) {
      _ref = product.variants;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        variant = _ref[_i];
        rows.push(this._mapVariant(variant, productType));
      }
    }
    return rows;
  };

  ExportMapping.prototype.createTemplate = function(productType, languages) {
    var header;
    if (languages == null) {
      languages = [GLOBALS.DEFAULT_LANGUAGE];
    }
    header = [CONS.HEADER_PUBLISHED, CONS.HEADER_HAS_STAGED_CHANGES].concat(CONS.BASE_HEADERS.concat(CONS.SPECIAL_HEADERS));
    _.each(CONS.BASE_LOCALIZED_HEADERS, function(locBaseAttrib) {
      return header = header.concat(_.map(languages, function(lang) {
        return "" + locBaseAttrib + GLOBALS.DELIM_HEADER_LANGUAGE + lang;
      }));
    });
    _.each(productType.attributes, (function(_this) {
      return function(attribute) {
        switch (attribute.type.name) {
          case CONS.ATTRIBUTE_TYPE_SET:
            return header = header.concat(_this._mapAttributeTypeDef(attribute.type.elementType, attribute, languages));
          default:
            return header = header.concat(_this._mapAttributeTypeDef(attribute.type, attribute, languages));
        }
      };
    })(this));
    return header;
  };

  ExportMapping.prototype._mapAttributeTypeDef = function(attributeTypeDef, attribute, languages) {
    switch (attributeTypeDef.name) {
      case CONS.ATTRIBUTE_TYPE_LTEXT:
        return _.map(languages, function(lang) {
          return "" + attribute.name + GLOBALS.DELIM_HEADER_LANGUAGE + lang;
        });
      default:
        return [attribute.name];
    }
  };

  ExportMapping.prototype._mapBaseProduct = function(product, productType) {
    var attribName, h2i, index, lang, row, _ref;
    row = this._mapVariant(product.masterVariant, productType);
    if (this.header.has(CONS.HEADER_PUBLISHED)) {
      row[this.header.toIndex(CONS.HEADER_PUBLISHED)] = "" + product.published;
    }
    if (this.header.has(CONS.HEADER_HAS_STAGED_CHANGES)) {
      row[this.header.toIndex(CONS.HEADER_HAS_STAGED_CHANGES)] = "" + product.hasStagedChanges;
    }
    if (this.header.has(CONS.HEADER_ID)) {
      row[this.header.toIndex(CONS.HEADER_ID)] = product.id;
    }
    if (this.header.has(CONS.HEADER_PRODUCT_TYPE)) {
      row[this.header.toIndex(CONS.HEADER_PRODUCT_TYPE)] = productType.name;
    }
    if (this.header.has(CONS.HEADER_TAX) && _.has(product, 'taxCategory')) {
      if (_.has(this.taxService.id2name, product.taxCategory.id)) {
        row[this.header.toIndex(CONS.HEADER_TAX)] = this.taxService.id2name[product.taxCategory.id];
      }
    }
    if (this.header.has(CONS.HEADER_CATEGORIES)) {
      row[this.header.toIndex(CONS.HEADER_CATEGORIES)] = _.reduce(product.categories || [], (function(_this) {
        return function(memo, category, index) {
          if (index !== 0) {
            memo += GLOBALS.DELIM_MULTI_VALUE;
          }
          return memo + _this.categoryService.id2fqName[category.id];
        };
      })(this), '');
    }
    if (this.header.has(CONS.HEADER_CREATED_AT)) {
      row[this.header.toIndex(CONS.HEADER_CREATED_AT)] = product.createdAt;
    }
    if (this.header.has(CONS.HEADER_LAST_MODIFIED_AT)) {
      row[this.header.toIndex(CONS.HEADER_LAST_MODIFIED_AT)] = product.lastModifiedAt;
    }
    _ref = this.header.toLanguageIndex();
    for (attribName in _ref) {
      h2i = _ref[attribName];
      for (lang in h2i) {
        index = h2i[lang];
        if (product[attribName]) {
          row[index] = product[attribName][lang];
        }
      }
    }
    return row;
  };

  ExportMapping.prototype._mapVariant = function(variant, productType) {
    var attribute, attributeTypeDef, row, _i, _len, _ref;
    row = [];
    if (this.header.has(CONS.HEADER_VARIANT_ID)) {
      row[this.header.toIndex(CONS.HEADER_VARIANT_ID)] = variant.id;
    }
    if (this.header.has(CONS.HEADER_SKU)) {
      row[this.header.toIndex(CONS.HEADER_SKU)] = variant.sku;
    }
    if (this.header.has(CONS.HEADER_PRICES)) {
      row[this.header.toIndex(CONS.HEADER_PRICES)] = this._mapPrices(variant.prices);
    }
    if (this.header.has(CONS.HEADER_IMAGES)) {
      row[this.header.toIndex(CONS.HEADER_IMAGES)] = this._mapImages(variant.images);
    }
    if (variant.attributes) {
      _ref = variant.attributes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attribute = _ref[_i];
        attributeTypeDef = this.typesService.id2nameAttributeDefMap[productType.id][attribute.name].type;
        if (attributeTypeDef.name === CONS.ATTRIBUTE_TYPE_LTEXT) {
          row = this._mapLocalizedAttribute(attribute, productType, row);
        } else if (this.header.has(attribute.name)) {
          row[this.header.toIndex(attribute.name)] = this._mapAttribute(attribute, attributeTypeDef);
        }
      }
    }
    return row;
  };

  ExportMapping.prototype._mapPrices = function(prices) {
    return _.reduce(prices, (function(_this) {
      return function(acc, price, index) {
        var channelKeyPart, countryPart, customerGroupPart;
        if (index !== 0) {
          acc += GLOBALS.DELIM_MULTI_VALUE;
        }
        countryPart = '';
        if (price.country) {
          countryPart = "" + price.country + "-";
        }
        customerGroupPart = '';
        if (price.customerGroup && _.has(_this.customerGroupService.id2name, price.customerGroup.id)) {
          customerGroupPart = " " + _this.customerGroupService.id2name[price.customerGroup.id];
        }
        channelKeyPart = '';
        if (price.channel && _.has(_this.channelService.id2key, price.channel.id)) {
          channelKeyPart = "#" + _this.channelService.id2key[price.channel.id];
        }
        return acc + ("" + countryPart + price.value.currencyCode + " " + price.value.centAmount + customerGroupPart + channelKeyPart);
      };
    })(this), '');
  };

  ExportMapping.prototype._mapMoney = function(money) {
    return "" + money.currencyCode + " " + money.centAmount;
  };

  ExportMapping.prototype._mapImages = function(images) {
    return _.reduce(images, function(acc, image, index) {
      if (index !== 0) {
        acc += GLOBALS.DELIM_MULTI_VALUE;
      }
      return acc + image.url;
    }, '');
  };

  ExportMapping.prototype._mapAttribute = function(attribute, attributeTypeDef) {
    var _ref;
    switch (attributeTypeDef.name) {
      case CONS.ATTRIBUTE_TYPE_SET:
        return this._mapSetAttribute(attribute, attributeTypeDef);
      case CONS.ATTRIBUTE_TYPE_ENUM:
      case CONS.ATTRIBUTE_TYPE_LENUM:
        return attribute.value.key;
      case CONS.ATTRIBUTE_TYPE_MONEY:
        return this._mapMoney(attribute.value);
      case CONS.ATTRIBUTE_TYPE_REFERENCE:
        return (_ref = attribute.value) != null ? _ref.id : void 0;
      default:
        return attribute.value;
    }
  };

  ExportMapping.prototype._mapLocalizedAttribute = function(attribute, productType, row) {
    var h2i, index, lang;
    h2i = this.header.productTypeAttributeToIndex(productType, attribute);
    if (h2i) {
      for (lang in h2i) {
        index = h2i[lang];
        if (attribute.value) {
          row[index] = attribute.value[lang];
        }
      }
    }
    return row;
  };

  ExportMapping.prototype._mapSetAttribute = function(attribute, attributeTypeDef) {
    switch (attributeTypeDef.elementType.name) {
      case CONS.ATTRIBUTE_TYPE_ENUM:
      case CONS.ATTRIBUTE_TYPE_LENUM:
        return _.reduce(attribute.value, function(memo, val, index) {
          if (index !== 0) {
            memo += GLOBALS.DELIM_MULTI_VALUE;
          }
          return memo + val.key;
        }, '');
      case CONS.ATTRIBUTE_TYPE_MONEY:
        return _.reduce(attribute.value, function(memo, val, index) {
          if (index !== 0) {
            memo += GLOBALS.DELIM_MULTI_VALUE;
          }
          return memo + _mapMoney(val);
        }, '');
      default:
        return attribute.value.join(GLOBALS.DELIM_MULTI_VALUE);
    }
  };

  return ExportMapping;

})();

module.exports = ExportMapping;
