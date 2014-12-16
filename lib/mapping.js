/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, GLOBALS, Mapping, _;

_ = require('underscore');

_.mixin(require('underscore.string').exports());

CONS = require('./constants');

GLOBALS = require('./globals');

Mapping = (function() {
  function Mapping(options) {
    if (options == null) {
      options = {};
    }
    this.types = options.types;
    this.customerGroups = options.customerGroups;
    this.categories = options.categories;
    this.taxes = options.taxes;
    this.channels = options.channels;
    this.continueOnProblems = options.continueOnProblems;
    this.errors = [];
  }

  Mapping.prototype.mapProduct = function(raw, productType) {
    var data, product, rowIndex;
    productType || (productType = raw.master[this.header.toIndex(CONS.HEADER_PRODUCT_TYPE)]);
    rowIndex = raw.startRow;
    product = this.mapBaseProduct(raw.master, productType, rowIndex);
    product.masterVariant = this.mapVariant(raw.master, 1, productType, rowIndex, product);
    _.each(raw.variants, (function(_this) {
      return function(entry, index) {
        return product.variants.push(_this.mapVariant(entry.variant, index + 2, productType, entry.rowIndex, product));
      };
    })(this));
    data = {
      product: product,
      rowIndex: raw.startRow,
      header: this.header
    };
    return data;
  };

  Mapping.prototype.mapBaseProduct = function(rawMaster, productType, rowIndex) {
    var attribName, product, tax, val, _i, _len, _ref;
    product = {
      productType: {
        typeId: 'product-type',
        id: productType.id
      },
      masterVariant: {},
      variants: []
    };
    if (this.header.has(CONS.HEADER_ID)) {
      product.id = rawMaster[this.header.toIndex(CONS.HEADER_ID)];
    }
    product.categories = this.mapCategories(rawMaster, rowIndex);
    tax = this.mapTaxCategory(rawMaster, rowIndex);
    if (tax) {
      product.taxCategory = tax;
    }
    _ref = CONS.BASE_LOCALIZED_HEADERS;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      attribName = _ref[_i];
      val = this.mapLocalizedAttrib(rawMaster, attribName, this.header.toLanguageIndex());
      if (val) {
        product[attribName] = val;
      }
    }
    if (!product.slug) {
      product.slug = {};
      if ((product.name != null) && (product.name[GLOBALS.DEFAULT_LANGUAGE] != null)) {
        product.slug[GLOBALS.DEFAULT_LANGUAGE] = this.ensureValidSlug(_.slugify(product.name[GLOBALS.DEFAULT_LANGUAGE], rowIndex));
      }
    }
    return product;
  };

  Mapping.prototype.ensureValidSlug = function(slug, rowIndex, appendix) {
    var currentSlug;
    if (appendix == null) {
      appendix = '';
    }
    if (!(_.isString(slug) && slug.length > 2)) {
      this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_SLUG + "] Can't generate valid slug out of '" + slug + "'!");
      return;
    }
    this.slugs || (this.slugs = []);
    currentSlug = "" + slug + appendix;
    if (!_.contains(this.slugs, currentSlug)) {
      this.slugs.push(currentSlug);
      return currentSlug;
    }
    return this.ensureValidSlug(slug, rowIndex, Math.floor((Math.random() * 89999) + 10001));
  };

  Mapping.prototype.hasValidValueForHeader = function(row, headerName) {
    if (!this.header.has(headerName)) {
      return false;
    }
    return this.isValidValue(row[this.header.toIndex(headerName)]);
  };

  Mapping.prototype.isValidValue = function(rawValue) {
    return _.isString(rawValue) && rawValue.length > 0;
  };

  Mapping.prototype.mapCategories = function(rawMaster, rowIndex) {
    var cat, categories, msg, rawCategories, rawCategory, _i, _len;
    categories = [];
    if (!this.hasValidValueForHeader(rawMaster, CONS.HEADER_CATEGORIES)) {
      return categories;
    }
    rawCategories = rawMaster[this.header.toIndex(CONS.HEADER_CATEGORIES)].split(GLOBALS.DELIM_MULTI_VALUE);
    for (_i = 0, _len = rawCategories.length; _i < _len; _i++) {
      rawCategory = rawCategories[_i];
      cat = {
        typeId: 'category'
      };
      if (_.contains(this.categories.duplicateNames, rawCategory)) {
        this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_CATEGORIES + "] The category '" + rawCategory + "' is not unqiue!");
        continue;
      }
      if (_.has(this.categories.name2id, rawCategory)) {
        cat.id = this.categories.name2id[rawCategory];
      } else if (_.has(this.categories.fqName2id, rawCategory)) {
        cat.id = this.categories.fqName2id[rawCategory];
      }
      if (cat.id) {
        categories.push(cat);
      } else {
        msg = "[row " + rowIndex + ":" + CONS.HEADER_CATEGORIES + "] Can not find category for '" + rawCategory + "'!";
        if (this.continueOnProblems) {
          console.warn(msg);
        } else {
          this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_CATEGORIES + "] Can not find category for '" + rawCategory + "'!");
        }
      }
    }
    return categories;
  };

  Mapping.prototype.mapTaxCategory = function(rawMaster, rowIndex) {
    var rawTax, tax;
    if (!this.hasValidValueForHeader(rawMaster, CONS.HEADER_TAX)) {
      return;
    }
    rawTax = rawMaster[this.header.toIndex(CONS.HEADER_TAX)];
    if (_.contains(this.taxes.duplicateNames, rawTax)) {
      this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_TAX + "] The tax category '" + rawTax + "' is not unqiue!");
      return;
    }
    if (!_.has(this.taxes.name2id, rawTax)) {
      this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_TAX + "] The tax category '" + rawTax + "' is unknown!");
      return;
    }
    return tax = {
      typeId: 'tax-category',
      id: this.taxes.name2id[rawTax]
    };
  };

  Mapping.prototype.mapVariant = function(rawVariant, variantId, productType, rowIndex, product) {
    var attrib, attribute, languageHeader2Index, vId, variant, _i, _len, _ref;
    if (variantId > 2 && this.header.has(CONS.HEADER_VARIANT_ID)) {
      vId = this.mapInteger(rawVariant[this.header.toIndex(CONS.HEADER_VARIANT_ID)], CONS.HEADER_VARIANT_ID, rowIndex);
      if ((vId != null) && !_.isNaN(vId)) {
        variantId = vId;
      } else {
        return;
      }
    }
    variant = {
      id: variantId,
      attributes: []
    };
    if (this.header.has(CONS.HEADER_SKU)) {
      variant.sku = rawVariant[this.header.toIndex(CONS.HEADER_SKU)];
    }
    languageHeader2Index = this.header._productTypeLanguageIndexes(productType);
    if (productType.attributes) {
      _ref = productType.attributes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attribute = _ref[_i];
        attrib = attribute.attributeConstraint === CONS.ATTRIBUTE_CONSTRAINT_SAME_FOR_ALL && variantId > 1 ? _.find(product.masterVariant.attributes, function(a) {
          return a.name === attribute.name;
        }) : this.mapAttribute(rawVariant, attribute, languageHeader2Index, rowIndex);
        if (attrib) {
          variant.attributes.push(attrib);
        }
      }
    }
    variant.prices = this.mapPrices(rawVariant[this.header.toIndex(CONS.HEADER_PRICES)], rowIndex);
    variant.images = this.mapImages(rawVariant, variantId, rowIndex);
    return variant;
  };

  Mapping.prototype.mapAttribute = function(rawVariant, attribute, languageHeader2Index, rowIndex) {
    var value;
    value = this.mapValue(rawVariant, attribute, languageHeader2Index, rowIndex);
    if (_.isUndefined(value) || (_.isObject(value) && _.isEmpty(value)) || (_.isString(value) && _.isEmpty(value))) {
      return void 0;
    }
    attribute = {
      name: attribute.name,
      value: value
    };
    return attribute;
  };

  Mapping.prototype.mapValue = function(rawVariant, attribute, languageHeader2Index, rowIndex) {
    switch (attribute.type.name) {
      case CONS.ATTRIBUTE_TYPE_SET:
        return this.mapSetAttribute(rawVariant, attribute.name, attribute.type.elementType, languageHeader2Index);
      case CONS.ATTRIBUTE_TYPE_LTEXT:
        return this.mapLocalizedAttrib(rawVariant, attribute.name, languageHeader2Index);
      case CONS.ATTRIBUTE_TYPE_NUMBER:
        return this.mapNumber(rawVariant[this.header.toIndex(attribute.name)], attribute.name, rowIndex);
      case CONS.ATTRIBUTE_TYPE_BOOLEAN:
        return this.mapBoolean(rawVariant[this.header.toIndex(attribute.name)], attribute.name, rowIndex);
      case CONS.ATTRIBUTE_TYPE_MONEY:
        return this.mapMoney(rawVariant[this.header.toIndex(attribute.name)], attribute.name, rowIndex);
      case CONS.ATTRIBUTE_TYPE_REFERENCE:
        return this.mapReference(rawVariant[this.header.toIndex(attribute.name)], attribute.name, rowIndex);
      default:
        return rawVariant[this.header.toIndex(attribute.name)];
    }
  };

  Mapping.prototype.mapSetAttribute = function(rawVariant, attributeName, elementType, languageHeader2Index) {
    var multiValObj, raw, rawValues, value;
    switch (elementType.name) {
      case CONS.ATTRIBUTE_TYPE_LTEXT:
        multiValObj = this.mapLocalizedAttrib(rawVariant, attributeName, languageHeader2Index);
        value = [];
        _.each(multiValObj, (function(_this) {
          return function(raw, lang) {
            var languageVals;
            if (_this.isValidValue(raw)) {
              languageVals = raw.split(GLOBALS.DELIM_MULTI_VALUE);
              return _.each(languageVals, function(v, index) {
                var localized;
                localized = {};
                localized[lang] = v;
                return value[index] = _.extend(value[index] || {}, localized);
              });
            }
          };
        })(this));
        return value;
      default:
        raw = rawVariant[this.header.toIndex(attributeName)];
        if (this.isValidValue(raw)) {
          rawValues = raw.split(GLOBALS.DELIM_MULTI_VALUE);
          return _.map(rawValues, function(rawValue) {
            return rawValue;
          });
        }
    }
  };

  Mapping.prototype.mapPrices = function(raw, rowIndex) {
    var centAmount, channelKey, country, currencyCode, customerGroupName, matchedPrice, price, prices, rawPrice, rawPrices, _i, _len;
    prices = [];
    if (!this.isValidValue(raw)) {
      return prices;
    }
    rawPrices = raw.split(GLOBALS.DELIM_MULTI_VALUE);
    for (_i = 0, _len = rawPrices.length; _i < _len; _i++) {
      rawPrice = rawPrices[_i];
      matchedPrice = CONS.REGEX_PRICE.exec(rawPrice);
      if (!matchedPrice) {
        this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_PRICES + "] Can not parse price '" + rawPrice + "'!");
        continue;
      }
      country = matchedPrice[2];
      currencyCode = matchedPrice[3];
      centAmount = matchedPrice[4];
      customerGroupName = matchedPrice[6];
      channelKey = matchedPrice[8];
      price = {
        value: this.mapMoney("" + currencyCode + " " + centAmount, CONS.HEADER_PRICES, rowIndex)
      };
      if (country) {
        price.country = country;
      }
      if (customerGroupName) {
        if (!_.has(this.customerGroups.name2id, customerGroupName)) {
          this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_PRICES + "] Can not find customer group '" + customerGroupName + "'!");
          return [];
        }
        price.customerGroup = {
          typeId: 'customer-group',
          id: this.customerGroups.name2id[customerGroupName]
        };
      }
      if (channelKey) {
        if (!_.has(this.channels.key2id, channelKey)) {
          this.errors.push("[row " + rowIndex + ":" + CONS.HEADER_PRICES + "] Can not find channel with key '" + channelKey + "'!");
          return [];
        }
        price.channel = {
          typeId: 'channel',
          id: this.channels.key2id[channelKey]
        };
      }
      prices.push(price);
    }
    return prices;
  };

  Mapping.prototype.mapMoney = function(rawMoney, attribName, rowIndex) {
    var matchedMoney, money;
    if (!this.isValidValue(rawMoney)) {
      return;
    }
    matchedMoney = CONS.REGEX_MONEY.exec(rawMoney);
    if (!matchedMoney) {
      this.errors.push("[row " + rowIndex + ":" + attribName + "] Can not parse money '" + rawMoney + "'!");
      return;
    }
    return money = {
      currencyCode: matchedMoney[1],
      centAmount: parseInt(matchedMoney[2])
    };
  };

  Mapping.prototype.mapReference = function(rawReference, attribName, rowIndex) {
    var ref;
    if (!rawReference) {
      return void 0;
    }
    return ref = {
      id: rawReference
    };
  };

  Mapping.prototype.mapInteger = function(rawNumber, attribName, rowIndex) {
    return parseInt(this.mapNumber(rawNumber, attribName, rowIndex, CONS.REGEX_INTEGER));
  };

  Mapping.prototype.mapNumber = function(rawNumber, attribName, rowIndex, regEx) {
    var matchedNumber;
    if (regEx == null) {
      regEx = CONS.REGEX_FLOAT;
    }
    if (!this.isValidValue(rawNumber)) {
      return;
    }
    matchedNumber = regEx.exec(rawNumber);
    if (!matchedNumber) {
      this.errors.push("[row " + rowIndex + ":" + attribName + "] The number '" + rawNumber + "' isn't valid!");
      return;
    }
    return parseFloat(matchedNumber[0]);
  };

  Mapping.prototype.mapBoolean = function(rawBoolean, attribName, rowIndex) {
    var b;
    if (_.isUndefined(rawBoolean) || (_.isString(rawBoolean) && _.isEmpty(rawBoolean))) {
      return;
    }
    b = JSON.parse(rawBoolean.toLowerCase());
    if (!_.isBoolean(b)) {
      this.errors.push("[row " + rowIndex + ":" + attribName + "] The value '" + rawBoolean + "' isn't a valid boolean!");
      return;
    }
    return b;
  };

  Mapping.prototype.mapLocalizedAttrib = function(row, attribName, langH2i) {
    var val, values;
    values = {};
    if (_.has(langH2i, attribName)) {
      _.each(langH2i[attribName], function(index, language) {
        var val;
        val = row[index];
        if (val) {
          return values[language] = val;
        }
      });
    }
    if (_.size(values) === 0) {
      if (!this.header.has(attribName)) {
        return;
      }
      val = row[this.header.toIndex(attribName)];
      if (val) {
        values[GLOBALS.DEFAULT_LANGUAGE] = val;
      }
    }
    if (_.isEmpty(values)) {
      return;
    }
    return values;
  };

  Mapping.prototype.mapImages = function(rawVariant, variantId, rowIndex) {
    var image, images, rawImage, rawImages, _i, _len;
    images = [];
    if (!this.hasValidValueForHeader(rawVariant, CONS.HEADER_IMAGES)) {
      return images;
    }
    rawImages = rawVariant[this.header.toIndex(CONS.HEADER_IMAGES)].split(GLOBALS.DELIM_MULTI_VALUE);
    for (_i = 0, _len = rawImages.length; _i < _len; _i++) {
      rawImage = rawImages[_i];
      image = {
        url: rawImage,
        dimensions: {
          w: 0,
          h: 0
        }
      };
      images.push(image);
    }
    return images;
  };

  return Mapping;

})();

module.exports = Mapping;
